from django.urls import path

from .views import asset_detail, blockchain_ledger, home, invest_asset_tokens, investor_panel, purchase_asset_tokens


urlpatterns = [
    path('', home, name='home'),
    path('activos/<str:code>/', asset_detail, name='asset_detail'),
    path('activos/<str:code>/comprar/', purchase_asset_tokens, name='purchase_asset_tokens'),
    path('activos/<str:code>/invertir/', invest_asset_tokens, name='invest_asset_tokens'),
    path('panel/blockchain/', blockchain_ledger, name='blockchain_ledger'),
    path('panel/inversionista/', investor_panel, name='investor_panel'),
]
