from django.db import migrations


HUILA_FARMS = {
    "FARM-001": {
        "municipality": "Palermo",
        "department": "Huila",
        "location": "Vereda Buenos Aires, corredor Neiva-Palermo",
    },
    "FARM-002": {
        "municipality": "Campoalegre",
        "department": "Huila",
        "location": "Vereda La Vega, zona rural de Campoalegre",
    },
    "FARM-003": {
        "municipality": "Garzon",
        "department": "Huila",
        "location": "Vereda El Recreo, corredor Garzon-Agrado",
    },
}


LEGACY_FARMS = {
    "FARM-001": {
        "municipality": "Monteria",
        "department": "Cordoba",
        "location": "Km 14 via Cerete",
    },
    "FARM-002": {
        "municipality": "Sincelejo",
        "department": "Sucre",
        "location": "Corregimiento La Arena",
    },
    "FARM-003": {
        "municipality": "Planeta Rica",
        "department": "Cordoba",
        "location": "Vereda Nueva Union",
    },
}


def move_farms_to_huila(apps, schema_editor):
    Farm = apps.get_model("landing", "Farm")
    for code, values in HUILA_FARMS.items():
        Farm.objects.filter(code=code).update(**values)


def restore_legacy_farms(apps, schema_editor):
    Farm = apps.get_model("landing", "Farm")
    for code, values in LEGACY_FARMS.items():
        Farm.objects.filter(code=code).update(**values)


class Migration(migrations.Migration):

    dependencies = [
        ("landing", "0005_digitalcontract_blockchainrecord_wallet"),
    ]

    operations = [
        migrations.RunPython(move_farms_to_huila, restore_legacy_farms),
    ]
