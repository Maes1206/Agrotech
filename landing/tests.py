from decimal import Decimal

from django.test import TestCase
from django.urls import reverse

from .models import (
    AssetCategory,
    BiologicalAsset,
    Farm,
    Producer,
    TokenHolding,
    TokenTransaction,
    TokenizedAsset,
    User,
    UserProfile,
)
from .services import buy_tokens


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

    def test_investor_panel_buy_updates_portfolio(self):
        self.client.login(username="paneluser", password="ClaveSegura123*")
        response = self.client.post(
            reverse("investor_panel"),
            data={"btc_amount": "0.05000", "panel_action": "buy"},
        )

        self.assertEqual(response.status_code, 200)
        self.tokenized_asset.refresh_from_db()
        self.asset.refresh_from_db()
        self.assertEqual(self.tokenized_asset.tokens_available, 74)
        self.assertEqual(self.asset.available_units, 74)
        self.assertTrue(TokenHolding.objects.filter(user=self.user, tokenized_asset=self.tokenized_asset, quantity=26).exists())
        self.assertEqual(TokenTransaction.objects.filter(user=self.user).count(), 1)
