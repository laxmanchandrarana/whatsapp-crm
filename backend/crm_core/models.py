from django.db import models
from django.utils import timezone

class Contact(models.Model):
    phone_number = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name or 'Unknown'} ({self.phone_number})"


class Conversation(models.Model):
    STATUS_OPEN = 'OPEN'
    STATUS_PENDING_APPROVAL = 'PENDING_APPROVAL'
    STATUS_RESOLVED = 'RESOLVED'
    STATUS_SNOOZED = 'SNOOZED'
    STATUS_CLOSED = 'CLOSED'

    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_PENDING_APPROVAL, 'Needs Approval'),
        (STATUS_RESOLVED, 'Resolved'),
        (STATUS_SNOOZED, 'Snoozed'),
        (STATUS_CLOSED, 'Closed'),
    ]

    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='conversations')
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_OPEN, db_index=True)
    assigned_agent = models.CharField(max_length=100, blank=True, null=True, default='Agent')
    unread_count = models.PositiveIntegerField(default=0)
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    first_response_time_seconds = models.FloatField(blank=True, null=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_message_at']

    def __str__(self):
        return f"Conversation with {self.contact.phone_number} [{self.status}]"


class Message(models.Model):
    DIR_INBOUND = 'INBOUND'
    DIR_OUTBOUND = 'OUTBOUND'
    DIRECTION_CHOICES = [
        (DIR_INBOUND, 'Inbound'),
        (DIR_OUTBOUND, 'Outbound'),
    ]

    TYPE_TEXT = 'TEXT'
    TYPE_TEMPLATE = 'TEMPLATE'
    TYPE_IMAGE = 'IMAGE'
    TYPE_DOCUMENT = 'DOCUMENT'
    TYPE_AUDIO = 'AUDIO'
    TYPE_VIDEO = 'VIDEO'
    TYPE_INTERACTIVE = 'INTERACTIVE'
    TYPE_NOTE = 'NOTE'
    TYPE_CHOICES = [
        (TYPE_TEXT, 'Text'),
        (TYPE_TEMPLATE, 'Template'),
        (TYPE_IMAGE, 'Image'),
        (TYPE_DOCUMENT, 'Document'),
        (TYPE_AUDIO, 'Audio'),
        (TYPE_VIDEO, 'Video'),
        (TYPE_INTERACTIVE, 'Interactive'),
        (TYPE_NOTE, 'Internal Note'),
    ]

    STATUS_DRAFT = 'DRAFT'
    STATUS_PENDING_APPROVAL = 'PENDING_APPROVAL'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_SENT = 'SENT'
    STATUS_DELIVERED = 'DELIVERED'
    STATUS_READ = 'READ'
    STATUS_FAILED = 'FAILED'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_PENDING_APPROVAL, 'Pending Approval'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_SENT, 'Sent'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_READ, 'Read'),
        (STATUS_FAILED, 'Failed'),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    direction = models.CharField(max_length=16, choices=DIRECTION_CHOICES, db_index=True)
    message_type = models.CharField(max_length=24, choices=TYPE_CHOICES, default=TYPE_TEXT)
    content = models.TextField()
    is_internal = models.BooleanField(default=False, db_index=True)  # Internal team whisper notes
    author_agent = models.CharField(max_length=100, blank=True, null=True)
    raw_payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_SENT, db_index=True)
    meta_message_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    error_message = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        prefix = "[INTERNAL NOTE]" if self.is_internal else f"[{self.direction}]"
        return f"{prefix} {self.content[:30]} ({self.status})"


class ApprovalQueue(models.Model):
    message = models.OneToOneField(Message, on_delete=models.CASCADE, related_name='approval')
    intent = models.CharField(max_length=100, blank=True, default='')
    risk_score = models.FloatField(default=0.0)  # 0.0 (safe) to 1.0 (high-risk/critical)
    suggested_response = models.TextField()
    ai_model = models.CharField(max_length=100, default='OpenMausBot-Copilot')
    prompt_context = models.TextField(blank=True, default='')
    approved_by = models.CharField(max_length=100, blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    rejection_reason = models.TextField(blank=True, null=True)
    is_resolved = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-risk_score', '-created_at']

    def __str__(self):
        return f"Approval for msg #{self.message_id} (Risk: {self.risk_score:.2f}, Intent: {self.intent})"


class MessageTemplate(models.Model):
    CATEGORY_MARKETING = 'MARKETING'
    CATEGORY_UTILITY = 'UTILITY'
    CATEGORY_AUTHENTICATION = 'AUTHENTICATION'

    CATEGORY_CHOICES = [
        (CATEGORY_MARKETING, 'Marketing'),
        (CATEGORY_UTILITY, 'Utility'),
        (CATEGORY_AUTHENTICATION, 'Authentication'),
    ]

    STATUS_APPROVED = 'APPROVED'
    STATUS_PENDING = 'PENDING'
    STATUS_REJECTED = 'REJECTED'

    STATUS_CHOICES = [
        (STATUS_APPROVED, 'Approved'),
        (STATUS_PENDING, 'Pending'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default=CATEGORY_UTILITY)
    language = models.CharField(max_length=12, default='en_US')
    components = models.JSONField(default=list, blank=True)
    meta_status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING)
    meta_template_id = models.CharField(max_length=128, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.category} - {self.language})"


class AIAgentConfig(models.Model):
    """Configuration for OpenMausBot AI Copilot & Automated Handlers"""
    name = models.CharField(max_length=100, default='OpenMausBot Copilot')
    role = models.CharField(max_length=100, default='Lead Customer Support Specialist')
    instructions = models.TextField(default='Assist customers politely, provide concise answers, and escalate billing/cancellations to human supervisor.')
    auto_reply_allowed = models.BooleanField(default=True)
    risk_threshold = models.FloatField(default=0.50)  # >= threshold routes to ApprovalQueue
    model_name = models.CharField(max_length=100, default='gemini-2.5-pro')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.model_name})"


class CannedResponse(models.Model):
    """Canned replies for agent fast-answering (e.g. /refund, /pricing)"""
    shortcut = models.CharField(max_length=50, unique=True, db_index=True)
    title = models.CharField(max_length=120)
    content = models.TextField()
    category = models.CharField(max_length=60, default='General')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'shortcut']

    def __str__(self):
        return f"/{self.shortcut} - {self.title}"


class BroadcastCampaign(models.Model):
    STATUS_DRAFT = 'DRAFT'
    STATUS_SCHEDULED = 'SCHEDULED'
    STATUS_RUNNING = 'RUNNING'
    STATUS_COMPLETED = 'COMPLETED'
    STATUS_PAUSED = 'PAUSED'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_PAUSED, 'Paused'),
    ]

    name = models.CharField(max_length=200)
    template = models.ForeignKey(MessageTemplate, on_delete=models.CASCADE, related_name='campaigns')
    target_tag = models.CharField(max_length=100, blank=True, default='')
    total_recipients = models.IntegerField(default=0)
    variables_mapping = models.JSONField(default=dict, blank=True)
    scheduled_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True)
    
    # Live counters
    sent_count = models.IntegerField(default=0)
    delivered_count = models.IntegerField(default=0)
    read_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Campaign: {self.name} [{self.status}]"


class CampaignRecipient(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_SENT = 'SENT'
    STATUS_DELIVERED = 'DELIVERED'
    STATUS_READ = 'READ'
    STATUS_FAILED = 'FAILED'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_SENT, 'Sent'),
        (STATUS_DELIVERED, 'Delivered'),
        (STATUS_READ, 'Read'),
        (STATUS_FAILED, 'Failed'),
    ]

    campaign = models.ForeignKey(BroadcastCampaign, on_delete=models.CASCADE, related_name='recipients')
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='campaign_deliveries')
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    meta_message_id = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    error_message = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        unique_together = ('campaign', 'contact')

    def __str__(self):
        return f"{self.campaign.name} -> {self.contact.phone_number} ({self.status})"


class BotFlow(models.Model):
    TRIGGER_KEYWORD = 'KEYWORD'
    TRIGGER_NEW_CHAT = 'NEW_CHAT'
    TRIGGER_ALWAYS = 'ALWAYS'

    TRIGGER_CHOICES = [
        (TRIGGER_KEYWORD, 'Keyword Match'),
        (TRIGGER_NEW_CHAT, 'New Conversation'),
        (TRIGGER_ALWAYS, 'Every Inbound Message'),
    ]

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default='')
    trigger_type = models.CharField(max_length=32, choices=TRIGGER_CHOICES, default=TRIGGER_KEYWORD)
    trigger_keywords = models.JSONField(default=list, blank=True)
    nodes = models.JSONField(default=list)  # Visual workflow graph nodes
    edges = models.JSONField(default=list)  # Visual workflow graph edges
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} (Active: {self.is_active})"


class BotSession(models.Model):
    contact = models.ForeignKey(Contact, on_delete=models.CASCADE, related_name='bot_sessions')
    flow = models.ForeignKey(BotFlow, on_delete=models.CASCADE, related_name='sessions')
    current_node_id = models.CharField(max_length=64, default='start')
    context_data = models.JSONField(default=dict, blank=True)
    is_completed = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"BotSession {self.contact.phone_number} on {self.flow.name} @ {self.current_node_id}"
