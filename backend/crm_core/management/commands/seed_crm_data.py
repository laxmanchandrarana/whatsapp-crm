from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from crm_core.models import (
    Contact,
    Conversation,
    Message,
    ApprovalQueue,
    MessageTemplate,
    AIAgentConfig,
    CannedResponse,
    BroadcastCampaign,
    CampaignRecipient,
    BotFlow
)

class Command(BaseCommand):
    help = "Seeds comprehensive enterprise demo data for WhatsApp CRM (Sprint 2)"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding Enterprise WhatsApp CRM data..."))

        # 1. AI Copilot Agent Config
        ai_config, _ = AIAgentConfig.objects.get_or_create(
            name="OpenMausBot Copilot",
            defaults={
                'role': 'Lead Tier-2 Support Specialist',
                'instructions': 'Assist customers politely, provide concise answers, identify billing disputes and route high-risk intents to the supervisor approval drawer.',
                'auto_reply_allowed': True,
                'risk_threshold': 0.50,
                'model_name': 'gemini-2.5-pro',
                'is_active': True
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Configured AI Agent: {ai_config.name}"))

        # 2. Canned Responses
        canned_data = [
            {
                'shortcut': 'greeting',
                'title': 'Friendly Welcome',
                'content': 'Hello! Thanks for contacting DoubleTick Support. My name is Alex, how may I assist you today?',
                'category': 'General'
            },
            {
                'shortcut': 'refund_policy',
                'title': 'Standard Refund Policy',
                'content': 'Our refund policy guarantees full reimbursement within 14 days of purchase. I can initiate this request directly for you right now.',
                'category': 'Billing'
            },
            {
                'shortcut': 'enterprise_quote',
                'title': 'Enterprise Plan Pricing',
                'content': 'Our Enterprise plan includes dedicated Meta WhatsApp Cloud API throughput, custom AI flow builder, unlimited agents, and 99.9% uptime SLA.',
                'category': 'Sales'
            },
            {
                'shortcut': 'hours',
                'title': 'Support Operating Hours',
                'content': 'Our technical support team is online 24/7. Phone and billing specialists are available Mon-Fri, 9am - 6pm EST.',
                'category': 'General'
            },
            {
                'shortcut': 'handoff',
                'title': 'Transfer to Senior Engineer',
                'content': 'I am connecting you with our senior technical escalation team. Please stay on the line while they inspect your account logs.',
                'category': 'Technical'
            }
        ]
        for c in canned_data:
            CannedResponse.objects.update_or_create(
                shortcut=c['shortcut'],
                defaults=c
            )
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(canned_data)} canned replies."))

        # 3. Message Templates
        templates_data = [
            {
                'name': 'exclusive_vip_discount',
                'category': MessageTemplate.CATEGORY_MARKETING,
                'language': 'en_US',
                'meta_status': MessageTemplate.STATUS_APPROVED,
                'components': [
                    {'type': 'HEADER', 'format': 'TEXT', 'text': 'Exclusive 25% Off Summer Deal'},
                    {'type': 'BODY', 'text': 'Hi {{1}}, upgrade your WhatsApp CRM today with promo code VIP25 to unlock unlimited AI agent copilot access!'},
                    {'type': 'FOOTER', 'text': 'Reply STOP to opt out'},
                    {'type': 'BUTTONS', 'buttons': [{'type': 'URL', 'text': 'Claim Offer', 'url': 'https://lcrana.in'}]}
                ]
            },
            {
                'name': 'appointment_reminder',
                'category': MessageTemplate.CATEGORY_UTILITY,
                'language': 'en_US',
                'meta_status': MessageTemplate.STATUS_APPROVED,
                'components': [
                    {'type': 'BODY', 'text': 'Hi {{1}}, this is a reminder for your upcoming onboarding consultation on {{2}}. Please confirm or reschedule.'},
                    {'type': 'BUTTONS', 'buttons': [{'type': 'QUICK_REPLY', 'text': 'Confirm'}, {'type': 'QUICK_REPLY', 'text': 'Reschedule'}]}
                ]
            },
            {
                'name': 'order_shipped_notification',
                'category': MessageTemplate.CATEGORY_UTILITY,
                'language': 'en_US',
                'meta_status': MessageTemplate.STATUS_APPROVED,
                'components': [
                    {'type': 'HEADER', 'format': 'TEXT', 'text': 'Order Dispatched 🚀'},
                    {'type': 'BODY', 'text': 'Great news {{1}}! Your order #{{2}} is on its way. Track your package delivery status in real-time.'},
                    {'type': 'FOOTER', 'text': 'DoubleTick Commerce'}
                ]
            }
        ]
        created_tpls = []
        for tpl in templates_data:
            obj, _ = MessageTemplate.objects.update_or_create(
                name=tpl['name'],
                defaults=tpl
            )
            created_tpls.append(obj)
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(created_tpls)} Meta WhatsApp templates."))

        # 4. Bot Studio Flows
        flow_nodes = [
            {
                'id': 'start_node',
                'type': 'message',
                'title': 'Welcome Message',
                'content': 'Welcome to DoubleTick Automated Assistant! How can we help you today?'
            },
            {
                'id': 'main_menu',
                'type': 'menu',
                'title': 'Service Menu',
                'content': 'Please select one of the following options:',
                'options': [
                    {'label': '1. View Pricing & Plans', 'value': '1', 'target_node_id': 'pricing_info'},
                    {'label': '2. Technical Support', 'value': '2', 'target_node_id': 'support_info'},
                    {'label': '3. Speak to Agent', 'value': '3', 'target_node_id': 'agent_handoff'}
                ]
            },
            {
                'id': 'pricing_info',
                'type': 'message',
                'title': 'Pricing Details',
                'content': 'Our plans start at $49/mo for Growth and $199/mo for Enterprise with unlimited broadcasts and Copilot AI.'
            },
            {
                'id': 'support_info',
                'type': 'message',
                'title': 'Support Info',
                'content': 'For documentation visit docs.doubletick.io or reply with your error code.'
            },
            {
                'id': 'agent_handoff',
                'type': 'handoff',
                'title': 'Human Escalation',
                'content': 'Transferring you to an active team member. An agent will be with you shortly.'
            }
        ]
        flow_edges = [
            {'source': 'start_node', 'target': 'main_menu'},
            {'source': 'main_menu', 'target': 'pricing_info'},
            {'source': 'main_menu', 'target': 'support_info'},
            {'source': 'main_menu', 'target': 'agent_handoff'}
        ]

        bot_flow, _ = BotFlow.objects.update_or_create(
            name="Customer Onboarding & FAQ Flow",
            defaults={
                'description': 'Automated welcome flow with interactive options for pricing, support and live agent routing.',
                'trigger_type': BotFlow.TRIGGER_KEYWORD,
                'trigger_keywords': ['start', 'help', 'menu', 'options', 'info'],
                'nodes': flow_nodes,
                'edges': flow_edges,
                'is_active': True
            }
        )
        self.stdout.write(self.style.SUCCESS(f"Seeded Bot Flow: {bot_flow.name}"))

        # 5. Contacts & Conversations
        contacts_data = [
            {
                'name': 'Marcus Vance',
                'phone': '+14155552671',
                'email': 'marcus.v@acmecorp.com',
                'tags': ['VIP', 'Enterprise', 'Billing Issue'],
                'metadata': {'company': 'Acme Corp', 'mrr': '$2,400'}
            },
            {
                'name': 'Priya Sharma',
                'phone': '+919876543210',
                'email': 'priya.sharma@techscale.in',
                'tags': ['Lead', 'High Value', 'Sales Inquiry'],
                'metadata': {'company': 'TechScale India', 'expected_seats': 30}
            },
            {
                'name': 'David Miller',
                'phone': '+12025550143',
                'email': 'david.miller@gmail.com',
                'tags': ['Customer', 'Standard'],
                'metadata': {'company': 'Miller Consulting'}
            },
            {
                'name': 'Elena Rostova',
                'phone': '+447911123456',
                'email': 'elena@novatech.co.uk',
                'tags': ['VIP', 'Churn Risk'],
                'metadata': {'company': 'NovaTech UK'}
            },
            {
                'name': 'Carlos Santana',
                'phone': '+525551234567',
                'email': 'carlos@santana.mx',
                'tags': ['Broadcast Audience', 'Lead'],
                'metadata': {'region': 'LATAM'}
            }
        ]

        now = timezone.now()
        contacts_map = {}
        for c in contacts_data:
            contact, _ = Contact.objects.update_or_create(
                phone_number=c['phone'],
                defaults={
                    'name': c['name'],
                    'email': c['email'],
                    'tags': c['tags'],
                    'metadata': c['metadata']
                }
            )
            contacts_map[c['name']] = contact

        # Conversation 1: High Risk Refund Dispute (Approval Queue)
        c1 = contacts_map['Marcus Vance']
        conv1, _ = Conversation.objects.get_or_create(
            contact=c1,
            defaults={
                'status': Conversation.STATUS_PENDING_APPROVAL,
                'assigned_agent': 'Supervisor Agent',
                'unread_count': 1,
                'last_message_at': now - timedelta(minutes=15),
                'first_response_time_seconds': 34.0
            }
        )
        Message.objects.get_or_create(
            conversation=conv1,
            direction=Message.DIR_INBOUND,
            content="Hello, I was charged twice for the $499 annual plan this morning! I need an immediate refund for the extra charge.",
            defaults={'status': Message.STATUS_DELIVERED, 'timestamp': now - timedelta(minutes=25)}
        )
        # Internal Whisper Note
        Message.objects.get_or_create(
            conversation=conv1,
            direction=Message.DIR_OUTBOUND,
            message_type=Message.TYPE_NOTE,
            content="Whisper Note: Verified Stripe account, duplicate transaction #ch_93812 exists. Approved for 1-click refund.",
            defaults={'is_internal': True, 'author_agent': 'Supervisor Agent', 'status': Message.STATUS_SENT, 'timestamp': now - timedelta(minutes=20)}
        )
        draft1, _ = Message.objects.get_or_create(
            conversation=conv1,
            direction=Message.DIR_OUTBOUND,
            content="Hello Marcus, I have reviewed your billing dispute regarding the duplicate $499 charge. I am processing your full refund for the extra transaction right now and you will receive Stripe confirmation in 10 minutes.",
            defaults={
                'status': Message.STATUS_PENDING_APPROVAL,
                'timestamp': now - timedelta(minutes=15)
            }
        )
        ApprovalQueue.objects.get_or_create(
            message=draft1,
            defaults={
                'intent': 'refund_request',
                'risk_score': 0.94,
                'suggested_response': draft1.content,
                'ai_model': 'gemini-2.5-pro',
                'prompt_context': 'Duplicate annual subscription billing dispute for $499.',
                'is_resolved': False
            }
        )

        # Conversation 2: Pricing negotiation (Approval Queue)
        c2 = contacts_map['Priya Sharma']
        conv2, _ = Conversation.objects.get_or_create(
            contact=c2,
            defaults={
                'status': Conversation.STATUS_PENDING_APPROVAL,
                'assigned_agent': 'Sales Lead',
                'unread_count': 1,
                'last_message_at': now - timedelta(hours=1),
                'first_response_time_seconds': 28.0
            }
        )
        Message.objects.get_or_create(
            conversation=conv2,
            direction=Message.DIR_INBOUND,
            content="Hi team! We are looking to buy 30 enterprise licenses for our tech support center. Can we get an enterprise discount?",
            defaults={'status': Message.STATUS_DELIVERED, 'timestamp': now - timedelta(hours=1, minutes=10)}
        )
        draft2, _ = Message.objects.get_or_create(
            conversation=conv2,
            direction=Message.DIR_OUTBOUND,
            content="Hi Priya, thank you for reaching out! For a 30-seat enterprise deployment, we can offer a 20% annual volume discount ($159/seat/yr). Would you like to schedule a 15-minute call with our solutions engineer tomorrow?",
            defaults={
                'status': Message.STATUS_PENDING_APPROVAL,
                'timestamp': now - timedelta(hours=1)
            }
        )
        ApprovalQueue.objects.get_or_create(
            message=draft2,
            defaults={
                'intent': 'pricing_negotiation',
                'risk_score': 0.76,
                'suggested_response': draft2.content,
                'ai_model': 'gemini-2.5-pro',
                'prompt_context': 'Inquiry for 30 enterprise seats requesting discount.',
                'is_resolved': False
            }
        )

        # Conversation 3: Standard Open Chat
        c3 = contacts_map['David Miller']
        conv3, _ = Conversation.objects.get_or_create(
            contact=c3,
            defaults={
                'status': Conversation.STATUS_OPEN,
                'assigned_agent': 'Jane Doe',
                'unread_count': 0,
                'last_message_at': now - timedelta(hours=3),
                'first_response_time_seconds': 40.0
            }
        )
        Message.objects.get_or_create(
            conversation=conv3,
            direction=Message.DIR_INBOUND,
            content="Hi! What are your business operating hours?",
            defaults={'status': Message.STATUS_READ, 'timestamp': now - timedelta(hours=3, minutes=15)}
        )
        Message.objects.get_or_create(
            conversation=conv3,
            direction=Message.DIR_OUTBOUND,
            content="Hi David! Our support team is online 24/7. Phone and billing specialists are available Mon-Fri, 9am - 6pm EST.",
            defaults={'status': Message.STATUS_READ, 'timestamp': now - timedelta(hours=3)}
        )

        # Conversation 4: Resolved Chat
        c4 = contacts_map['Elena Rostova']
        conv4, _ = Conversation.objects.get_or_create(
            contact=c4,
            defaults={
                'status': Conversation.STATUS_RESOLVED,
                'assigned_agent': 'Supervisor Agent',
                'unread_count': 0,
                'last_message_at': now - timedelta(days=1),
                'resolved_at': now - timedelta(hours=22),
                'first_response_time_seconds': 18.0
            }
        )
        Message.objects.get_or_create(
            conversation=conv4,
            direction=Message.DIR_INBOUND,
            content="Can you send our latest VAT invoice for July?",
            defaults={'status': Message.STATUS_READ, 'timestamp': now - timedelta(days=1, hours=2)}
        )
        Message.objects.get_or_create(
            conversation=conv4,
            direction=Message.DIR_OUTBOUND,
            content="Here is your PDF tax invoice for July. Have a wonderful day!",
            defaults={'status': Message.STATUS_READ, 'timestamp': now - timedelta(days=1)}
        )

        # 6. Broadcast Campaign
        campaign, _ = BroadcastCampaign.objects.update_or_create(
            name="Q4 Enterprise WhatsApp VIP Promo",
            defaults={
                'template': created_tpls[0],
                'target_tag': 'VIP',
                'status': BroadcastCampaign.STATUS_COMPLETED,
                'total_recipients': 3,
                'sent_count': 3,
                'delivered_count': 3,
                'read_count': 2,
                'failed_count': 0,
                'variables_mapping': {'1': 'contact.name', '2': 'VIP25'}
            }
        )
        for contact in [contacts_map['Marcus Vance'], contacts_map['Elena Rostova'], contacts_map['Priya Sharma']]:
            CampaignRecipient.objects.get_or_create(
                campaign=campaign,
                contact=contact,
                defaults={
                    'status': CampaignRecipient.STATUS_READ if contact.name != 'Priya Sharma' else CampaignRecipient.STATUS_DELIVERED,
                    'sent_at': now - timedelta(days=2)
                }
            )

        self.stdout.write(self.style.SUCCESS(f"Seeded Broadcast Campaign '{campaign.name}' with recipients."))
        self.stdout.write(self.style.SUCCESS("All Enterprise Sprint 2 CRM demo data seeded successfully!"))
