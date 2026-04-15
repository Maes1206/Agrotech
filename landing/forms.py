from django import forms
from django.contrib.auth.password_validation import validate_password
from django.core.validators import MinValueValidator

from .models import User


class LoginForm(forms.Form):
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput)
    remember = forms.BooleanField(required=False)


class RegisterForm(forms.Form):
    name = forms.CharField(max_length=150)
    email = forms.EmailField()
    password = forms.CharField(widget=forms.PasswordInput)

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("Ya existe una cuenta registrada con este correo.")
        return email

    def clean_password(self):
        password = self.cleaned_data["password"]
        validate_password(password)
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
