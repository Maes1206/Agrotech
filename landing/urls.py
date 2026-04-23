from django.urls import path

from .views import (
    asset_detail,
    blockchain_ledger,
    download_digital_certificate,
    home,
    invest_asset_tokens,
    investor_panel,
    purchase_asset_tokens,
    wallet_nfc_payload,
    wallet_nfc_sync,
)


urlpatterns = [
    path('', home, name='home'),
    path('activos/<str:code>/', asset_detail, name='asset_detail'),
    path('activos/<str:code>/comprar/', purchase_asset_tokens, name='purchase_asset_tokens'),
    path('activos/<str:code>/invertir/', invest_asset_tokens, name='invest_asset_tokens'),
    path('panel/blockchain/', blockchain_ledger, name='blockchain_ledger'),
    path('panel/certificados/<str:certificate_id>/pdf/', download_digital_certificate, name='download_digital_certificate'),
    path('panel/inversionista/', investor_panel, name='investor_panel'),
    path('panel/wallet-fisica/nfc/payload/', wallet_nfc_payload, name='wallet_nfc_payload'),
    path('panel/wallet-fisica/nfc/sync/', wallet_nfc_sync, name='wallet_nfc_sync'),
]
