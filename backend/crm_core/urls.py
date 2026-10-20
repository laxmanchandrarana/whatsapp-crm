from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    WhatsAppWebhookView,
    MockWebhookTriggerView,
    ConversationViewSet,
    MessageViewSet,
    ApprovalQueueViewSet,
    MessageTemplateViewSet,
    ContactViewSet,
    AIAgentConfigViewSet,
    CannedResponseViewSet,
    BroadcastCampaignViewSet,
    BotFlowViewSet,
    WhatsAppGroupViewSet,
    AnalyticsView,
    StatsView
)

router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='conversation')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'approvals', ApprovalQueueViewSet, basename='approval')
router.register(r'templates', MessageTemplateViewSet, basename='template')
router.register(r'contacts', ContactViewSet, basename='contact')
router.register(r'groups', WhatsAppGroupViewSet, basename='group')
router.register(r'ai-configs', AIAgentConfigViewSet, basename='ai-config')
router.register(r'canned-responses', CannedResponseViewSet, basename='canned-response')
router.register(r'campaigns', BroadcastCampaignViewSet, basename='campaign')
router.register(r'bot-flows', BotFlowViewSet, basename='bot-flow')

urlpatterns = [
    path('', include(router.urls)),
    path('webhooks/whatsapp/', WhatsAppWebhookView.as_view(), name='whatsapp-webhook'),
    path('webhooks/whatsapp/simulate/', MockWebhookTriggerView.as_view(), name='whatsapp-simulate-webhook'),
    path('analytics/', AnalyticsView.as_view(), name='crm-analytics'),
    path('stats/', StatsView.as_view(), name='crm-stats'),
]
