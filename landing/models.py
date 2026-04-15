from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Role(TimeStampedModel):
    INVESTOR = "investor"
    PRODUCER = "producer"
    ADMIN = "admin"

    CODE_CHOICES = [
        (INVESTOR, "Inversionista"),
        (PRODUCER, "Productor"),
        (ADMIN, "Administrador"),
    ]

    code = models.CharField(max_length=20, unique=True, choices=CODE_CHOICES)
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "users_role"
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    email = models.EmailField(unique=True)
    is_verified = models.BooleanField(default=False)
    roles = models.ManyToManyField(
        Role,
        through="UserRole",
        through_fields=("user", "role"),
        related_name="users",
        blank=True,
    )

    class Meta:
        db_table = "users_user"
        ordering = ["-date_joined"]

    def __str__(self):
        return self.get_full_name() or self.username


class UserProfile(TimeStampedModel):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"
    PENDING = "pending"

    STATUS_CHOICES = [
        (ACTIVE, "Activo"),
        (INACTIVE, "Inactivo"),
        (BLOCKED, "Bloqueado"),
        (PENDING, "Pendiente"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    document = models.CharField(max_length=30, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    simulated_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    primary_role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="primary_profiles",
        null=True,
        blank=True,
    )
    birth_date = models.DateField(null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "users_profile"

    def __str__(self):
        return f"Perfil de {self.user.username}"


class UserRole(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")
    assigned_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_roles",
    )
    assigned_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "users_user_role"
        unique_together = ("user", "role")

    def __str__(self):
        return f"{self.user.username} - {self.role.code}"


class LoginAudit(models.Model):
    SUCCESS = "success"
    FAILED = "failed"
    LOGOUT = "logout"

    EVENT_CHOICES = [
        (SUCCESS, "Login exitoso"),
        (FAILED, "Login fallido"),
        (LOGOUT, "Cierre de sesion"),
    ]

    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="login_audits",
    )
    username_attempt = models.CharField(max_length=150, blank=True)
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "users_login_audit"
        ordering = ["-occurred_at"]

    def __str__(self):
        target = self.username_attempt or getattr(self.user, "username", "anon")
        return f"{self.event} - {target}"


class Producer(TimeStampedModel):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

    STATUS_CHOICES = [
        (ACTIVE, "Activo"),
        (INACTIVE, "Inactivo"),
        (SUSPENDED, "Suspendido"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="producer_profile",
    )
    name = models.CharField(max_length=150)
    document = models.CharField(max_length=30, unique=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=ACTIVE)

    class Meta:
        db_table = "agro_producer"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Farm(TimeStampedModel):
    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"

    STATUS_CHOICES = [
        (ACTIVE, "Activa"),
        (INACTIVE, "Inactiva"),
        (MAINTENANCE, "En mantenimiento"),
    ]

    producer = models.ForeignKey(Producer, on_delete=models.PROTECT, related_name="farms")
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    municipality = models.CharField(max_length=80)
    department = models.CharField(max_length=80)
    location = models.CharField(max_length=255, blank=True)
    hectares = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=ACTIVE)

    class Meta:
        db_table = "agro_farm"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.code})"


class AssetCategory(TimeStampedModel):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "agro_asset_category"
        ordering = ["name"]

    def __str__(self):
        return self.name


class BiologicalAsset(TimeStampedModel):
    INDIVIDUAL = "individual"
    LOT = "lot"

    ASSET_TYPE_CHOICES = [
        (INDIVIDUAL, "Animal individual"),
        (LOT, "Lote"),
    ]

    DRAFT = "draft"
    AVAILABLE = "available"
    FUNDED = "funded"
    IN_PRODUCTION = "in_production"
    SOLD = "sold"
    CLOSED = "closed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (DRAFT, "Borrador"),
        (AVAILABLE, "Disponible"),
        (FUNDED, "Financiado"),
        (IN_PRODUCTION, "En produccion"),
        (SOLD, "Vendido"),
        (CLOSED, "Cerrado"),
        (CANCELLED, "Cancelado"),
    ]

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=150)
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPE_CHOICES, default=LOT)
    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.PROTECT,
        related_name="assets",
    )
    producer = models.ForeignKey(
        Producer,
        on_delete=models.PROTECT,
        related_name="assets",
    )
    farm = models.ForeignKey(
        Farm,
        on_delete=models.PROTECT,
        related_name="assets",
    )
    initial_weight = models.DecimalField(max_digits=10, decimal_places=2)
    current_weight = models.DecimalField(max_digits=10, decimal_places=2)
    initial_value = models.DecimalField(max_digits=14, decimal_places=2)
    projected_value = models.DecimalField(max_digits=14, decimal_places=2)
    estimated_return_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    start_date = models.DateField()
    estimated_sale_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=AVAILABLE)
    description = models.TextField(blank=True)
    tokenized_units = models.PositiveIntegerField(default=1)
    available_units = models.PositiveIntegerField(default=1)
    is_featured = models.BooleanField(default=False)
    display_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "agro_biological_asset"
        ordering = ["display_order", "estimated_sale_date", "name"]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def current_value(self):
        return self.projected_value

    @property
    def price_per_token(self):
        if hasattr(self, "tokenization"):
            return self.tokenization.token_price
        if self.tokenized_units:
            return self.initial_value / self.tokenized_units
        return 0


class AssetStatusHistory(models.Model):
    asset = models.ForeignKey(
        BiologicalAsset,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    previous_status = models.CharField(
        max_length=20,
        choices=BiologicalAsset.STATUS_CHOICES,
        blank=True,
    )
    new_status = models.CharField(max_length=20, choices=BiologicalAsset.STATUS_CHOICES)
    changed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="asset_status_changes",
    )
    notes = models.TextField(blank=True)
    changed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "agro_asset_status_history"
        ordering = ["-changed_at"]

    def __str__(self):
        return f"{self.asset.code} - {self.new_status}"


class TokenizedAsset(TimeStampedModel):
    asset = models.OneToOneField(
        BiologicalAsset,
        on_delete=models.CASCADE,
        related_name="tokenization",
    )
    total_tokens = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    tokens_available = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    token_price = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])

    class Meta:
        db_table = "agro_tokenized_asset"
        ordering = ["asset__display_order", "asset__name"]

    def __str__(self):
        return f"Tokenizacion {self.asset.code}"

    @property
    def tokens_sold(self):
        return self.total_tokens - self.tokens_available


class TokenHolding(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="token_holdings",
    )
    tokenized_asset = models.ForeignKey(
        TokenizedAsset,
        on_delete=models.CASCADE,
        related_name="holdings",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = "agro_token_holding"
        ordering = ["user__username", "tokenized_asset__asset__name"]
        unique_together = ("user", "tokenized_asset")

    def __str__(self):
        return f"{self.user.username} - {self.tokenized_asset.asset.code} ({self.quantity})"

    @property
    def participation(self):
        if not self.tokenized_asset.total_tokens:
            return 0
        return self.quantity / self.tokenized_asset.total_tokens


class TokenTransaction(TimeStampedModel):
    BUY = "buy"

    TRANSACTION_TYPE_CHOICES = [
        (BUY, "Compra"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="token_transactions",
    )
    tokenized_asset = models.ForeignKey(
        TokenizedAsset,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    price_per_token = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(0)])
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES, default=BUY)

    class Meta:
        db_table = "agro_token_transaction"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.transaction_type} - {self.tokenized_asset.asset.code}"


class Wallet(TimeStampedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    agt_balance = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "agro_wallet"

    def __str__(self):
        return f"Wallet {self.user.username}"

    @property
    def equivalent_cop(self):
        return self.agt_balance * settings.AGROTECH_TOKEN_PRICE_COP


class DigitalContract(TimeStampedModel):
    ACTIVE = "active"
    ARCHIVED = "archived"

    STATUS_CHOICES = [
        (ACTIVE, "Activo"),
        (ARCHIVED, "Archivado"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="digital_contracts",
    )
    tokenized_asset = models.ForeignKey(
        TokenizedAsset,
        on_delete=models.CASCADE,
        related_name="digital_contracts",
    )
    transaction = models.OneToOneField(
        TokenTransaction,
        on_delete=models.CASCADE,
        related_name="digital_contract",
    )
    contract_id = models.CharField(max_length=80, unique=True)
    certificate_id = models.CharField(max_length=80, unique=True)
    tokens_acquired = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    participation_pct = models.DecimalField(max_digits=8, decimal_places=4)
    investment_value_cop = models.DecimalField(max_digits=14, decimal_places=2)
    estimated_return_pct = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=ACTIVE)
    issued_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "agro_digital_contract"
        ordering = ["-issued_at"]

    def __str__(self):
        return self.contract_id


class BlockchainRecord(TimeStampedModel):
    CONFIRMED = "confirmed"
    PENDING = "pending"

    STATUS_CHOICES = [
        (CONFIRMED, "Confirmado en blockchain"),
        (PENDING, "Pendiente"),
    ]

    transaction = models.OneToOneField(
        TokenTransaction,
        on_delete=models.CASCADE,
        related_name="blockchain_record",
    )
    digital_contract = models.OneToOneField(
        DigitalContract,
        on_delete=models.CASCADE,
        related_name="blockchain_record",
    )
    tx_hash = models.CharField(max_length=100, unique=True)
    block_id = models.CharField(max_length=60, unique=True)
    contract_hash = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=CONFIRMED)
    confirmed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "agro_blockchain_record"
        ordering = ["-confirmed_at"]

    def __str__(self):
        return self.tx_hash
