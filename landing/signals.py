from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.db.models.signals import post_save
from django.dispatch import receiver

from django.conf import settings

from .models import LoginAudit, User, UserProfile, UserRole, Wallet


def _get_client_ip(request):
    if not request:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


@receiver(post_save, sender=User)
def ensure_profile_exists(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance, document=f"PENDING-{instance.pk}")
        Wallet.objects.create(user=instance, agt_balance=settings.AGROTECH_DEMO_WALLET_TOKENS)


@receiver(post_save, sender=UserProfile)
def sync_primary_role_assignment(sender, instance, **kwargs):
    if not instance.primary_role_id:
        return

    UserRole.objects.get_or_create(
        user=instance.user,
        role=instance.primary_role,
    )

@receiver(user_logged_in)
def handle_user_logged_in(sender, request, user, **kwargs):
    LoginAudit.objects.create(
        user=user,
        username_attempt=user.username,
        event=LoginAudit.SUCCESS,
        ip_address=_get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
    )


@receiver(user_logged_out)
def handle_user_logged_out(sender, request, user, **kwargs):
    LoginAudit.objects.create(
        user=user,
        username_attempt=getattr(user, "username", ""),
        event=LoginAudit.LOGOUT,
        ip_address=_get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
    )


@receiver(user_login_failed)
def handle_user_login_failed(sender, credentials, request, **kwargs):
    LoginAudit.objects.create(
        username_attempt=credentials.get("username", "") or credentials.get("email", ""),
        event=LoginAudit.FAILED,
        ip_address=_get_client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "") if request else "",
    )
