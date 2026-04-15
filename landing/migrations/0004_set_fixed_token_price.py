from decimal import Decimal

from django.db import migrations


def set_fixed_token_price(apps, schema_editor):
    TokenizedAsset = apps.get_model("landing", "TokenizedAsset")
    TokenizedAsset.objects.all().update(token_price=Decimal("500000.00"))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0003_tokenizedasset_tokentransaction_tokenholding"),
    ]

    operations = [
        migrations.RunPython(set_fixed_token_price, noop_reverse),
    ]
