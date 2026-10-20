from django.contrib import admin
from .models import (
    Contact,
    Conversation,
    Message,
    ApprovalQueue,
    MessageTemplate,
    AIAgentConfig,
    CannedResponse,
    BroadcastCampaign,
    CampaignRecipient,
    BotFlow,
    BotSession
)

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone_number', 'created_at')
    search_fields = ('name', 'phone_number')

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'contact', 'status', 'assigned_agent', 'unread_count', 'last_message_at')
    list_filter = ('status', 'assigned_agent')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'conversation', 'direction', 'message_type', 'is_internal', 'status', 'timestamp')
    list_filter = ('direction', 'message_type', 'is_internal', 'status')
    search_fields = ('content', 'meta_message_id')

@admin.register(ApprovalQueue)
class ApprovalQueueAdmin(admin.ModelAdmin):
    list_display = ('id', 'intent', 'risk_score', 'ai_model', 'is_resolved', 'approved_by', 'created_at')
    list_filter = ('is_resolved', 'intent')

@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'language', 'meta_status', 'created_at')
    list_filter = ('category', 'meta_status', 'language')

@admin.register(AIAgentConfig)
class AIAgentConfigAdmin(admin.ModelAdmin):
    list_display = ('name', 'model_name', 'risk_threshold', 'auto_reply_allowed', 'is_active')

@admin.register(CannedResponse)
class CannedResponseAdmin(admin.ModelAdmin):
    list_display = ('shortcut', 'title', 'category')
    search_fields = ('shortcut', 'title', 'content')

@admin.register(BroadcastCampaign)
class BroadcastCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'template', 'status', 'total_recipients', 'sent_count', 'delivered_count')
    list_filter = ('status',)

@admin.register(CampaignRecipient)
class CampaignRecipientAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'contact', 'status', 'sent_at')
    list_filter = ('status',)

@admin.register(BotFlow)
class BotFlowAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger_type', 'is_active', 'updated_at')
    list_filter = ('trigger_type', 'is_active')

@admin.register(BotSession)
class BotSessionAdmin(admin.ModelAdmin):
    list_display = ('contact', 'flow', 'current_node_id', 'is_completed', 'updated_at')
