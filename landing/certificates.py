from io import BytesIO
from pathlib import Path

from django.conf import settings
from django.utils import timezone

from PIL import Image, ImageDraw, ImageFont


PAGE_SIZE = (1240, 1754)
PAGE_BACKGROUND = "#f7f8f2"
PANEL_BACKGROUND = "#ffffff"
BRAND_DARK = "#163320"
BRAND_GREEN = "#2d7b43"
BRAND_SOFT = "#e8f2ea"
TEXT_MUTED = "#66756c"
TEXT_MAIN = "#1d2c24"


def _load_font(size, bold=False):
    font_candidates = []
    if bold:
        font_candidates.extend(
            [
                "arialbd.ttf",
                "C:/Windows/Fonts/arialbd.ttf",
                "DejaVuSans-Bold.ttf",
            ]
        )
    else:
        font_candidates.extend(
            [
                "arial.ttf",
                "C:/Windows/Fonts/arial.ttf",
                "DejaVuSans.ttf",
            ]
        )

    for candidate in font_candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _wrap_text(draw, text, font, max_width):
    words = (text or "").split()
    if not words:
        return [""]

    lines = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_multiline(draw, text, font, fill, box, line_gap=8):
    left, top, right, _ = box
    lines = _wrap_text(draw, text, font, right - left)
    y = top
    line_height = getattr(font, "size", 20)
    for line in lines:
        draw.text((left, y), line, font=font, fill=fill)
        y += line_height + line_gap
    return y


def _draw_field(draw, label, value, box, label_font, value_font):
    left, top, right, bottom = box
    draw.rounded_rectangle(box, radius=26, fill=BRAND_SOFT)
    draw.text((left + 24, top + 18), label, font=label_font, fill=TEXT_MUTED)
    _draw_multiline(
        draw,
        value,
        value_font,
        TEXT_MAIN,
        (left + 24, top + 54, right - 24, bottom - 18),
        line_gap=6,
    )


def _load_brand_icon():
    icon_path = Path(settings.BASE_DIR) / "static" / "images" / "icons" / "icon.png"
    if not icon_path.exists():
        return None
    try:
        return Image.open(icon_path).convert("RGBA")
    except OSError:
        return None


def build_contract_certificate_pdf(contract, blockchain_record):
    user_name = contract.user.get_full_name().strip() or contract.user.username
    asset = contract.tokenized_asset.asset
    farm = getattr(asset, "farm", None)
    location = "-"
    if farm:
        location = f"{farm.name}, {farm.municipality}, {farm.department}"

    image = Image.new("RGB", PAGE_SIZE, PAGE_BACKGROUND)
    draw = ImageDraw.Draw(image)

    title_font = _load_font(54, bold=True)
    heading_font = _load_font(26, bold=True)
    body_font = _load_font(24)
    value_font = _load_font(28, bold=True)
    small_font = _load_font(19, bold=True)
    footer_font = _load_font(18)

    draw.rounded_rectangle((58, 54, PAGE_SIZE[0] - 58, PAGE_SIZE[1] - 54), radius=42, fill=PANEL_BACKGROUND)
    draw.rounded_rectangle((92, 92, PAGE_SIZE[0] - 92, 252), radius=36, fill=BRAND_DARK)
    draw.text((132, 128), "CERTIFICADO DIGITAL DE PARTICIPACION", font=small_font, fill="#b6ddb7")
    draw.text((132, 165), "Propiedad digital respaldada en blockchain", font=title_font, fill="#ffffff")

    icon = _load_brand_icon()
    if icon is not None:
        icon = icon.resize((150, 150))
        image.paste(icon, (PAGE_SIZE[0] - 290, 100), icon)

    draw.rounded_rectangle((92, 286, PAGE_SIZE[0] - 92, 444), radius=34, fill="#f3f7f3")
    intro = (
        f"AgroTech certifica que {user_name} adquirio participacion digital sobre {asset.name}. "
        "La operacion fue registrada mediante contrato digital, hash verificable y confirmacion en blockchain."
    )
    draw.text((126, 320), "Titular certificado", font=heading_font, fill=BRAND_GREEN)
    draw.text((126, 360), user_name, font=value_font, fill=TEXT_MAIN)
    _draw_multiline(draw, intro, body_font, TEXT_MUTED, (126, 402, PAGE_SIZE[0] - 140, 440), line_gap=6)

    left_x = 92
    right_x = 626
    box_width = 522
    row_height = 132
    row_gap = 18
    start_y = 500

    fields = [
        ("Activo tokenizado", asset.name),
        ("Codigo del activo", asset.code),
        ("Finca / ubicacion", location),
        ("Certificado ID", contract.certificate_id),
        ("Contract ID", contract.contract_id),
        ("Tokens adquiridos", f"{contract.tokens_acquired} AGT"),
        ("Participacion digital", f"{contract.participation_pct:.4f}%"),
        ("Inversion registrada", f"${contract.investment_value_cop:,.0f} COP"),
        ("Rentabilidad estimada", f"{contract.estimated_return_pct:.2f}%"),
        ("Emitido", timezone.localtime(contract.issued_at).strftime("%Y-%m-%d %H:%M:%S")),
        ("TX hash", blockchain_record.tx_hash),
        ("Block ID", blockchain_record.block_id),
        ("Contract hash", blockchain_record.contract_hash),
        ("Estado blockchain", blockchain_record.get_status_display()),
    ]

    for index, (label, value) in enumerate(fields):
        column = index % 2
        row = index // 2
        left = left_x if column == 0 else right_x
        top = start_y + row * (row_height + row_gap)
        _draw_field(
            draw,
            label,
            value,
            (left, top, left + box_width, top + row_height),
            small_font,
            value_font if len(str(value)) < 32 else body_font,
        )

    footer_top = PAGE_SIZE[1] - 240
    draw.rounded_rectangle((92, footer_top, PAGE_SIZE[0] - 92, PAGE_SIZE[1] - 92), radius=34, fill="#f4f7f4")
    footer_copy = (
        "Este certificado acredita la titularidad digital emitida por AgroTech sobre el activo seleccionado. "
        "La participacion queda vinculada a la identidad del inversionista y puede validarse con el Contract ID, "
        "Certificate ID y TX hash incluidos en este documento."
    )
    draw.text((126, footer_top + 32), "Validacion y cumplimiento digital", font=heading_font, fill=BRAND_GREEN)
    _draw_multiline(draw, footer_copy, body_font, TEXT_MUTED, (126, footer_top + 78, PAGE_SIZE[0] - 126, PAGE_SIZE[1] - 132), line_gap=8)
    draw.text((126, PAGE_SIZE[1] - 126), "Emitido por AgroTech - registro digital verificable", font=footer_font, fill=TEXT_MUTED)

    pdf_buffer = BytesIO()
    image.save(pdf_buffer, format="PDF", resolution=150.0)
    return pdf_buffer.getvalue()
