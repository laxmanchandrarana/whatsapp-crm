from rest_framework import serializers
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

class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['id', 'phone_number', 'name', 'email', 'tags', 'metadata', 'created_at', 'updated_at']


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = [
            'id',
            'conversation',
            'direction',
            'message_type',
            'content',
            'is_internal',
            'author_agent',
            'status',
            'meta_message_id',
            'error_message',
            'timestamp',
            'created_at',
        ]
        read_only_fields = ['status', 'meta_message_id', 'error_message', 'timestamp', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    contact = ContactSerializer(read_only=True)
    contact_id = serializers.PrimaryKeyRelatedField(
        queryset=Contact.objects.all(), source='contact', write_only=True
    )
    last_message = serializers.SerializerMethodField()
    pending_approval_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'contact',
            'contact_id',
            'status',
            'assigned_agent',
            'unread_count',
            'last_message_at',
            'first_response_time_seconds',
            'resolved_at',
            'last_message',
            'pending_approval_count',
            'created_at',
        ]

    def get_last_message(self, obj):
        last_msg = obj.messages.order_by('-timestamp').first()
        if last_msg:
            return MessageSerializer(last_msg).data
        return None

    def get_pending_approval_count(self, obj):
        return obj.messages.filter(status=Message.STATUS_PENDING_APPROVAL).count()


class ApprovalQueueSerializer(serializers.ModelSerializer):
    message_details = MessageSerializer(source='message', read_only=True)
    contact_name = serializers.CharField(source='message.conversation.contact.name', read_only=True)
    contact_phone = serializers.CharField(source='message.conversation.contact.phone_number', read_only=True)
    conversation_id = serializers.IntegerField(source='message.conversation.id', read_only=True)

    class Meta:
        model = ApprovalQueue
        fields = [
            'id',
            'message',
            'message_details',
            'contact_name',
            'contact_phone',
            'conversation_id',
            'intent',
            'risk_score',
            'suggested_response',
            'ai_model',
            'prompt_context',
            'approved_by',
            'approved_at',
            'rejection_reason',
            'is_resolved',
            'created_at',
        ]
        read_only_fields = ['created_at', 'approved_at']


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = [
            'id',
            'name',
            'category',
            'language',
            'components',
            'meta_status',
            'meta_template_id',
            'created_at',
            'updated_at',
        ]


class AIAgentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAgentConfig
        fields = '__all__'


class CannedResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = CannedResponse
        fields = '__all__'


class CampaignRecipientSerializer(serializers.ModelSerializer):
    contact = ContactSerializer(read_only=True)

    class Meta:
        model = CampaignRecipient
        fields = ['id', 'campaign', 'contact', 'status', 'meta_message_id', 'error_message', 'sent_at']


class BroadcastCampaignSerializer(serializers.ModelSerializer):
    template_details = MessageTemplateSerializer(source='template', read_only=True)
    template_id = serializers.PrimaryKeyRelatedField(
        queryset=MessageTemplate.objects.all(), source='template', write_only=True
    )
    recipients_count = serializers.IntegerField(source='recipients.count', read_only=True)

    class Meta:
        model = BroadcastCampaign
        fields = [
            'id',
            'name',
            'template',
            'template_id',
            'template_details',
            'target_tag',
            'total_recipients',
            'variables_mapping',
            'scheduled_at',
            'status',
            'sent_count',
            'delivered_count',
            'read_count',
            'failed_count',
            'recipients_count',
            'created_at',
            'updated_at',
        ]


class BotFlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotFlow
        fields = '__all__'


class BotSessionSerializer(serializers.ModelSerializer):
    flow_name = serializers.CharField(source='flow.name', read_only=True)
    contact_phone = serializers.CharField(source='contact.phone_number', read_only=True)

    class Meta:
        model = BotSession
        fields = '__all__'
