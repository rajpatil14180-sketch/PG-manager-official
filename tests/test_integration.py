"""Automated end-to-end integration test for PG Manager API and business workflows."""
import json
import os
import shutil
import sqlite3
import threading
import time
import unittest
from datetime import date
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

import config
import database
import web_api


class PGManagerIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Use a copy of the actual database or run against pg.db in read-and-rollback mode
        # To avoid modifying pg.db permanently during test, let's copy pg.db to a test file
        cls.test_db = "test_pg_integration.db"
        shutil.copyfile("pg.db", cls.test_db)
        config.DB_NAME = cls.test_db

        # Start a local test server on an ephemeral or fixed high port
        cls.port = 8799
        cls.server = ThreadingHTTPServer(("127.0.0.1", cls.port), web_api.Handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        config.DB_NAME = "pg.db"
        if os.path.exists(cls.test_db):
            try:
                os.remove(cls.test_db)
            except Exception:
                pass

    def _req(self, method, path, body=None, token=None):
        conn = HTTPConnection("127.0.0.1", self.port)
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        data = json.dumps(body) if body is not None else None
        conn.request(method, path, body=data, headers=headers)
        res = conn.getresponse()
        raw = res.read().decode("utf-8")
        parsed = json.loads(raw) if raw else None
        return res.status, parsed

    def test_01_owner_login(self):
        status, data = self._req("POST", "/api/login", {"username": "owner", "password": "owner123"})
        self.assertEqual(status, 200)
        self.assertIn("token", data)
        self.assertEqual(data["user"]["role"], "owner")
        self.__class__.owner_token = data["token"]

    def test_02_owner_sees_all_properties_and_overview(self):
        token = self.__class__.owner_token
        status, data = self._req("GET", "/api/owner/overview", token=token)
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(data["properties"]), 2)
        self.assertGreaterEqual(data["metrics"]["total_beds"], 16)
        self.assertIn("recent_payments", data)
        self.assertIn("overdue_tenants", data)
        self.assertIn("open_tickets", data)

    def test_03_owner_views_property_floor_plan(self):
        token = self.__class__.owner_token
        status, layout = self._req("GET", "/api/pgs/1/layout", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(len(layout), 4)  # 4 rooms
        for room in layout:
            self.assertEqual(len(room["beds"]), 2)  # 2 beds per room

    def test_04_owner_views_bed_and_pricing_suggestion(self):
        token = self.__class__.owner_token
        # Inspect bed 7 in Room 4
        status, bed_info = self._req("GET", "/api/beds/7", token=token)
        self.assertEqual(status, 200)
        self.assertIn("bed", bed_info)
        # Pricing suggestion
        status, sugg = self._req("GET", "/api/pricing/suggestion?bed_id=7&join_date=2026-10-01", token=token)
        self.assertEqual(status, 200)
        self.assertIn("suggested_price", sugg)

    def test_05_owner_adds_tenant_and_tenant_logs_in(self):
        token = self.__class__.owner_token
        # Find an empty bed in PG 1
        status, layout = self._req("GET", "/api/pgs/1/layout", token=token)
        empty_bed = None
        for r in layout:
            for b in r["beds"]:
                if b["status"] == "empty":
                    empty_bed = b
                    break
            if empty_bed:
                break
        self.assertIsNotNone(empty_bed, "Should have at least 1 vacant bed in sample data")

        # Add tenant
        new_username = f"testuser_{int(time.time())}"
        status, add_res = self._req("POST", "/api/pgs/1/tenants", {
            "bed_id": empty_bed["bed_id"],
            "name": "Integration Tester",
            "phone": "9876543210",
            "join_date": "2026-09-15",
            "deposit": 10000,
            "agreed_yearly_price": 120000,
            "username": new_username,
            "password": "password123"
        }, token=token)
        self.assertEqual(status, 201)
        tenant_id = add_res["tenant_id"]

        # New tenant logs in
        status, t_login = self._req("POST", "/api/login", {"username": new_username, "password": "password123"})
        self.assertEqual(status, 200)
        self.assertEqual(t_login["user"]["role"], "tenant")
        new_tenant_token = t_login["token"]

        # Tenant checks their home
        status, t_home = self._req("GET", "/api/tenant/home", token=new_tenant_token)
        self.assertEqual(status, 200)
        self.assertEqual(t_home["profile"]["name"], "Integration Tester")
        self.assertEqual(t_home["profile"]["deposit"], 10000)
        self.assertEqual(t_home["financials"]["agreed_yearly_price"], 120000)
        self.assertEqual(len(t_home["financials"]["installments"]), 12)

        # Tenant cannot access owner APIs (Security check)
        status, _ = self._req("GET", "/api/owner/overview", token=new_tenant_token)
        self.assertEqual(status, 403)
        status, _ = self._req("GET", "/api/pgs", token=new_tenant_token)
        self.assertEqual(status, 403)
        status, _ = self._req("GET", f"/api/tenants/{tenant_id}", token=new_tenant_token)
        self.assertEqual(status, 403)

        # Tenant raises maintenance request
        status, t_ticket = self._req("POST", "/api/tenant/tickets", {
            "category": "Plumbing",
            "urgency": "High",
            "description": "Bathroom tap dripping continuously"
        }, token=new_tenant_token)
        self.assertEqual(status, 201)
        ticket_id = t_ticket["id"]

        # Owner sees this ticket and updates status
        status, tickets = self._req("GET", "/api/owner/tickets", token=token)
        self.assertEqual(status, 200)
        self.assertTrue(any(t["id"] == ticket_id for t in tickets))

        status, _ = self._req("POST", f"/api/tickets/{ticket_id}/status", {"status": "In Progress"}, token=token)
        self.assertEqual(status, 200)

        # Tenant sees updated status
        status, t_home_updated = self._req("GET", "/api/tenant/home", token=new_tenant_token)
        my_t = next(t for t in t_home_updated["tickets"] if t["id"] == ticket_id)
        self.assertEqual(my_t["status"], "In Progress")

        # Owner records payment for this tenant
        status, pay_res = self._req("POST", f"/api/tenants/{tenant_id}/payments", {
            "amount": 20000,
            "paid_on": "2026-09-15",
            "mode": "upi"
        }, token=token)
        self.assertEqual(status, 201)

        # Check tenant financials updated
        status, t_fin = self._req("GET", f"/api/tenants/{tenant_id}", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(t_fin["financials"]["total_paid"], 20000)
        self.assertEqual(t_fin["financials"]["due_left"], 100000)

        # Owner vacates tenant
        status, _ = self._req("POST", f"/api/tenants/{tenant_id}/vacate", token=token)
        self.assertEqual(status, 200)

        # Tenant cannot log in once vacated
        status, _ = self._req("POST", "/api/login", {"username": new_username, "password": "password123"})
        self.assertEqual(status, 401)

        # History is preserved!
        status, t_fin_after = self._req("GET", f"/api/tenants/{tenant_id}", token=token)
        self.assertEqual(status, 200)
        self.assertEqual(t_fin_after["profile"]["is_active"], 0)
        self.assertEqual(t_fin_after["financials"]["total_paid"], 20000)
        self.assertEqual(len(t_fin_after["financials"]["payments"]), 1)

    def test_06_announcements_workflow(self):
        token = self.__class__.owner_token
        status, ann_res = self._req("POST", "/api/pgs/1/announcements", {
            "message": "Routine water tank maintenance test notice"
        }, token=token)
        self.assertEqual(status, 201)
        ann_id = ann_res["id"]

        # View announcements
        status, ann_list = self._req("GET", "/api/pgs/1/announcements", token=token)
        self.assertEqual(status, 200)
        self.assertTrue(any(a["id"] == ann_id for a in ann_list))

        # Delete announcement
        status, _ = self._req("DELETE", f"/api/announcements/{ann_id}", token=token)
        self.assertEqual(status, 200)

        # Verify deleted
        status, ann_list_after = self._req("GET", "/api/pgs/1/announcements", token=token)
        self.assertFalse(any(a["id"] == ann_id for a in ann_list_after))


if __name__ == "__main__":
    unittest.main()
