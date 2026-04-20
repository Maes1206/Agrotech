from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from .models import (
    AssetCategory,
    BiologicalAsset,
    DigitalContract,
    Farm,
    Producer,
    TokenHolding,
    TokenTransaction,
    TokenizedAsset,
    User,
    UserProfile,
    Wallet,
)
from .services import buy_tokens
from .views import _build_token_market_metrics


class BuyTokensServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="investor01",
            email="investor01@agrotech.demo",
            password="12345678",
        )
        self.producer = Producer.objects.create(
            name="Productor Demo",
            document="PD-001",
            phone="3000000000",
            email="productor@agrotech.demo",
        )
        self.farm = Farm.objects.create(
            producer=self.producer,
            code="FARM-T-01",
            name="Finca Token Demo",
            municipality="Monteria",
            department="Cordoba",
            location="Zona rural",
            hectares=Decimal("50.00"),
        )
        self.category = AssetCategory.objects.create(
            code="demo_lot",
            name="Lote Demo",
        )
        self.asset = BiologicalAsset.objects.create(
            code="ASSET-T-01",
            name="Activo Tokenizado Demo",
            asset_type=BiologicalAsset.LOT,
            category=self.category,
            producer=self.producer,
            farm=self.farm,
            initial_weight=Decimal("400.00"),
            current_weight=Decimal("450.00"),
            initial_value=Decimal("1000000.00"),
            projected_value=Decimal("1200000.00"),
            estimated_return_pct=Decimal("20.00"),
            start_date="2026-04-01",
            estimated_sale_date="2026-10-01",
            tokenized_units=100,
            available_units=100,
            is_featured=True,
        )
        self.tokenized_asset = TokenizedAsset.objects.create(
            asset=self.asset,
            total_tokens=100,
            tokens_available=100,
            token_price=Decimal("10000.00"),
        )

    def test_buy_tokens_successfully_creates_holding_and_transaction(self):
        result = buy_tokens(self.user, self.tokenized_asset, 5)

        self.assertTrue(result.success)
        self.assertEqual(result.tokens_available, 95)
        self.assertEqual(result.total_cost, Decimal("50000.00"))

        holding = TokenHolding.objects.get(user=self.user, tokenized_asset=self.tokenized_asset)
        self.assertEqual(holding.quantity, 5)

        self.tokenized_asset.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(self.tokenized_asset.tokens_available, 95)
        self.assertEqual(self.asset.available_units, 95)
        self.assertEqual(TokenTransaction.objects.count(), 1)

    def test_buy_tokens_rejects_quantity_above_available(self):
        result = buy_tokens(self.user, self.tokenized_asset, 120)

        self.assertFalse(result.success)
        self.assertEqual(result.tokens_available, 100)
        self.assertEqual(TokenHolding.objects.count(), 0)
        self.assertEqual(TokenTransaction.objects.count(), 0)

    def test_purchase_endpoint_registers_demo_investor_purchase(self):
        response = self.client.post(
            f"/activos/{self.asset.code}/comprar/",
            data='{"quantity": 2, "payment_method": "simulated"}',
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["success"])
        self.assertEqual(payload["buyer"], "demo_investor")
        self.assertEqual(payload["payment_method"], "simulated")

        self.tokenized_asset.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(self.tokenized_asset.tokens_available, 98)
        self.assertEqual(self.asset.available_units, 98)


class AuthenticationFlowTests(TestCase):
    def test_register_creates_user_and_investor_profile(self):
        response = self.client.post(
            reverse("home"),
            data={
                "auth_mode": "register",
                "name": "Laura Perez",
                "email": "laura@agrotech.demo",
                "password": "ClaveSegura123*",
            },
        )

        self.assertEqual(response.status_code, 302)
        user = User.objects.get(email="laura@agrotech.demo")
        self.assertEqual(user.first_name, "Laura")
        self.assertTrue(UserProfile.objects.filter(user=user, status=UserProfile.ACTIVE).exists())
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.id)

    def test_login_with_email_and_password(self):
        user = User.objects.create_user(
            username="maria",
            email="maria@agrotech.demo",
            password="ClaveSegura123*",
            first_name="Maria",
        )
        user.profile.status = UserProfile.ACTIVE
        user.profile.save(update_fields=["status", "updated_at"])

        response = self.client.post(
            reverse("home"),
            data={
                "auth_mode": "login",
                "email": "maria@agrotech.demo",
                "password": "ClaveSegura123*",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.id)


class InvestorPanelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="paneluser",
            email="panel@agrotech.demo",
            password="ClaveSegura123*",
            first_name="Panel",
        )
        self.producer = Producer.objects.create(
            name="Productor Panel",
            document="PD-002",
            phone="3000000001",
            email="panel-productor@agrotech.demo",
        )
        self.farm = Farm.objects.create(
            producer=self.producer,
            code="FARM-P-01",
            name="Finca Panel",
            municipality="Monteria",
            department="Cordoba",
            location="Zona demo",
            hectares=Decimal("42.00"),
        )
        self.category = AssetCategory.objects.create(code="panel_lot", name="Lote Panel")
        self.asset = BiologicalAsset.objects.create(
            code="ASSET-P-01",
            name="Activo Panel",
            asset_type=BiologicalAsset.LOT,
            category=self.category,
            producer=self.producer,
            farm=self.farm,
            initial_weight=Decimal("410.00"),
            current_weight=Decimal("456.00"),
            initial_value=Decimal("2000000.00"),
            projected_value=Decimal("2400000.00"),
            estimated_return_pct=Decimal("18.00"),
            start_date="2026-05-01",
            estimated_sale_date="2026-11-01",
            tokenized_units=100,
            available_units=100,
            is_featured=True,
            display_order=1,
        )
        self.tokenized_asset = TokenizedAsset.objects.create(
            asset=self.asset,
            total_tokens=100,
            tokens_available=100,
            token_price=Decimal("500000.00"),
        )
        self.secondary_asset = BiologicalAsset.objects.create(
            code="ASSET-P-02",
            name="Activo Panel Secundario",
            asset_type=BiologicalAsset.INDIVIDUAL,
            category=self.category,
            producer=self.producer,
            farm=self.farm,
            initial_weight=Decimal("380.00"),
            current_weight=Decimal("401.00"),
            initial_value=Decimal("1800000.00"),
            projected_value=Decimal("2150000.00"),
            estimated_return_pct=Decimal("14.00"),
            start_date="2026-06-01",
            estimated_sale_date="2026-12-01",
            tokenized_units=80,
            available_units=80,
            is_featured=False,
            display_order=2,
        )
        self.secondary_tokenized_asset = TokenizedAsset.objects.create(
            asset=self.secondary_asset,
            total_tokens=80,
            tokens_available=80,
            token_price=Decimal("450000.00"),
        )

    def test_investor_panel_requires_login(self):
        response = self.client.get(reverse("investor_panel"))
        self.assertEqual(response.status_code, 302)

    def test_investor_panel_calculates_values(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        response = self.client.post(
            reverse("investor_panel"),
            data={"btc_amount": "0.05000", "panel_action": "calculate"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["calculation"]["estimated_tokens"], 26)

    def test_token_market_metrics_apply_fixed_face_value_to_mock_data(self):
        metrics = _build_token_market_metrics(total_tokens=40, tokens_sold=32)

        self.assertEqual(metrics["tokens_available"], 8)
        self.assertEqual(metrics["capital_available"], Decimal("800000"))

    def test_investor_panel_renders_dynamic_available_capital_in_cards(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")

        response = self.client.get(reverse("investor_panel"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-capital-available="10000000"')
        self.assertContains(response, "$10.000.000 COP")

    def test_investor_panel_buy_recharges_wallet_without_updating_portfolio(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        initial_wallet = Wallet.objects.get(user=self.user).agt_balance
        response = self.client.post(
            reverse("investor_panel"),
            data={"btc_amount": "0.05000", "panel_action": "buy"},
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], reverse("investor_panel") + f"?asset={self.asset.code}")
        self.tokenized_asset.refresh_from_db()
        self.asset.refresh_from_db()
        wallet = Wallet.objects.get(user=self.user)
        self.assertEqual(wallet.agt_balance, initial_wallet + 26)
        self.assertEqual(self.tokenized_asset.tokens_available, 100)
        self.assertEqual(self.asset.available_units, 100)
        self.assertFalse(TokenHolding.objects.filter(user=self.user, tokenized_asset=self.tokenized_asset).exists())
        self.assertEqual(TokenTransaction.objects.filter(user=self.user).count(), 0)
        self.assertEqual(DigitalContract.objects.filter(user=self.user).count(), 0)

    def test_investor_panel_buy_persists_linked_card_in_session(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")

        response = self.client.post(
            reverse("investor_panel"),
            data={
                "btc_amount": "0.05000",
                "panel_action": "buy",
                "linked_card_holder": "Panel User",
                "linked_card_last4": "4242",
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.session["agrotech_linked_card"], {"holder": "Panel User", "last4": "4242"})

    def test_investor_panel_buy_redirect_prevents_duplicate_top_up_on_refresh(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        initial_wallet = Wallet.objects.get(user=self.user).agt_balance

        post_response = self.client.post(
            reverse("investor_panel"),
            data={"btc_amount": "0.05000", "panel_action": "buy"},
        )

        self.assertEqual(post_response.status_code, 302)

        get_response = self.client.get(post_response.headers["Location"])

        self.assertEqual(get_response.status_code, 200)
        wallet = Wallet.objects.get(user=self.user)
        self.assertEqual(wallet.agt_balance, initial_wallet + 26)

    def test_investor_panel_renders_server_linked_card(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        session = self.client.session
        session["agrotech_linked_card"] = {"holder": "Panel User", "last4": "4242"}
        session.save()

        response = self.client.get(reverse("investor_panel"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-linked-last4="4242"')
        self.assertContains(response, "**** **** **** 4242")
        self.assertNotContains(response, 'class="wallet wallet--empty"')

    def test_investor_panel_keeps_wallet_visible_when_demo_balance_exists_without_session_card(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")

        response = self.client.get(reverse("investor_panel"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-has-display-card="true"')
        self.assertNotContains(response, 'class="wallet wallet--empty"')
        self.assertContains(response, "23 AGT")

    def test_investor_panel_shows_empty_wallet_only_when_balance_and_linked_card_are_missing(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        wallet = Wallet.objects.get(user=self.user)
        wallet.agt_balance = 0
        wallet.save(update_fields=["agt_balance", "updated_at"])

        response = self.client.get(reverse("investor_panel"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'class="wallet wallet--empty"')
        self.assertContains(response, "Sin tarjeta vinculada")

    def test_investor_panel_includes_selected_non_featured_asset_in_opportunities(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")

        response = self.client.get(reverse("investor_panel"), data={"asset": self.secondary_asset.code})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["selected_asset"].asset.code, self.secondary_asset.code)
        selected_cards = [
            item for item in response.context["opportunity_assets"]
            if item["asset"].code == self.secondary_asset.code
        ]
        self.assertEqual(len(selected_cards), 1)
        self.assertTrue(selected_cards[0]["is_selected"])

    def test_investor_panel_uses_total_available_tokens_when_selected_asset_is_exhausted(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        self.tokenized_asset.tokens_available = 0
        self.tokenized_asset.save(update_fields=["tokens_available", "updated_at"])

        response = self.client.get(reverse("investor_panel"), data={"asset": self.asset.code})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["total_available_tokens"], 80)
        self.assertContains(response, 'data-available-tokens="80"')
        self.assertContains(response, "Máximo disponible ahora: 80 tokens AGT en activos abiertos.")

    def test_investor_panel_summary_participation_is_expressed_as_percentage(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        buy_tokens(self.user, self.tokenized_asset, 26)

        response = self.client.get(reverse("investor_panel"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["summary_participation_pct"], Decimal("0.00"))

    def test_investor_panel_hides_btc_recharge_contract_traceability(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        contract_result = buy_tokens(self.user, self.tokenized_asset, 6)

        response = self.client.get(reverse("investor_panel"))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.context["selected_contract"])
        self.assertEqual(len(response.context["recent_contracts"]), 0)
        self.assertNotContains(response, contract_result.digital_contract.contract_id)
        self.assertContains(response, "Pendiente de inversión")

    def test_investor_panel_btc_recharge_does_not_expose_certificate_pdf_url(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")

        response = self.client.post(
            reverse("investor_panel"),
            data={"btc_amount": "0.05000", "panel_action": "buy"},
        )

        self.assertEqual(response.status_code, 302)
        response = self.client.get(response.headers["Location"])
        self.assertEqual(response.status_code, 200)
        self.assertFalse(DigitalContract.objects.filter(user=self.user).exists())
        self.assertContains(response, "Aún no has emitido certificados digitales de participación.")

    def test_download_digital_certificate_returns_pdf_for_owner(self):
        contract_result = buy_tokens(self.user, self.tokenized_asset, 5)
        self.client.login(username="paneluser", password="ClaveSegura123*")

        response = self.client.get(
            reverse("download_digital_certificate", args=[contract_result.digital_contract.certificate_id])
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_download_digital_certificate_is_not_available_to_other_users(self):
        contract_result = buy_tokens(self.user, self.tokenized_asset, 5)
        outsider = User.objects.create_user(
            username="outsider",
            email="outsider@agrotech.demo",
            password="ClaveSegura123*",
        )
        self.client.login(username=outsider.username, password="ClaveSegura123*")

        response = self.client.get(
            reverse("download_digital_certificate", args=[contract_result.digital_contract.certificate_id])
        )

        self.assertEqual(response.status_code, 404)
