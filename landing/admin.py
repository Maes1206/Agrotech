from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    AssetCategory,
    AssetStatusHistory,
    BlockchainRecord,
    BiologicalAsset,
    DigitalContract,
    Farm,
    LoginAudit,
    Producer,
    Role,
    TokenHolding,
    TokenTransaction,
    TokenizedAsset,
    User,
    UserProfile,
    UserRole,
    Wallet,
)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    extra = 0


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline]
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_active",
        "is_staff",
        "is_verified",
        "last_login",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "is_verified")
    search_fields = ("username", "email", "first_name", "last_name")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("AgroTech", {"fields": ("is_verified",)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("AgroTech", {"fields": ("email", "is_verified")}),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_at")
    list_filter = ("code", "is_active")
    search_fields = ("code", "name")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "document",
        "phone",
        "primary_role",
        "simulated_balance",
        "status",
    )
    list_filter = ("status", "primary_role")
    search_fields = ("user__username", "user__email", "document", "phone")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "assigned_by", "assigned_at", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("user__username", "role__name")


@admin.register(LoginAudit)
class LoginAuditAdmin(admin.ModelAdmin):
    list_display = ("username_attempt", "event", "ip_address", "occurred_at")
    list_filter = ("event", "occurred_at")
    search_fields = ("username_attempt", "user__username", "ip_address")
    readonly_fields = ("user", "username_attempt", "event", "ip_address", "user_agent", "occurred_at")


@admin.register(Producer)
class ProducerAdmin(admin.ModelAdmin):
    list_display = ("name", "document", "phone", "email", "status")
    list_filter = ("status",)
    search_fields = ("name", "document", "email")


@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "producer", "municipality", "department", "status")
    list_filter = ("status", "department")
    search_fields = ("code", "name", "producer__name", "municipality")


@admin.register(AssetCategory)
class AssetCategoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


class AssetStatusHistoryInline(admin.TabularInline):
    model = AssetStatusHistory
    extra = 0


class TokenizedAssetInline(admin.StackedInline):
    model = TokenizedAsset
    extra = 0


@admin.register(BiologicalAsset)
class BiologicalAssetAdmin(admin.ModelAdmin):
    inlines = [AssetStatusHistoryInline, TokenizedAssetInline]
    list_display = (
        "code",
        "name",
        "asset_type",
        "producer",
        "farm",
        "status",
        "is_featured",
        "display_order",
    )
    list_filter = ("asset_type", "status", "category", "is_featured")
    search_fields = ("code", "name", "producer__name", "farm__name")


@admin.register(AssetStatusHistory)
class AssetStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("asset", "previous_status", "new_status", "changed_by", "changed_at")
    list_filter = ("new_status", "changed_at")
    search_fields = ("asset__code", "asset__name", "notes")


@admin.register(TokenizedAsset)
class TokenizedAssetAdmin(admin.ModelAdmin):
    list_display = ("asset", "total_tokens", "tokens_available", "tokens_sold", "token_price")
    search_fields = ("asset__code", "asset__name")


@admin.register(TokenHolding)
class TokenHoldingAdmin(admin.ModelAdmin):
    list_display = ("user", "tokenized_asset", "quantity", "created_at")
    search_fields = ("user__username", "tokenized_asset__asset__code", "tokenized_asset__asset__name")


@admin.register(TokenTransaction)
class TokenTransactionAdmin(admin.ModelAdmin):
    list_display = ("user", "tokenized_asset", "quantity", "price_per_token", "total_amount", "created_at")
    list_filter = ("transaction_type", "created_at")
    search_fields = ("user__username", "tokenized_asset__asset__code", "tokenized_asset__asset__name")


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("user", "agt_balance", "updated_at")
    search_fields = ("user__username", "user__email")


@admin.register(DigitalContract)
class DigitalContractAdmin(admin.ModelAdmin):
    list_display = ("contract_id", "user", "tokenized_asset", "tokens_acquired", "participation_pct", "status", "issued_at")
    list_filter = ("status", "issued_at")
    search_fields = ("contract_id", "certificate_id", "user__username", "tokenized_asset__asset__code")


@admin.register(BlockchainRecord)
class BlockchainRecordAdmin(admin.ModelAdmin):
    list_display = ("tx_hash", "block_id", "digital_contract", "status", "confirmed_at")
    list_filter = ("status", "confirmed_at")
    search_fields = ("tx_hash", "block_id", "contract_hash", "digital_contract__contract_id")
