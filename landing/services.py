from dataclasses import dataclass
from decimal import Decimal
import hashlib
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import BlockchainRecord, DigitalContract, TokenHolding, TokenTransaction, TokenizedAsset, Wallet


@dataclass
class BuyTokensResult:
    success: bool
    message: str
    holding: TokenHolding | None = None
    transaction: TokenTransaction | None = None
    tokens_available: int | None = None
    total_cost: Decimal | None = None
    participation: float | None = None
    wallet: Wallet | None = None
    digital_contract: DigitalContract | None = None
    blockchain_record: BlockchainRecord | None = None


def ensure_wallet(user):
    wallet, created = Wallet.objects.get_or_create(
        user=user,
        defaults={"agt_balance": settings.AGROTECH_DEMO_WALLET_TOKENS},
    )
    if created:
        return wallet
    return wallet


def top_up_wallet(user, quantity):
    if quantity <= 0:
        return BuyTokensResult(success=False, message="La cantidad debe ser mayor que cero.")

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().filter(user=user).first()
        if not wallet:
            wallet = Wallet.objects.create(user=user, agt_balance=settings.AGROTECH_DEMO_WALLET_TOKENS)

        wallet.agt_balance += quantity
        wallet.save(update_fields=["agt_balance", "updated_at"])

        return BuyTokensResult(
            success=True,
            message="Recarga AGT realizada correctamente.",
            wallet=wallet,
        )


def buy_tokens(user, tokenized_asset, quantity):
    if quantity <= 0:
        return BuyTokensResult(success=False, message="La cantidad debe ser mayor que cero.")

    with transaction.atomic():
        locked_asset = (
            TokenizedAsset.objects.select_for_update()
            .select_related("asset")
            .get(pk=tokenized_asset.pk)
        )

        if quantity > locked_asset.tokens_available:
            return BuyTokensResult(
                success=False,
                message="No hay suficientes tokens disponibles.",
                tokens_available=locked_asset.tokens_available,
            )

        total_cost = locked_asset.token_price * quantity
        locked_asset.tokens_available -= quantity
        locked_asset.save(update_fields=["tokens_available", "updated_at"])

        business_asset = locked_asset.asset
        business_asset.available_units = locked_asset.tokens_available
        business_asset.save(update_fields=["available_units", "updated_at"])

        holding, created = TokenHolding.objects.select_for_update().get_or_create(
            user=user,
            tokenized_asset=locked_asset,
            defaults={"quantity": quantity},
        )

        if not created:
            holding.quantity += quantity
            holding.save(update_fields=["quantity", "updated_at"])

        transaction_record = TokenTransaction.objects.create(
            user=user,
            tokenized_asset=locked_asset,
            quantity=quantity,
            price_per_token=locked_asset.token_price,
            total_amount=total_cost,
            transaction_type=TokenTransaction.BUY,
        )

        contract_id, certificate_id = _build_contract_identifiers(locked_asset, transaction_record.pk)
        digital_contract = DigitalContract.objects.create(
            user=user,
            tokenized_asset=locked_asset,
            transaction=transaction_record,
            contract_id=contract_id,
            certificate_id=certificate_id,
            tokens_acquired=quantity,
            participation_pct=Decimal(holding.participation * 100).quantize(Decimal("0.0001")),
            investment_value_cop=total_cost,
            estimated_return_pct=locked_asset.asset.estimated_return_pct,
            status=DigitalContract.ACTIVE,
            issued_at=timezone.now(),
        )

        tx_hash, contract_hash, block_id = _build_blockchain_values(user, locked_asset, quantity, total_cost)
        blockchain_record = BlockchainRecord.objects.create(
            transaction=transaction_record,
            digital_contract=digital_contract,
            tx_hash=tx_hash,
            block_id=block_id,
            contract_hash=contract_hash,
            status=BlockchainRecord.CONFIRMED,
            confirmed_at=timezone.now(),
        )

        return BuyTokensResult(
            success=True,
            message="Compra realizada correctamente.",
            holding=holding,
            transaction=transaction_record,
            tokens_available=locked_asset.tokens_available,
            total_cost=total_cost,
            participation=holding.participation,
            digital_contract=digital_contract,
            blockchain_record=blockchain_record,
        )


def _build_contract_identifiers(tokenized_asset, transaction_id):
    year = timezone.localdate().year
    contract_id = f"AGR-{tokenized_asset.asset.code}-SHARE-{year}-{transaction_id:04d}"
    certificate_id = f"CERT-{tokenized_asset.asset.code}-{year}-{transaction_id:04d}"
    return contract_id, certificate_id


def _build_blockchain_values(user, tokenized_asset, quantity, total_cost):
    now = timezone.now()
    payload = "|".join(
        [
            str(user.pk),
            tokenized_asset.asset.code,
            str(quantity),
            f"{total_cost:.2f}",
            now.isoformat(),
            secrets.token_hex(6),
        ]
    )
    tx_hash = "0x" + hashlib.sha256((payload + "|tx").encode("utf-8")).hexdigest().upper()
    contract_hash = "0x" + hashlib.sha256((payload + "|contract").encode("utf-8")).hexdigest().upper()
    block_suffix = int(hashlib.sha1((payload + "|block").encode("utf-8")).hexdigest(), 16) % 90000 + 10000
    block_id = f"AGT-BLK-{block_suffix}"
    return tx_hash[:34], contract_hash[:34], block_id


def invest_with_agt_wallet(user, tokenized_asset, quantity):
    if quantity <= 0:
        return BuyTokensResult(success=False, message="Debes ingresar al menos 1 token AGT.")

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().filter(user=user).first()
        if not wallet:
            wallet = Wallet.objects.create(user=user, agt_balance=settings.AGROTECH_DEMO_WALLET_TOKENS)

        locked_asset = (
            TokenizedAsset.objects.select_for_update()
            .select_related("asset")
            .get(pk=tokenized_asset.pk)
        )

        if wallet.agt_balance <= 0:
            return BuyTokensResult(success=False, message="Tu wallet AGT no tiene saldo disponible.", wallet=wallet)

        if quantity > wallet.agt_balance:
            return BuyTokensResult(
                success=False,
                message="No tienes suficientes tokens AGT en tu wallet para completar la operacion.",
                wallet=wallet,
            )

        if locked_asset.tokens_available <= 0:
            return BuyTokensResult(
                success=False,
                message="Este activo ya se encuentra completado y no tiene tokens disponibles.",
                wallet=wallet,
            )

        if quantity > locked_asset.tokens_available:
            return BuyTokensResult(
                success=False,
                message="La cantidad supera los tokens disponibles en este activo.",
                tokens_available=locked_asset.tokens_available,
                wallet=wallet,
            )

        total_cost = locked_asset.token_price * quantity
        wallet.agt_balance -= quantity
        wallet.save(update_fields=["agt_balance", "updated_at"])

        locked_asset.tokens_available -= quantity
        locked_asset.save(update_fields=["tokens_available", "updated_at"])

        business_asset = locked_asset.asset
        business_asset.available_units = locked_asset.tokens_available
        if locked_asset.tokens_available <= 0 and business_asset.status == business_asset.AVAILABLE:
            business_asset.status = business_asset.FUNDED
            business_asset.save(update_fields=["available_units", "status", "updated_at"])
        else:
            business_asset.save(update_fields=["available_units", "updated_at"])

        holding, created = TokenHolding.objects.select_for_update().get_or_create(
            user=user,
            tokenized_asset=locked_asset,
            defaults={"quantity": quantity},
        )
        if not created:
            holding.quantity += quantity
            holding.save(update_fields=["quantity", "updated_at"])

        transaction_record = TokenTransaction.objects.create(
            user=user,
            tokenized_asset=locked_asset,
            quantity=quantity,
            price_per_token=locked_asset.token_price,
            total_amount=total_cost,
            transaction_type=TokenTransaction.WALLET_BUY,
        )

        contract_id, certificate_id = _build_contract_identifiers(locked_asset, transaction_record.pk)
        digital_contract = DigitalContract.objects.create(
            user=user,
            tokenized_asset=locked_asset,
            transaction=transaction_record,
            contract_id=contract_id,
            certificate_id=certificate_id,
            tokens_acquired=quantity,
            participation_pct=Decimal(holding.participation * 100).quantize(Decimal("0.0001")),
            investment_value_cop=total_cost,
            estimated_return_pct=locked_asset.asset.estimated_return_pct,
            status=DigitalContract.ACTIVE,
            issued_at=timezone.now(),
        )

        tx_hash, contract_hash, block_id = _build_blockchain_values(user, locked_asset, quantity, total_cost)
        blockchain_record = BlockchainRecord.objects.create(
            transaction=transaction_record,
            digital_contract=digital_contract,
            tx_hash=tx_hash,
            block_id=block_id,
            contract_hash=contract_hash,
            status=BlockchainRecord.CONFIRMED,
            confirmed_at=timezone.now(),
        )

        return BuyTokensResult(
            success=True,
            message="Participacion adquirida correctamente.",
            holding=holding,
            transaction=transaction_record,
            tokens_available=locked_asset.tokens_available,
            total_cost=total_cost,
            participation=holding.participation,
            wallet=wallet,
            digital_contract=digital_contract,
            blockchain_record=blockchain_record,
        )
