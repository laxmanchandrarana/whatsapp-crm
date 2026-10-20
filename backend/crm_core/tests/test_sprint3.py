import json
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from crm_core.models import Contact, WhatsAppGroup, BotFlow, BotSession, Message, Conversation
from crm_core.tasks import process_bot_flow_step, replace_template_variables


class DoubleTickSprint3BackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.contact = Contact.objects.create(
            name="Alice Walker",
            phone_number="+15551234567",
            email="alice@acme.com",
            tags=["vip", "enterprise"],
            custom_attributes={"company": "Acme Corp", "tier": "gold", "lead_score": 95}
        )

    def test_contact_custom_attributes_api(self):
        """Contacts API exposes and stores custom attributes correctly."""
        res = self.client.get(f"/api/contacts/{self.contact.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["custom_attributes"]["company"], "Acme Corp")
        self.assertEqual(data["custom_attributes"]["tier"], "gold")

    def test_contact_tag_filtering(self):
        """ContactViewSet supports filtering by tag."""
        Contact.objects.create(
            name="Bob Casual",
            phone_number="+15559876543",
            tags=["trial"]
        )
        res_vip = self.client.get("/api/contacts/?tag=vip")
        self.assertEqual(res_vip.status_code, status.HTTP_200_OK)
        results = res_vip.json().get('results', res_vip.json())
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Alice Walker")

    def test_contact_import_csv(self):
        """DoubleTick bulk audience importer processes CSV text and populates custom attributes."""
        csv_data = (
            "name,phone,email,tags,company,industry\n"
            "David Miller,+15554443333,david@tech.io,lead,Tech Co,SaaS\n"
            "Emma Stone,+15557778888,emma@stone.com,vip,Stone Ltd,Media\n"
        )
        res = self.client.post("/api/contacts/import-csv/", {"csv_text": csv_data}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertEqual(data["created_count"], 2)

        c = Contact.objects.get(phone_number="+15554443333")
        self.assertEqual(c.name, "David Miller")
        self.assertEqual(c.custom_attributes.get("company"), "Tech Co")
        self.assertEqual(c.custom_attributes.get("industry"), "SaaS")

    def test_whatsapp_groups_api(self):
        """WhatsApp Business groups directory and broadcast messaging."""
        group = WhatsAppGroup.objects.create(
            name="VIP Platinum Clients",
            group_id="120363025555555555@g.us",
            description="High value account holders",
            participants_count=42
        )
        res = self.client.get(f"/api/groups/{group.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()["participants_count"], 42)

        # Send group broadcast message
        send_res = self.client.post(f"/api/groups/{group.id}/send-message/", {"message": "Urgent product update!"})
        self.assertEqual(send_res.status_code, status.HTTP_200_OK)
        self.assertEqual(send_res.json()["status"], "sent")

    def test_bot_variable_replacement(self):
        """DoubleTick template variable replacements with merge tags and custom attributes."""
        text = "Hello {{name}} from {{company}}! Your tier is {{custom_attributes.tier}}."
        rendered = replace_template_variables(text, self.contact)
        self.assertEqual(rendered, "Hello Alice Walker from Acme Corp! Your tier is gold.")

    def test_bot_studio_test_run_user_input_and_conditions(self):
        """DoubleTick Bot Studio test-run simulator executes User Input and Condition branching."""
        flow = BotFlow.objects.create(
            name="Qualification Bot",
            trigger_type="KEYWORD",
            trigger_keywords=["qualify"],
            nodes=[
                {
                    "id": "node_input",
                    "type": "user_input",
                    "validation_type": "email",
                    "validation_error": "Please provide a valid corporate email.",
                    "attribute_name": "lead_email",
                    "target_node_id": "node_cond"
                },
                {
                    "id": "node_cond",
                    "type": "condition",
                    "field": "tier",
                    "operator": "equals",
                    "value": "gold",
                    "branch_a_target": "node_vip_msg",
                    "branch_b_target": "node_standard_msg"
                },
                {
                    "id": "node_vip_msg",
                    "type": "send_message",
                    "content": "Welcome to Gold VIP Priority Support, {{name}}!"
                },
                {
                    "id": "node_standard_msg",
                    "type": "send_message",
                    "content": "Thanks for your info, {{name}}."
                }
            ],
            edges=[]
        )

        # 1. Invalid email
        res_invalid = self.client.post(f"/api/bot-flows/{flow.id}/test-run/", {
            "current_node_id": "node_input",
            "message": "not-an-email"
        }, format="json")
        self.assertIn("valid corporate email", res_invalid.json()["response_text"])

        # 2. Valid email saves attribute and moves to condition branch
        res_valid = self.client.post(f"/api/bot-flows/{flow.id}/test-run/", {
            "current_node_id": "node_input",
            "message": "alice@acme.com",
            "contact": {
                "name": "Alice Walker",
                "custom_attributes": {"tier": "gold"}
            }
        }, format="json")
        self.assertEqual(res_valid.json()["updated_attributes"].get("lead_email"), "alice@acme.com")
        self.assertEqual(res_valid.json()["next_node_id"], "node_cond")

        # 3. Test condition evaluation
        res_cond = self.client.post(f"/api/bot-flows/{flow.id}/test-run/", {
            "current_node_id": "node_cond",
            "message": "",
            "contact": {
                "name": "Alice Walker",
                "custom_attributes": {"tier": "gold"}
            }
        }, format="json")
        self.assertIn("Gold VIP Priority Support, Alice Walker", res_cond.json()["response_text"])

    def test_bot_studio_interactive_buttons_test_run(self):
        """DoubleTick Bot Studio test-run simulator renders interactive buttons and selection routing."""
        flow = BotFlow.objects.create(
            name="Interactive Demo",
            trigger_type="ALWAYS",
            nodes=[
                {
                    "id": "node_btn",
                    "type": "interactive_buttons",
                    "content": "Please select a service:",
                    "buttons": [
                        {"id": "btn_sales", "title": "Sales", "target_node_id": "node_sales"},
                        {"id": "btn_support", "title": "Support", "target_node_id": "node_support"}
                    ]
                },
                {
                    "id": "node_sales",
                    "type": "send_message",
                    "content": "Connecting to Sales department."
                }
            ],
            edges=[]
        )

        # First visit: returns button interactive payload
        res1 = self.client.post(f"/api/bot-flows/{flow.id}/test-run/", {
            "current_node_id": "node_btn",
            "message": ""
        }, format="json")
        self.assertEqual(res1.json()["interactive_type"], "button")
        self.assertEqual(len(res1.json()["interactive_payload"]), 2)

        # Select button: routes to sales
        res2 = self.client.post(f"/api/bot-flows/{flow.id}/test-run/", {
            "current_node_id": "node_btn",
            "message": "Sales"
        }, format="json")
        self.assertIn("Connecting to Sales department", res2.json()["response_text"])
