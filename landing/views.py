import json
from decimal import Decimal, ROUND_DOWN
import hashlib
import math

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.db.models import Count, Sum
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from .certificates import build_contract_certificate_pdf
from .forms import InvestorPanelForm, LoginForm, RegisterForm
from .models import (
    AssetStatusHistory,
    BiologicalAsset,
    BlockchainRecord,
    DigitalContract,
    Role,
    TokenHolding,
    TokenTransaction,
    TokenizedAsset,
    User,
)
from .services import buy_tokens, ensure_wallet, invest_with_agt_wallet, top_up_wallet


LINKED_CARD_SESSION_KEY = "agrotech_linked_card"


def _asset_image_path(asset):
    image_index = ((asset.display_order or 1) - 1) % 6 + 1
    return f"images/Tokens/{image_index}.jpg"


ASSET_MAP_LOCATIONS = {
    "FARM-001": {
        "zone": "Norte del Huila",
        "municipality": "Palermo",
        "department": "Huila",
        "latitude": "2.9316",
        "longitude": "-75.5078",
        "map_x": 41,
        "map_y": 28,
    },
    "FARM-002": {
        "zone": "Centro del Huila",
        "municipality": "Campoalegre",
        "department": "Huila",
        "latitude": "2.6237",
        "longitude": "-75.3899",
        "map_x": 56,
        "map_y": 48,
    },
    "FARM-003": {
        "zone": "Sur del Huila",
        "municipality": "Garzon",
        "department": "Huila",
        "latitude": "2.1428",
        "longitude": "-75.6948",
        "map_x": 45,
        "map_y": 72,
    },
}

DEMO_TOKEN_STATE_OVERRIDES = {
    "LOT-002": {
        "tokens_sold": 64,
    },
}

TOKEN_FACE_VALUE_COP = Decimal("100000")


def _build_token_market_metrics(total_tokens=0, tokens_sold=0):
    safe_total_tokens = max(int(total_tokens or 0), 0)
    safe_tokens_sold = max(0, min(safe_total_tokens, int(tokens_sold or 0)))
    tokens_available = max(safe_total_tokens - safe_tokens_sold, 0)

    return {
        "total_tokens": safe_total_tokens,
        "tokens_sold": safe_tokens_sold,
        "tokens_available": tokens_available,
        "token_face_value_cop": TOKEN_FACE_VALUE_COP,
        "capital_available": Decimal(tokens_available) * TOKEN_FACE_VALUE_COP,
        "capital_raised": Decimal(safe_tokens_sold) * TOKEN_FACE_VALUE_COP,
    }


def _get_effective_token_state(tokenized_asset):
    total_tokens = tokenized_asset.total_tokens or 0
    tokens_sold = tokenized_asset.tokens_sold
    overrides = DEMO_TOKEN_STATE_OVERRIDES.get(tokenized_asset.asset.code, {})

    if "tokens_sold" in overrides:
        tokens_sold = overrides["tokens_sold"]

    return _build_token_market_metrics(total_tokens=total_tokens, tokens_sold=tokens_sold)


def _asset_map_context(asset):
    default_location = {
        "zone": "Huila",
        "municipality": asset.farm.municipality,
        "department": asset.farm.department,
        "latitude": "2.5359",
        "longitude": "-75.5277",
        "map_x": 50,
        "map_y": 50,
    }
    location = {**default_location, **ASSET_MAP_LOCATIONS.get(asset.farm.code, {})}
    location["farm_name"] = asset.farm.name
    location["asset_name"] = asset.name
    location["asset_code"] = asset.code
    return location


def _ensure_investor_profile(user):
    investor_role = Role.objects.filter(code=Role.INVESTOR).first()
    if investor_role and hasattr(user, "profile"):
        profile = user.profile
        updates = []
        if profile.primary_role_id != investor_role.id:
            profile.primary_role = investor_role
            updates.append("primary_role")
        if profile.status != profile.ACTIVE:
            profile.status = profile.ACTIVE
            updates.append("status")
        if updates:
            updates.append("updated_at")
            profile.save(update_fields=updates)


def _authenticate_with_email(email, password):
    try:
        user = User.objects.get(email=email.strip().lower())
    except User.DoesNotExist:
        return None
    if user.check_password(password) and user.is_active:
        return user
    return None


def _sanitize_linked_card_payload(holder_name="", last4=""):
    holder = " ".join(str(holder_name or "").split())
    digits = "".join(ch for ch in str(last4 or "") if ch.isdigit())
    if len(digits) > 4:
        digits = digits[-4:]
    if len(digits) != 4:
        return None
    return {
        "holder": holder[:18],
        "last4": digits,
    }


def _get_linked_card(request):
    payload = request.session.get(LINKED_CARD_SESSION_KEY)
    if not isinstance(payload, dict):
        return None
    return _sanitize_linked_card_payload(
        holder_name=payload.get("holder", ""),
        last4=payload.get("last4", ""),
    )


def _store_linked_card(request, holder_name="", last4=""):
    payload = _sanitize_linked_card_payload(holder_name=holder_name, last4=last4)
    if payload:
        request.session[LINKED_CARD_SESSION_KEY] = payload
        request.session.modified = True
    return payload


def _build_home_context(active_auth_mode="login", login_form=None, register_form=None):
    featured_assets = (
        BiologicalAsset.objects.select_related("producer", "farm", "category", "tokenization")
        .filter(is_featured=True, status=BiologicalAsset.AVAILABLE)
        .order_by("display_order", "estimated_sale_date")[:6]
    )
    featured_cards = [
        {
            "asset": asset,
            "image_path": _asset_image_path(asset),
        }
        for asset in featured_assets
    ]
    return {
        "featured_assets": featured_cards,
        "agrotech_token_price_cop": settings.AGROTECH_TOKEN_PRICE_COP,
        "paypal_client_id": settings.PAYPAL_CLIENT_ID,
        "active_auth_mode": active_auth_mode,
        "login_form": login_form or LoginForm(),
        "register_form": register_form or RegisterForm(),
    }


def _build_investor_quote(btc_amount, tokenized_asset):
    btc_usd_rate = Decimal(str(settings.AGROTECH_DEMO_BTC_USD))
    btc_cop_rate = Decimal(str(settings.AGROTECH_DEMO_BTC_COP))

    btc_amount = Decimal(btc_amount)
    equivalent_usd = (btc_amount * btc_usd_rate).quantize(Decimal("0.01"))
    equivalent_cop = (btc_amount * btc_cop_rate).quantize(Decimal("0.01"))

    if tokenized_asset.token_price > 0:
        estimated_tokens = int((equivalent_cop / tokenized_asset.token_price).to_integral_value(rounding=ROUND_DOWN))
    else:
        estimated_tokens = 0

    spendable_cop = (Decimal(estimated_tokens) * tokenized_asset.token_price).quantize(Decimal("0.01"))
    spendable_usd = (spendable_cop / btc_cop_rate * btc_usd_rate).quantize(Decimal("0.01")) if spendable_cop else Decimal("0.00")

    return {
        "btc_amount": btc_amount.quantize(Decimal("0.000001")),
        "btc_usd_rate": btc_usd_rate.quantize(Decimal("0.01")),
        "btc_cop_rate": btc_cop_rate.quantize(Decimal("0.01")),
        "equivalent_usd": equivalent_usd,
        "equivalent_cop": equivalent_cop,
        "estimated_tokens": estimated_tokens,
        "spendable_cop": spendable_cop,
        "spendable_usd": spendable_usd,
        "can_buy": estimated_tokens >= 1 and estimated_tokens <= tokenized_asset.tokens_available,
    }


def _build_default_btc_amount(tokenized_asset):
    btc_cop_rate = Decimal(str(settings.AGROTECH_DEMO_BTC_COP))
    preferred_amount = Decimal("0.050000")

    if tokenized_asset.tokens_available <= 0 or btc_cop_rate <= 0:
        return Decimal("0.000001")

    max_affordable_amount = (
        Decimal(tokenized_asset.tokens_available) * tokenized_asset.token_price / btc_cop_rate
    ).quantize(Decimal("0.000001"), rounding=ROUND_DOWN)

    if max_affordable_amount < Decimal("0.00001"):
        return Decimal("0.00001")

    return min(preferred_amount, max_affordable_amount)


def _resolve_investment_badge(tokenized_asset):
    token_state = _get_effective_token_state(tokenized_asset)
    total_tokens = token_state["total_tokens"]
    tokens_available = token_state["tokens_available"]
    tokens_sold = token_state["tokens_sold"]
    funding_pct = int((tokens_sold / total_tokens) * 100) if total_tokens else 0
    almost_threshold = max(3, math.ceil(total_tokens * 0.08)) if total_tokens else 0
    demand_threshold = max(10, math.ceil(total_tokens * 0.2)) if total_tokens else 0

    if tokens_available <= 0:
        return "Completado", "completed"
    if tokens_available <= almost_threshold:
        return "Casi agotado", "almost"
    if funding_pct >= 55 or tokens_available <= demand_threshold:
        return "Alta demanda", "hot"
    return "Disponible", "available"


def _estimate_participants(tokenized_asset):
    token_state = _get_effective_token_state(tokenized_asset)
    actual = tokenized_asset.holdings.count()
    if actual:
        return actual
    if token_state["tokens_sold"] <= 0:
        return 0
    return max(1, math.ceil(token_state["tokens_sold"] / 6))


def _format_compact_millions(value):
    amount = Decimal(value or 0)
    if amount >= Decimal("1000000"):
        return f"{(amount / Decimal('1000000')).quantize(Decimal('0.01'))}M"
    if amount == amount.to_integral_value():
        return f"{int(amount)}"
    return f"{amount.quantize(Decimal('0.01'))}"


def _build_wallet_snapshot(user, portfolio=None, transactions=None):
    wallet = ensure_wallet(user)
    if portfolio is None:
        portfolio = TokenHolding.objects.select_related("tokenized_asset__asset").filter(user=user)
    if transactions is None:
        transactions = TokenTransaction.objects.select_related("tokenized_asset__asset").filter(user=user)

    portfolio_items = list(portfolio)
    transaction_items = list(transactions)
    total_invested = sum((item.total_amount for item in transaction_items), Decimal("0.00"))
    estimated_return_value = sum(
        (
            Decimal(holding.quantity)
            * holding.tokenized_asset.token_price
            * holding.tokenized_asset.asset.estimated_return_pct
            / Decimal("100")
        )
        for holding in portfolio_items
    )
    average_return_pct = (
        (estimated_return_value / total_invested * Decimal("100")).quantize(Decimal("0.01"))
        if total_invested
        else Decimal("0.00")
    )

    return {
        "wallet": wallet,
        "tokens_available": wallet.agt_balance,
        "equivalent_cop": Decimal(wallet.equivalent_cop),
        "equivalent_cop_compact": _format_compact_millions(wallet.equivalent_cop),
        "portfolio_assets": len(portfolio_items),
        "total_invested": total_invested,
        "total_invested_compact": _format_compact_millions(total_invested),
        "portfolio_value": sum(
            (Decimal(holding.quantity) * holding.tokenized_asset.token_price) for holding in portfolio_items
        ),
        "estimated_return_pct": average_return_pct,
    }


def _investment_transactions_queryset(user):
    return (
        TokenTransaction.objects.select_related("tokenized_asset__asset")
        .filter(user=user, transaction_type=TokenTransaction.WALLET_BUY)
        .order_by("-created_at")
    )


def _investment_holdings_queryset(user):
    return (
        TokenHolding.objects.select_related("tokenized_asset__asset")
        .filter(
            user=user,
            tokenized_asset__transactions__user=user,
            tokenized_asset__transactions__transaction_type=TokenTransaction.WALLET_BUY,
        )
        .distinct()
        .order_by("-updated_at")
    )


def _build_asset_snapshot(tokenized_asset, user=None, holding_quantity=None, total_invested=None):
    asset = tokenized_asset.asset
    token_state = _get_effective_token_state(tokenized_asset)
    total_tokens = token_state["total_tokens"]
    tokens_sold = token_state["tokens_sold"]
    tokens_available = token_state["tokens_available"]
    progress_percent = int((tokens_sold / total_tokens) * 100) if total_tokens else 0
    capital_raised = token_state["capital_raised"]
    capital_available = token_state["capital_available"]
    urgency_label, urgency_tone = _resolve_investment_badge(tokenized_asset)
    participants_estimate = _estimate_participants(tokenized_asset)
    holding_quantity = holding_quantity or 0
    total_invested = total_invested or Decimal("0.00")
    user_participation_pct = (
        Decimal(holding_quantity) / Decimal(total_tokens) * Decimal("100")
        if total_tokens and holding_quantity
        else Decimal("0.00")
    )

    return {
        "asset": asset,
        "image_path": _asset_image_path(asset),
        "total_tokens": total_tokens,
        "tokens_available": tokens_available,
        "tokens_sold": tokens_sold,
        "progress_percent": progress_percent,
        "funding_percent": progress_percent,
        "capital_raised": capital_raised,
        "capital_available": capital_available,
        "capital_remaining": capital_available,
        "participants_estimate": participants_estimate,
        "urgency_label": urgency_label,
        "urgency_tone": urgency_tone,
        "available_investment_total": capital_available,
        "token_face_value_cop": token_state["token_face_value_cop"],
        "token_price_cop": tokenized_asset.token_price,
        "holding_quantity": holding_quantity,
        "total_invested": total_invested,
        "is_validated": holding_quantity > 0,
        "user_participation_pct": user_participation_pct.quantize(Decimal("0.01")),
        "status_label": (
            "Finalizado"
            if tokens_available <= 0
            else "En proceso"
            if tokens_sold > 0
            else "Disponible"
        ),
        "status_tone": (
            "finalized"
            if tokens_available <= 0
            else "progress"
            if tokens_sold > 0
            else "available"
        ),
        "flow_duration": round(max(0.7, 1.8 - (progress_percent * 0.01)), 2),
        "flow_intensity": round(min(1, 0.45 + ((tokens_sold / total_tokens) * 0.55 if total_tokens else 0)), 2),
    }


def _serialize_wallet_snapshot(snapshot):
    return {
        "tokens_available": snapshot["tokens_available"],
        "equivalent_cop": f"{snapshot['equivalent_cop']:.0f}",
        "portfolio_assets": snapshot["portfolio_assets"],
        "total_invested": f"{snapshot['total_invested']:.0f}",
        "portfolio_value": f"{snapshot['portfolio_value']:.0f}",
        "estimated_return_pct": f"{snapshot['estimated_return_pct']:.2f}",
    }


def _serialize_asset_snapshot(snapshot):
    asset = snapshot["asset"]
    return {
        "code": asset.code,
        "name": asset.name,
        "tokens_available": snapshot["tokens_available"],
        "tokens_sold": snapshot["tokens_sold"],
        "total_tokens": snapshot["total_tokens"],
        "progress_percent": snapshot["progress_percent"],
        "capital_raised": f"{snapshot['capital_raised']:.0f}",
        "capital_available": f"{snapshot['capital_available']:.0f}",
        "capital_remaining": f"{snapshot['capital_available']:.0f}",
        "participants_estimate": snapshot["participants_estimate"],
        "urgency_label": snapshot["urgency_label"],
        "urgency_tone": snapshot["urgency_tone"],
        "holding_quantity": snapshot["holding_quantity"],
        "user_participation_pct": f"{snapshot['user_participation_pct']:.2f}",
        "status_label": snapshot["status_label"],
    }


def _serialize_contract(contract, blockchain_record):
    return {
        "contract_id": contract.contract_id,
        "certificate_id": contract.certificate_id,
        "tokens_acquired": contract.tokens_acquired,
        "participation_pct": f"{contract.participation_pct:.4f}",
        "investment_value_cop": f"{contract.investment_value_cop:.0f}",
        "estimated_return_pct": f"{contract.estimated_return_pct:.2f}",
        "issued_at": timezone.localtime(contract.issued_at).strftime("%Y-%m-%d %H:%M:%S"),
        "status": contract.get_status_display(),
        "tx_hash": blockchain_record.tx_hash,
        "block_id": blockchain_record.block_id,
        "contract_hash": blockchain_record.contract_hash,
        "blockchain_status": blockchain_record.get_status_display(),
        "confirmed_at": timezone.localtime(blockchain_record.confirmed_at).strftime("%Y-%m-%d %H:%M:%S"),
        "download_pdf_url": reverse("download_digital_certificate", args=[contract.certificate_id]),
    }


def _build_demo_wallet_address(user, suffix):
    digest = hashlib.sha1(f"{user.pk}:{suffix}:{user.username}".encode("utf-8")).hexdigest()
    return f"bc1q{digest[:4]}...{digest[-4:]}"


def _build_demo_hash(seed, prefix="bc1q", size=16):
    digest = hashlib.sha256(str(seed).encode("utf-8")).hexdigest()
    return f"{prefix}{digest[:4]}...{digest[-4:]}"[:size]


def _build_ledger_entry(transaction, user):
    asset = transaction.tokenized_asset.asset
    total_btc = (
        Decimal(transaction.total_amount) / Decimal(str(settings.AGROTECH_DEMO_BTC_COP))
        if settings.AGROTECH_DEMO_BTC_COP
        else Decimal("0")
    )
    blockchain_record = getattr(transaction, "blockchain_record", None)
    tx_hash = blockchain_record.tx_hash if blockchain_record else "bc1q" + hashlib.sha1(
        f"agt:{transaction.pk}:{asset.code}".encode("utf-8")
    ).hexdigest()[:4] + "..." + hashlib.sha1(f"agt:{transaction.pk}:{asset.code}".encode("utf-8")).hexdigest()[-4:]
    prev_hash_seed = f"prev:{max(transaction.pk - 1, 1)}:{asset.code}"
    block_id = blockchain_record.block_id if blockchain_record else f"AGT-BLK-{20480 + transaction.pk}"
    return {
        "id": f"user-{transaction.pk}",
        "block": block_id,
        "timestamp": timezone.localtime(transaction.created_at).strftime("%Y-%m-%d %H:%M:%S"),
        "time_label": timezone.localtime(transaction.created_at).strftime("%H:%M:%S"),
        "operation_type": "Compra AGT",
        "asset": asset.name,
        "asset_code": asset.code,
        "wallet_origin": _build_demo_wallet_address(user, "origin"),
        "wallet_destination": _build_demo_wallet_address(user, "dest"),
        "btc_amount": f"{total_btc.quantize(Decimal('0.000001')):.6f}",
        "agt_amount": transaction.quantity,
        "hash": tx_hash,
        "prev_hash": "bc1q" + hashlib.sha1(prev_hash_seed.encode("utf-8")).hexdigest()[:4] + "..." + hashlib.sha1(prev_hash_seed.encode("utf-8")).hexdigest()[-4:],
        "status": "confirmed",
        "status_label": "Confirmada",
        "is_mine": transaction.user_id == user.id,
    }


def _build_ledger_context(user):
    transactions = list(
        TokenTransaction.objects.select_related("tokenized_asset__asset")
        .filter(user=user, transaction_type=TokenTransaction.WALLET_BUY)
        .order_by("-created_at")[:12]
    )
    ledger_seed_entries = [
        _build_ledger_entry(transaction, user)
        for transaction in transactions
    ]
    ledger_asset_catalog = [
        {
            "code": asset.asset.code,
            "name": asset.asset.name,
        }
        for asset in (
            TokenizedAsset.objects.select_related("asset")
            .filter(asset__status=BiologicalAsset.AVAILABLE)
            .order_by("asset__display_order", "asset__name")
        )
    ]
    return {
        "ledger_seed_entries": ledger_seed_entries,
        "ledger_asset_catalog": ledger_asset_catalog,
    }


@ensure_csrf_cookie
def home(request):
    if request.method == "POST":
        auth_mode = request.POST.get("auth_mode", "login")

        if auth_mode == "register":
            register_form = RegisterForm(request.POST)
            login_form = LoginForm()
            if register_form.is_valid():
                full_name = register_form.cleaned_data["name"].strip()
                first_name, _, last_name = full_name.partition(" ")
                email = register_form.cleaned_data["email"]
                password = register_form.cleaned_data["password"]
                base_username = email.split("@")[0][:140] or "user"
                username = base_username
                suffix = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username[:130]}{suffix}"
                    suffix += 1

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name.strip(),
                    last_name=last_name.strip(),
                    is_active=True,
                    is_verified=True,
                )
                _ensure_investor_profile(user)
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                messages.success(request, "Cuenta creada correctamente. Ya puedes invertir en AgroTech.")
                return redirect("investor_panel")

            return render(
                request,
                "index-6.html",
                _build_home_context(
                    active_auth_mode="register",
                    login_form=login_form,
                    register_form=register_form,
                ),
            )

        login_form = LoginForm(request.POST)
        register_form = RegisterForm()
        if login_form.is_valid():
            email = login_form.cleaned_data["email"]
            password = login_form.cleaned_data["password"]
            user = _authenticate_with_email(email, password)
            if user:
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                if not login_form.cleaned_data.get("remember"):
                    request.session.set_expiry(0)
                _ensure_investor_profile(user)
                messages.success(request, f"Bienvenido, {user.first_name or user.username}.")
                return redirect("investor_panel")
            login_form.add_error(None, "Correo o contraseña incorrectos.")

        return render(
            request,
            "index-6.html",
            _build_home_context(
                active_auth_mode="login",
                login_form=login_form,
                register_form=register_form,
            ),
        )

    return render(request, "index-6.html", _build_home_context())


def _resolve_demo_investor():
    user, created = User.objects.get_or_create(
        username="demo_investor",
        defaults={
            "email": "demo_investor@agrotech.demo",
            "first_name": "Demo",
            "last_name": "Investor",
            "is_active": True,
            "is_verified": True,
        },
    )
    if created:
        user.set_unusable_password()
        user.save(update_fields=["password"])

    _ensure_investor_profile(user)
    return user


@ensure_csrf_cookie
def asset_detail(request, code):
    asset = get_object_or_404(
        BiologicalAsset.objects.select_related("producer", "farm", "category", "tokenization"),
        code=code,
    )
    tokenized_asset = asset.tokenization
    related_assets = (
        BiologicalAsset.objects.select_related("producer", "farm", "tokenization")
        .filter(is_featured=True, status=BiologicalAsset.AVAILABLE)
        .exclude(pk=asset.pk)
        .order_by("display_order")[:3]
    )
    wallet_snapshot = None
    user_position = None
    latest_contract = None
    latest_blockchain_record = None
    asset_transactions = (
        TokenTransaction.objects.select_related("user")
        .filter(tokenized_asset=tokenized_asset)
        .order_by("-created_at")[:6]
    )
    status_history = asset.status_history.select_related("changed_by").order_by("-changed_at")[:4]

    if request.user.is_authenticated:
        portfolio = (
            TokenHolding.objects.select_related("tokenized_asset__asset")
            .filter(user=request.user)
            .order_by("-updated_at")
        )
        transactions = (
            TokenTransaction.objects.select_related("tokenized_asset__asset")
            .filter(user=request.user)
            .order_by("-created_at")
        )
        wallet_snapshot = _build_wallet_snapshot(request.user, portfolio=portfolio, transactions=transactions)
        user_holding = portfolio.filter(tokenized_asset=tokenized_asset).first()
        user_total_invested = (
            transactions.filter(tokenized_asset=tokenized_asset)
            .aggregate(total=Sum("total_amount"))
            .get("total")
            or Decimal("0.00")
        )
        user_position = _build_asset_snapshot(
            tokenized_asset,
            user=request.user,
            holding_quantity=user_holding.quantity if user_holding else 0,
            total_invested=user_total_invested,
        )
        latest_contract = (
            DigitalContract.objects.select_related("blockchain_record")
            .filter(user=request.user, tokenized_asset=tokenized_asset)
            .order_by("-issued_at")
            .first()
        )
        latest_blockchain_record = getattr(latest_contract, "blockchain_record", None) if latest_contract else None

    asset_snapshot = _build_asset_snapshot(tokenized_asset)
    context = {
        "asset": asset,
        "asset_snapshot": asset_snapshot,
        "asset_map": _asset_map_context(asset),
        "asset_image_path": _asset_image_path(asset),
        "agrotech_token_price_cop": settings.AGROTECH_TOKEN_PRICE_COP,
        "paypal_client_id": settings.PAYPAL_CLIENT_ID,
        "wallet_snapshot": wallet_snapshot,
        "user_position": user_position,
        "latest_contract": latest_contract,
        "latest_blockchain_record": latest_blockchain_record,
        "asset_transactions": asset_transactions,
        "status_history": status_history,
        "related_assets": [
            {
                "asset": related_asset,
                "image_path": _asset_image_path(related_asset),
            }
            for related_asset in related_assets
        ],
    }
    return render(request, "asset-detail.html", context)


@require_POST
def purchase_asset_tokens(request, code):
    asset = get_object_or_404(
        BiologicalAsset.objects.select_related("tokenization"),
        code=code,
    )

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"success": False, "message": "Solicitud invalida."}, status=400)

    quantity = int(payload.get("quantity", 0) or 0)
    paypal_order_id = str(payload.get("paypal_order_id", "")).strip()
    payment_method = str(payload.get("payment_method", "simulated")).strip() or "simulated"

    if quantity <= 0:
        return JsonResponse({"success": False, "message": "La cantidad debe ser mayor que cero."}, status=400)

    if payment_method == "paypal" and not paypal_order_id:
        return JsonResponse({"success": False, "message": "No se recibio la referencia de PayPal."}, status=400)

    buyer = request.user if request.user.is_authenticated else _resolve_demo_investor()
    result = buy_tokens(buyer, asset.tokenization, quantity)

    status_code = 200 if result.success else 400
    return JsonResponse(
        {
            "success": result.success,
            "message": result.message,
            "buyer": buyer.username,
            "payment_method": payment_method,
            "paypal_order_id": paypal_order_id,
            "tokens_available": result.tokens_available,
            "total_cost": f"{result.total_cost:.2f}" if result.total_cost is not None else None,
            "participation": result.participation,
        },
        status=status_code,
    )


@login_required
@require_POST
def invest_asset_tokens(request, code):
    tokenized_asset = get_object_or_404(
        TokenizedAsset.objects.select_related("asset", "asset__producer", "asset__farm", "asset__category"),
        asset__code=code,
    )

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({"success": False, "message": "Solicitud invalida."}, status=400)

    quantity = int(payload.get("quantity", 0) or 0)
    result = invest_with_agt_wallet(request.user, tokenized_asset, quantity)
    if not result.success:
        return JsonResponse(
            {
                "success": False,
                "message": result.message,
                "tokens_available": result.tokens_available,
                "wallet_tokens": getattr(result.wallet, "agt_balance", None),
            },
            status=400,
        )

    portfolio = _investment_holdings_queryset(request.user)
    transactions = _investment_transactions_queryset(request.user)
    wallet_snapshot = _build_wallet_snapshot(request.user, portfolio=portfolio, transactions=transactions)
    asset_snapshot = _build_asset_snapshot(
        tokenized_asset,
        user=request.user,
        holding_quantity=result.holding.quantity if result.holding else 0,
        total_invested=(
            transactions.filter(tokenized_asset=tokenized_asset)
            .aggregate(total=Sum("total_amount"))
            .get("total")
            or Decimal("0.00")
        ),
    )

    response = {
        "success": True,
        "message": "Tu inversión quedó respaldada por un contrato digital de copropiedad.",
        "wallet": _serialize_wallet_snapshot(wallet_snapshot),
        "asset": _serialize_asset_snapshot(asset_snapshot),
        "contract": _serialize_contract(result.digital_contract, result.blockchain_record),
        "position": {
            "holding_quantity": result.holding.quantity if result.holding else quantity,
            "participation_pct": f"{Decimal(result.holding.participation * 100).quantize(Decimal('0.01')) if result.holding else Decimal('0.00'):.2f}",
            "total_invested": f"{asset_snapshot['total_invested']:.0f}",
        },
        "transaction": {
            "quantity": quantity,
            "total_amount": f"{result.total_cost:.0f}" if result.total_cost is not None else "0",
            "created_at": timezone.localtime(result.transaction.created_at).strftime("%Y-%m-%d %H:%M:%S"),
        },
    }
    return JsonResponse(response)


@login_required
@ensure_csrf_cookie
def investor_panel(request):
    available_assets = list(
        TokenizedAsset.objects.select_related("asset", "asset__producer", "asset__farm", "asset__category")
        .filter(asset__status=BiologicalAsset.AVAILABLE)
        .order_by("asset__display_order", "asset__name")
    )
    total_available_tokens = sum(
        _get_effective_token_state(asset)["tokens_available"]
        for asset in available_assets
    )
    total_available_capital = sum(
        _get_effective_token_state(asset)["capital_available"]
        for asset in available_assets
    )
    selected_asset_code = (
        request.POST.get("selected_asset_code")
        or request.GET.get("asset")
        or ""
    ).strip()
    selected_asset = next(
        (asset for asset in available_assets if asset.asset.code == selected_asset_code),
        None,
    ) or next((asset for asset in available_assets if asset.tokens_available > 0), None) or (available_assets[0] if available_assets else None)

    if not selected_asset:
        return render(
            request,
            "investor-panel.html",
            {
                "panel_form": InvestorPanelForm(),
                "selected_asset": None,
                "portfolio": [],
                "transactions": [],
            },
        )

    calculation = None
    purchase_result = None
    default_initial = {"btc_amount": _build_default_btc_amount(selected_asset)}

    if request.method == "POST":
        panel_form = InvestorPanelForm(request.POST)
        if panel_form.is_valid():
            calculation = _build_investor_quote(panel_form.cleaned_data["btc_amount"], selected_asset)
            panel_action = request.POST.get("panel_action", "calculate")

            if panel_action == "buy":
                if calculation["estimated_tokens"] < 1:
                    panel_form.add_error("btc_amount", "El monto ingresado no alcanza para comprar 1 token AGT.")
                elif calculation["estimated_tokens"] > total_available_tokens:
                    panel_form.add_error(
                        "btc_amount",
                        f"Solo hay {total_available_tokens} tokens AGT disponibles en los activos abiertos.",
                    )
                else:
                    top_up_result = top_up_wallet(request.user, calculation["estimated_tokens"])
                    if top_up_result.success:
                        _store_linked_card(
                            request,
                            holder_name=request.POST.get("linked_card_holder", ""),
                            last4=request.POST.get("linked_card_last4", ""),
                        )
                        messages.success(request, "Recarga AGT registrada correctamente en tu wallet.")
                        return redirect(f"{reverse('investor_panel')}?asset={selected_asset.asset.code}")
                    else:
                        panel_form.add_error("btc_amount", top_up_result.message)
    else:
        panel_form = InvestorPanelForm(initial=default_initial)
        calculation = _build_investor_quote(default_initial["btc_amount"], selected_asset)

    portfolio = _investment_holdings_queryset(request.user)
    transactions = _investment_transactions_queryset(request.user)[:8]
    latest_transaction = transactions.first()
    summary_asset = latest_transaction.tokenized_asset if latest_transaction else None
    summary_holding = None
    summary_total_invested = Decimal("0.00")

    if summary_asset:
        summary_holding = portfolio.filter(tokenized_asset=summary_asset).first()
        summary_total_invested = (
            TokenTransaction.objects.filter(
                user=request.user,
                tokenized_asset=summary_asset,
                transaction_type=TokenTransaction.WALLET_BUY,
            )
            .aggregate(total=Sum("total_amount"))
            .get("total")
            or Decimal("0.00")
        )
    summary_participation_pct = (
        Decimal(summary_holding.participation * 100).quantize(Decimal("0.01"))
        if summary_holding
        else Decimal("0.00")
    )
    selected_asset_holding = portfolio.filter(tokenized_asset=selected_asset).first()
    selected_asset_total_invested = (
        TokenTransaction.objects.filter(
            user=request.user,
            tokenized_asset=selected_asset,
            transaction_type=TokenTransaction.WALLET_BUY,
        )
        .aggregate(total=Sum("total_amount"))
        .get("total")
        or Decimal("0.00")
    )
    holding_quantity_by_asset = {
        holding.tokenized_asset.asset.code: holding.quantity
        for holding in portfolio
    }
    invested_totals_by_asset = {
        item["tokenized_asset__asset__code"]: item["total"] or Decimal("0.00")
        for item in (
            TokenTransaction.objects.filter(user=request.user, transaction_type=TokenTransaction.WALLET_BUY)
            .values("tokenized_asset__asset__code")
            .annotate(total=Sum("total_amount"))
        )
    }

    opportunity_assets = list(
        TokenizedAsset.objects.select_related("asset", "asset__producer", "asset__farm", "asset__category")
        .filter(asset__is_featured=True, asset__status=BiologicalAsset.AVAILABLE)
        .order_by("asset__display_order", "asset__estimated_sale_date")[:8]
    )
    if selected_asset and all(item.pk != selected_asset.pk for item in opportunity_assets):
        opportunity_assets = [selected_asset, *opportunity_assets[:7]]
    wallet_snapshot = _build_wallet_snapshot(request.user, portfolio=portfolio, transactions=transactions)
    portfolio_balance_cop = wallet_snapshot["portfolio_value"]
    portfolio_balance_btc = Decimal("0.000000")
    wallet_balance_cop = wallet_snapshot["equivalent_cop"]
    wallet_balance_btc = Decimal("0.000000")
    if Decimal(str(settings.AGROTECH_DEMO_BTC_COP or 0)) > 0:
        portfolio_balance_btc = (
            portfolio_balance_cop / Decimal(str(settings.AGROTECH_DEMO_BTC_COP))
        ).quantize(Decimal("0.000001"), rounding=ROUND_DOWN)
        wallet_balance_btc = (
            wallet_balance_cop / Decimal(str(settings.AGROTECH_DEMO_BTC_COP))
        ).quantize(Decimal("0.000001"), rounding=ROUND_DOWN)
    portfolio_tokens = sum(holding.quantity for holding in portfolio)
    holder_name = request.user.get_full_name().strip() or request.user.username.upper()
    linked_card = _get_linked_card(request)
    wallet_has_balance = wallet_snapshot["tokens_available"] > 0
    wallet_has_display_card = bool(linked_card) or wallet_has_balance
    selected_contract = (
        DigitalContract.objects.select_related("blockchain_record")
        .filter(
            user=request.user,
            tokenized_asset=selected_asset,
            transaction__transaction_type=TokenTransaction.WALLET_BUY,
        )
        .order_by("-issued_at")
        .first()
    )
    selected_blockchain_record = getattr(selected_contract, "blockchain_record", None) if selected_contract else None
    selected_asset_snapshot = _build_asset_snapshot(
        selected_asset,
        user=request.user,
        holding_quantity=selected_asset_holding.quantity if selected_asset_holding else 0,
        total_invested=selected_asset_total_invested,
    )
    recent_contracts = (
        DigitalContract.objects.select_related("tokenized_asset__asset", "blockchain_record")
        .filter(user=request.user, transaction__transaction_type=TokenTransaction.WALLET_BUY)
        .order_by("-issued_at")[:5]
    )
    context = {
        "panel_form": panel_form,
        "selected_asset": selected_asset,
        "calculation": calculation,
        "purchase_result": purchase_result,
        "portfolio": portfolio,
        "transactions": transactions,
        "agrotech_token_price_cop": settings.AGROTECH_TOKEN_PRICE_COP,
        "demo_btc_usd_rate": settings.AGROTECH_DEMO_BTC_USD,
        "demo_btc_cop_rate": settings.AGROTECH_DEMO_BTC_COP,
        "total_available_tokens": total_available_tokens,
        "total_available_capital": total_available_capital,
        "total_available_capital_compact": _format_compact_millions(total_available_capital),
        "wallet_balance_cop": wallet_balance_cop,
        "wallet_balance_btc": wallet_balance_btc,
        "portfolio_balance_cop": portfolio_balance_cop,
        "portfolio_balance_btc": portfolio_balance_btc,
        "portfolio_tokens": portfolio_tokens,
        "holder_name": holder_name,
        "linked_card": linked_card,
        "wallet_has_display_card": wallet_has_display_card,
        "wallet_snapshot": wallet_snapshot,
        "summary_asset": summary_asset,
        "summary_holding": summary_holding,
        "summary_total_invested": summary_total_invested,
        "summary_participation_pct": summary_participation_pct,
        "latest_transaction": latest_transaction,
        "selected_asset_code": selected_asset.asset.code,
        "selected_asset_holding": selected_asset_holding,
        "selected_asset_total_invested": selected_asset_total_invested,
        "selected_asset_snapshot": selected_asset_snapshot,
        "selected_contract": selected_contract,
        "selected_blockchain_record": selected_blockchain_record,
        "recent_contracts": recent_contracts,
        "opportunity_assets": [
            {
                **_build_asset_snapshot(
                    asset,
                    user=request.user,
                    holding_quantity=holding_quantity_by_asset.get(asset.asset.code, 0),
                    total_invested=invested_totals_by_asset.get(asset.asset.code, Decimal("0.00")),
                ),
                "is_selected": asset.asset.code == selected_asset.asset.code,
                "has_high_demand": _resolve_investment_badge(asset)[1] in {"hot", "almost"},
            }
            for asset in opportunity_assets
        ],
    }
    return render(request, "investor-panel.html", context)


@login_required
def download_digital_certificate(request, certificate_id):
    contract = get_object_or_404(
        DigitalContract.objects.select_related(
            "user",
            "tokenized_asset__asset__farm",
            "blockchain_record",
        ),
        user=request.user,
        certificate_id=certificate_id,
    )
    blockchain_record = getattr(contract, "blockchain_record", None)
    if blockchain_record is None:
        return HttpResponse("El certificado aun no tiene confirmacion en blockchain.", status=409)

    pdf_bytes = build_contract_certificate_pdf(contract, blockchain_record)
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{contract.certificate_id}.pdf"'
    return response


@login_required
@ensure_csrf_cookie
def blockchain_ledger(request):
    context = {
        **_build_ledger_context(request.user),
    }
    return render(request, "blockchain-ledger.html", context)
