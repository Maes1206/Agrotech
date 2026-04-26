from django import forms
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator

from .models import User


class LoginForm(forms.Form):
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput)
    remember = forms.BooleanField(required=False)


class RegisterForm(forms.Form):
    name = forms.CharField(
        max_length=150,
        error_messages={
            "required": "Ingresa tu nombre completo.",
            "max_length": "El nombre no puede superar 150 caracteres.",
        },
    )
    email = forms.EmailField(
        error_messages={
            "required": "Ingresa tu correo electronico.",
            "invalid": "Ingresa un correo electronico valido.",
        },
    )
    password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput,
        error_messages={
            "required": "Crea una contrasena para tu cuenta.",
            "min_length": "La contrasena debe tener al menos 8 caracteres.",
        },
    )

    def clean_name(self):
        name = " ".join(self.cleaned_data["name"].split())
        if len(name.split()) < 2:
            raise forms.ValidationError("Ingresa nombre y apellido.")
        return name

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("Ya existe una cuenta registrada con este correo.")
        return email

    def clean_password(self):
        password = self.cleaned_data["password"]
        user = User(
            username=(self.cleaned_data.get("email") or "").split("@")[0],
            email=self.cleaned_data.get("email", ""),
            first_name=(self.cleaned_data.get("name") or "").split(" ")[0],
        )
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise forms.ValidationError(exc.messages)
        return password


class InvestorPanelForm(forms.Form):
    btc_amount = forms.DecimalField(
        max_digits=13,
        decimal_places=6,
        validators=[MinValueValidator(0)],
        widget=forms.NumberInput(
            attrs={
                "step": "0.000001",
                "min": "0",
                "placeholder": "0.050000",
            }
        ),
    )
