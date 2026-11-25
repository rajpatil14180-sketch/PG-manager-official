"""PG Manager's standard-library JSON API for the React frontend.

Local development: run ``py web_api.py`` from the project root.
Production hosting needs HTTPS, a production process manager, and an origin
allow-list configured through PG_MANAGER_WEB_ORIGIN; do not expose this dev server
straight to the public internet.
"""
import json
import os
import secrets
import base64
import hashlib
import hmac
import time
import sqlite3
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from database import create_tables, get_connection
from core.auth import login
from core.pg_service import (
    get_pgs_for_owner, get_pg_layout, get_pg_summary, get_bed_details,
    get_tenant_home_details,
)
from core.finance import get_tenant_financials
from core.tenant_service import add_tenant, add_payment, vacate_tenant
from core.ticket_service import (
    get_tickets_for_pg, get_tickets_for_tenant, update_ticket_status, create_ticket,
)
from core.announcement_service import (
    get_announcements_for_pg, add_announcement, delete_announcement,
)
from core.pricing import calculate_agreed_price
from core.analytics import get_owner_dashboard

def _token_secret():
    secret = os.environ.get("PG_MANAGER_TOKEN_SECRET")
    if secret:
        return secret.encode("utf-8")
    if os.environ.get("VERCEL") == "1":
        raise RuntimeError("PG_MANAGER_TOKEN_SECRET is not configured.")
    return b"local-development-only-secret"


def _encode_token(user):
    payload = {
        "user": user,
        "exp": int(time.time()) + 8 * 60 * 60,
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    body = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    signature = hmac.new(
        _token_secret(), body.encode("ascii"), hashlib.sha256
    ).digest()
    signed = base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")
    return body + "." + signed


def _decode_token(token):
    try:
        body, supplied_signature = token.split(".", 1)
        expected = hmac.new(
            _token_secret(), body.encode("ascii"), hashlib.sha256
        ).digest()
        supplied = base64.urlsafe_b64decode(
            supplied_signature + "=" * (-len(supplied_signature) % 4)
        )
        if not hmac.compare_digest(expected, supplied):
            return None

        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        payload = json.loads(raw.decode("utf-8"))
        if payload.get("exp", 0) < int(time.time()):
            return None

        user = payload.get("user")
        return user if isinstance(user, dict) else None
    except (ValueError, TypeError, KeyError, UnicodeError):
        return None
    except RuntimeError:
        return None


WEB_ORIGIN = os.environ.get("PG_MANAGER_WEB_ORIGIN", os.environ.get("GHARPAR_WEB_ORIGIN", "http://127.0.0.1:5173"))


def _json_default(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    raise TypeError(type(value).__name__)


class Handler(BaseHTTPRequestHandler):
    server_version = "PGManagerAPI/1.2"

    def log_message(self, fmt, *args):
        print("[PG Manager API] " + fmt % args)

    def _send(self, status, payload):
        body = json.dumps(payload, default=_json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin")
        if origin == WEB_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", WEB_ORIGIN)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.end_headers()
        if status != 204:
            self.wfile.write(body)

    def _body(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size > 1_000_000:
            raise ValueError("Request body is too large.")
        raw = self.rfile.read(size).decode("utf-8") if size else "{}"
        data = json.loads(raw or "{}")
        if not isinstance(data, dict):
            raise ValueError("Request body must be a JSON object.")
        return data

    def _user(self):
        token = self.headers.get("Authorization", "").removeprefix("Bearer ")
        return _decode_token(token)

    def _owned_pg(self, user, pg_id):
        return any(item["id"] == pg_id for item in get_pgs_for_owner(user["user_id"]))

    def _tenant_owner(self, tenant_id):
        conn = get_connection()
        try:
            return conn.execute(
                "SELECT p.owner_id, t.user_id, t.is_active, t.bed_id, r.pg_id "
                "FROM tenants t LEFT JOIN beds b ON b.id=t.bed_id "
                "LEFT JOIN rooms r ON r.id=b.room_id "
                "LEFT JOIN pgs p ON p.id=r.pg_id WHERE t.id=?", (tenant_id,)
            ).fetchone()
        finally:
            conn.close()

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        user = self._user()
        if not user:
            return self._send(401, {"error": "Please sign in to continue."})
        try:
            if path == "/api/me":
                return self._send(200, {"username": user["username"], "role": user["role"], "tenant_id": user.get("tenant_id")})
            if user["role"] == "tenant":
                if path == "/api/tenant/home":
                    details = get_tenant_home_details(user["tenant_id"])
                    financials = get_tenant_financials(user["tenant_id"])
                    if not details or not details.get("pg_id"):
                        return self._send(404, {"error": "Your active tenancy could not be found."})
                    return self._send(200, {
                        "profile": details, "financials": financials,
                        "announcements": get_announcements_for_pg(details["pg_id"]),
                        "tickets": get_tickets_for_tenant(user["tenant_id"]),
                        "ticket_categories": ["Plumbing", "Electrical", "Wi-Fi", "Cleaning", "Furniture", "Other"],
                        "ticket_urgencies": ["Low", "Medium", "High"],
                    })
                if path == "/api/tenant/options":
                    return self._send(200, {"ticket_categories": ["Plumbing", "Electrical", "Wi-Fi", "Cleaning", "Furniture", "Other"], "ticket_urgencies": ["Low", "Medium", "High"]})
                return self._send(403, {"error": "This action is not available to tenant accounts."})
            
            # OWNER ENDPOINTS
            if path == "/api/pgs":
                return self._send(200, get_pgs_for_owner(user["user_id"]))
            if path == "/api/tenant/options":
                return self._send(200, {"ticket_categories": ["Plumbing", "Electrical", "Wi-Fi", "Cleaning", "Furniture", "Other"], "ticket_urgencies": ["Low", "Medium", "High"]})
            if path == "/api/owner/dashboard":
                query = parse_qs(urlparse(self.path).query)
                month_param = query.get("month", [None])[0]
                return self._send(200, get_owner_dashboard(user["user_id"], month_param))
            if path == "/api/pricing/suggestion":
                query = parse_qs(urlparse(self.path).query)
                bed_id = int(query.get("bed_id", ["0"])[0])
                join_text = query.get("join_date", [date.today().isoformat()])[0]
                join_day = date.fromisoformat(join_text)
                conn = get_connection()
                try:
                    row = conn.execute("SELECT b.base_yearly_price,p.owner_id FROM beds b JOIN rooms r ON r.id=b.room_id JOIN pgs p ON p.id=r.pg_id WHERE b.id=?", (bed_id,)).fetchone()
                finally:
                    conn.close()
                if row is None or row["owner_id"] != user["user_id"]:
                    return self._send(404, {"error": "Bed not found."})
                return self._send(200, {"suggested_price": calculate_agreed_price(row["base_yearly_price"], join_day)})

            if path == "/api/owner/overview":
                pgs_list = get_pgs_for_owner(user["user_id"])
                total_properties = len(pgs_list)
                total_beds = sum(p["total_beds"] for p in pgs_list)
                occupied_beds = sum(p["occupied_beds"] for p in pgs_list)
                vacant_beds = max(0, total_beds - occupied_beds)
                occupancy_rate = round((occupied_beds / total_beds) * 100) if total_beds else 0
                
                conn = get_connection()
                try:
                    # Active tenants under owner's properties
                    active_rows = conn.execute(
                        "SELECT t.id AS tenant_id, t.name, t.phone, t.join_date, t.deposit, t.agreed_yearly_price, "
                        "b.label AS bed_label, r.room_no, p.id AS pg_id, p.name AS pg_name "
                        "FROM tenants t JOIN beds b ON b.id = t.bed_id "
                        "JOIN rooms r ON r.id = b.room_id "
                        "JOIN pgs p ON p.id = r.pg_id "
                        "WHERE p.owner_id = ? AND t.is_active = 1",
                        (user["user_id"],)
                    ).fetchall()

                    total_expected = 0
                    total_collected = 0
                    total_agreed = 0
                    outstanding_amount = 0
                    total_overdue = 0
                    overdue_tenants = []
                    today = date.today()

                    for row in active_rows:
                        fin = get_tenant_financials(row["tenant_id"], today)
                        if fin:
                            total_expected += fin["expected_till_today"]
                            total_collected += fin["total_paid"]
                            total_agreed += fin["agreed_yearly_price"]
                            outstanding_amount += fin["due_left"]
                            total_overdue += fin["overdue_amount"]
                            if fin["overdue_amount"] > 0:
                                overdue_tenants.append({
                                    "tenant_id": row["tenant_id"],
                                    "name": row["name"],
                                    "phone": row["phone"],
                                    "pg_id": row["pg_id"],
                                    "pg_name": row["pg_name"],
                                    "room_no": row["room_no"],
                                    "bed_label": row["bed_label"],
                                    "agreed_yearly_price": fin["agreed_yearly_price"],
                                    "total_paid": fin["total_paid"],
                                    "due_left": fin["due_left"],
                                    "overdue_amount": fin["overdue_amount"],
                                    "next_due_date": fin["next_due_date"],
                                })

                    # Recent payments across owner's properties
                    pay_rows = conn.execute(
                        "SELECT p.id, p.amount, p.paid_on, p.mode, "
                        "t.id AS tenant_id, t.name AS tenant_name, t.phone AS tenant_phone, "
                        "pg.id AS pg_id, pg.name AS pg_name, r.room_no, b.label AS bed_label "
                        "FROM payments p "
                        "JOIN tenants t ON t.id = p.tenant_id "
                        "JOIN beds b ON b.id = t.bed_id "
                        "JOIN rooms r ON r.id = b.room_id "
                        "JOIN pgs pg ON pg.id = r.pg_id "
                        "WHERE pg.owner_id = ? "
                        "ORDER BY p.paid_on DESC, p.id DESC LIMIT 10",
                        (user["user_id"],)
                    ).fetchall()
                    recent_payments = [dict(r) for r in pay_rows]

                    # Open/unresolved tickets across owner's properties
                    ticket_rows = conn.execute(
                        "SELECT tk.id, tk.category, tk.description, tk.urgency, tk.status, tk.created_at, "
                        "t.name AS tenant_name, r.room_no, b.label AS bed_label, pg.id AS pg_id, pg.name AS pg_name "
                        "FROM tickets tk "
                        "JOIN tenants t ON t.id = tk.tenant_id "
                        "LEFT JOIN beds b ON b.id = t.bed_id "
                        "LEFT JOIN rooms r ON r.id = b.room_id "
                        "JOIN pgs pg ON pg.id = tk.pg_id "
                        "WHERE pg.owner_id = ? "
                        "ORDER BY CASE tk.urgency WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, tk.created_at ASC",
                        (user["user_id"],)
                    ).fetchall()
                    open_tickets = []
                    for tr in ticket_rows:
                        td = dict(tr)
                        c_date = datetime.fromisoformat(td["created_at"]).date()
                        td["age_in_days"] = max(0, (today - c_date).days)
                        open_tickets.append(td)

                    # Announcements across owner's properties
                    ann_rows = conn.execute(
                        "SELECT a.id, a.message, a.created_at, pg.id AS pg_id, pg.name AS pg_name "
                        "FROM announcements a "
                        "JOIN pgs pg ON pg.id = a.pg_id "
                        "WHERE pg.owner_id = ? "
                        "ORDER BY a.created_at DESC LIMIT 5",
                        (user["user_id"],)
                    ).fetchall()
                    recent_announcements = [dict(a) for a in ann_rows]

                finally:
                    conn.close()

                return self._send(200, {
                    "properties": pgs_list,
                    "metrics": {
                        "total_properties": total_properties,
                        "total_beds": total_beds,
                        "occupied_beds": occupied_beds,
                        "vacant_beds": vacant_beds,
                        "occupancy_rate": occupancy_rate,
                        "active_tenants": len(active_rows),
                        "overdue_tenants": len(overdue_tenants),
                        "total_expected": total_expected,
                        "total_collected": total_collected,
                        "total_agreed": total_agreed,
                        "outstanding_amount": outstanding_amount,
                        "total_overdue": total_overdue,
                        "open_tickets_count": len([t for t in open_tickets if t["status"] != "Resolved"]),
                    },
                    "recent_payments": recent_payments,
                    "overdue_tenants": overdue_tenants,
                    "open_tickets": [t for t in open_tickets if t["status"] != "Resolved"],
                    "all_tickets": open_tickets,
                    "recent_announcements": recent_announcements,
                })

            if path == "/api/owner/finance":
                pgs_list = get_pgs_for_owner(user["user_id"])
                conn = get_connection()
                try:
                    # All active and inactive tenants with financials
                    ten_rows = conn.execute(
                        "SELECT t.id AS tenant_id, t.name, t.phone, t.join_date, t.deposit, t.agreed_yearly_price, "
                        "t.is_active, b.label AS bed_label, r.room_no, p.id AS pg_id, p.name AS pg_name "
                        "FROM tenants t "
                        "LEFT JOIN beds b ON b.id = t.bed_id "
                        "LEFT JOIN rooms r ON r.id = b.room_id "
                        "LEFT JOIN pgs p ON p.id = r.pg_id "
                        "WHERE p.owner_id = ? "
                        "ORDER BY t.is_active DESC, t.name COLLATE NOCASE",
                        (user["user_id"],)
                    ).fetchall()
                    tenants_finance = []
                    total_expected = 0
                    total_collected = 0
                    total_outstanding = 0
                    total_overdue = 0
                    today = date.today()

                    for r in ten_rows:
                        item = dict(r)
                        fin = get_tenant_financials(item["tenant_id"], today)
                        item["financials"] = fin
                        if fin:
                            if item["is_active"]:
                                total_expected += fin["expected_till_today"]
                                total_outstanding += fin["due_left"]
                                total_overdue += fin["overdue_amount"]
                            total_collected += fin["total_paid"]
                        tenants_finance.append(item)

                    # All payments across owner properties
                    pay_rows = conn.execute(
                        "SELECT p.id, p.amount, p.paid_on, p.mode, "
                        "t.id AS tenant_id, t.name AS tenant_name, t.phone AS tenant_phone, "
                        "pg.id AS pg_id, pg.name AS pg_name, r.room_no, b.label AS bed_label "
                        "FROM payments p "
                        "JOIN tenants t ON t.id = p.tenant_id "
                        "JOIN beds b ON b.id = t.bed_id "
                        "JOIN rooms r ON r.id = b.room_id "
                        "JOIN pgs pg ON pg.id = r.pg_id "
                        "WHERE pg.owner_id = ? "
                        "ORDER BY p.paid_on DESC, p.id DESC",
                        (user["user_id"],)
                    ).fetchall()
                    all_payments = [dict(p) for p in pay_rows]

                    # Property-wise summaries
                    property_summaries = []
                    for pg in pgs_list:
                        summ = get_pg_summary(pg["id"], today)
                        property_summaries.append({**pg, **summ})

                finally:
                    conn.close()

                return self._send(200, {
                    "summary": {
                        "total_expected": total_expected,
                        "total_collected": total_collected,
                        "outstanding_amount": total_outstanding,
                        "total_overdue": total_overdue,
                    },
                    "property_summaries": property_summaries,
                    "tenants": tenants_finance,
                    "payments": all_payments,
                })

            if path == "/api/owner/tenants":
                conn = get_connection()
                try:
                    rows = conn.execute(
                        "SELECT t.id AS tenant_id, t.name, t.phone, t.join_date, t.deposit, t.agreed_yearly_price, "
                        "t.is_active, b.label AS bed_label, r.room_no, p.id AS pg_id, p.name AS pg_name "
                        "FROM tenants t "
                        "LEFT JOIN beds b ON b.id = t.bed_id "
                        "LEFT JOIN rooms r ON r.id = b.room_id "
                        "LEFT JOIN pgs p ON p.id = r.pg_id "
                        "WHERE p.owner_id = ? "
                        "ORDER BY t.is_active DESC, t.name COLLATE NOCASE",
                        (user["user_id"],)
                    ).fetchall()
                    result = []
                    today = date.today()
                    for row in rows:
                        item = dict(row)
                        item["financials"] = get_tenant_financials(item["tenant_id"], today)
                        result.append(item)
                    return self._send(200, result)
                finally:
                    conn.close()

            if path == "/api/owner/tickets":
                conn = get_connection()
                try:
                    rows = conn.execute(
                        "SELECT tk.*, t.name AS tenant_name, r.room_no, b.label AS bed_label, "
                        "p.id AS pg_id, p.name AS pg_name "
                        "FROM tickets tk "
                        "JOIN tenants t ON t.id = tk.tenant_id "
                        "LEFT JOIN beds b ON b.id = t.bed_id "
                        "LEFT JOIN rooms r ON r.id = b.room_id "
                        "JOIN pgs p ON p.id = tk.pg_id "
                        "WHERE p.owner_id = ? "
                        "ORDER BY tk.created_at ASC, tk.id ASC",
                        (user["user_id"],)
                    ).fetchall()
                    today = date.today()
                    result = []
                    for row in rows:
                        item = dict(row)
                        c_date = datetime.fromisoformat(item["created_at"]).date()
                        item["age_in_days"] = max(0, (today - c_date).days)
                        result.append(item)
                    return self._send(200, result)
                finally:
                    conn.close()

            parts = path.split("/")
            if len(parts) >= 4 and parts[1:3] == ["api", "pgs"] and parts[3].isdigit():
                pg_id = int(parts[3])
                if not self._owned_pg(user, pg_id):
                    return self._send(404, {"error": "Property not found."})
                if len(parts) == 5 and parts[4] == "layout":
                    return self._send(200, get_pg_layout(pg_id))
                if len(parts) == 5 and parts[4] == "summary":
                    return self._send(200, get_pg_summary(pg_id))
                if len(parts) == 5 and parts[4] == "tickets":
                    return self._send(200, get_tickets_for_pg(pg_id, include_resolved=True))
                if len(parts) == 5 and parts[4] == "announcements":
                    return self._send(200, get_announcements_for_pg(pg_id))
                if len(parts) == 5 and parts[4] == "tenants":
                    conn = get_connection()
                    try:
                        rows = conn.execute(
                            "SELECT t.id AS tenant_id,t.name,t.phone,t.join_date,t.deposit,t.agreed_yearly_price,"
                            "t.is_active,b.label AS bed_label,r.room_no, p.name AS pg_name, p.id AS pg_id FROM tenants t "
                            "JOIN beds b ON b.id=t.bed_id JOIN rooms r ON r.id=b.room_id JOIN pgs p ON p.id=r.pg_id "
                            "WHERE r.pg_id=? ORDER BY t.is_active DESC,t.name COLLATE NOCASE", (pg_id,)
                        ).fetchall()
                    finally:
                        conn.close()
                    result = []
                    for row in rows:
                        item = dict(row)
                        item["financials"] = get_tenant_financials(item["tenant_id"])
                        result.append(item)
                    return self._send(200, result)
            if len(parts) == 4 and parts[1:3] == ["api", "beds"] and parts[3].isdigit():
                details = get_bed_details(int(parts[3]))
                if details is None:
                    return self._send(404, {"error": "Bed not found."})
                conn = get_connection()
                try:
                    row = conn.execute("SELECT p.owner_id FROM beds b JOIN rooms r ON r.id=b.room_id JOIN pgs p ON p.id=r.pg_id WHERE b.id=?", (int(parts[3]),)).fetchone()
                finally:
                    conn.close()
                if row is None or row["owner_id"] != user["user_id"]:
                    return self._send(404, {"error": "Bed not found."})
                return self._send(200, details)
            if len(parts) == 4 and parts[1:3] == ["api", "tenants"] and parts[3].isdigit():
                tenant_id = int(parts[3])
                row = self._tenant_owner(tenant_id)
                if row is None or row["owner_id"] != user["user_id"]:
                    return self._send(404, {"error": "Tenant not found."})
                conn = get_connection()
                try:
                    profile = conn.execute(
                        "SELECT t.id AS tenant_id, t.name, t.phone, t.join_date, t.deposit, t.agreed_yearly_price, "
                        "t.is_active, t.bed_id, b.label AS bed_label, r.room_no, p.name AS pg_name, p.id AS pg_id "
                        "FROM tenants t LEFT JOIN beds b ON b.id=t.bed_id "
                        "LEFT JOIN rooms r ON r.id=b.room_id "
                        "LEFT JOIN pgs p ON p.id=r.pg_id "
                        "WHERE t.id=?",
                        (tenant_id,)
                    ).fetchone()
                finally:
                    conn.close()
                return self._send(200, {"profile": dict(profile), "financials": get_tenant_financials(tenant_id)})
            return self._send(404, {"error": "Endpoint not found."})
        except (ValueError, TypeError) as exc:
            return self._send(400, {"error": str(exc)})
        except sqlite3.IntegrityError:
            return self._send(400, {"error": "The record conflicts with existing data. Check the username and bed assignment."})
        except Exception as exc:
            print(f"[PG Manager API] Request failed: {exc}")
            return self._send(500, {"error": "The request could not be completed. Check the API terminal for details."})

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            data = self._body()
            if path == "/api/login":
                result = login(str(data.get("username", "")).strip(), str(data.get("password", "")))
                if not result:
                    return self._send(401, {"error": "Incorrect username or password, or account inactive."})
                token = _encode_token(result)
                return self._send(200, {"token": token, "user": {"username": result["username"], "role": result["role"], "tenant_id": result.get("tenant_id")}})
            user = self._user()
            if not user:
                return self._send(401, {"error": "Please sign in to continue."})
            if path == "/api/logout":
                return self._send(200, {"ok": True})
            if user["role"] == "tenant":
                if path == "/api/tenant/tickets":
                    ticket_id = create_ticket(user["tenant_id"], str(data.get("category", "")), str(data.get("description", "")), str(data.get("urgency", "")))
                    return self._send(201, {"id": ticket_id})
                return self._send(403, {"error": "Owner access required."})
            parts = path.split("/")
            if len(parts) == 5 and parts[1:3] == ["api", "pgs"] and parts[3].isdigit() and parts[4] == "announcements":
                pg_id = int(parts[3])
                if not self._owned_pg(user, pg_id):
                    return self._send(404, {"error": "Property not found."})
                announcement_id = add_announcement(pg_id, str(data.get("message", "")))
                return self._send(201, {"id": announcement_id})
            if len(parts) == 5 and parts[1:3] == ["api", "pgs"] and parts[3].isdigit() and parts[4] == "tenants":
                pg_id = int(parts[3])
                if not self._owned_pg(user, pg_id):
                    return self._send(404, {"error": "Property not found."})
                bed_id = int(data.get("bed_id", 0))
                conn = get_connection()
                try:
                    bed = conn.execute("SELECT b.base_yearly_price,p.id AS pg_id,p.owner_id FROM beds b JOIN rooms r ON r.id=b.room_id JOIN pgs p ON p.id=r.pg_id WHERE b.id=?", (bed_id,)).fetchone()
                finally:
                    conn.close()
                if bed is None or bed["pg_id"] != pg_id or bed["owner_id"] != user["user_id"]:
                    return self._send(400, {"error": "Choose a bed in this property."})
                join_text = str(data.get("join_date", ""))
                join_day = date.fromisoformat(join_text)
                suggested = calculate_agreed_price(bed["base_yearly_price"], join_day)
                price = int(data.get("agreed_yearly_price", suggested))
                tenant_id = add_tenant(bed_id, str(data.get("name", "")), str(data.get("phone", "")), join_text, int(data.get("deposit", 0)), price, str(data.get("username", "")), str(data.get("password", "")))
                return self._send(201, {"tenant_id": tenant_id, "suggested_price": suggested})
            if len(parts) == 5 and parts[1:3] == ["api", "tenants"] and parts[3].isdigit() and parts[4] == "payments":
                tenant_id = int(parts[3]); row = self._tenant_owner(tenant_id)
                if row is None or row["owner_id"] != user["user_id"]:
                    return self._send(404, {"error": "Tenant not found."})
                payment_id = add_payment(tenant_id, int(data.get("amount", 0)), str(data.get("paid_on", date.today().isoformat())), str(data.get("mode", "")))
                return self._send(201, {"payment_id": payment_id})
            if len(parts) == 5 and parts[1:3] == ["api", "tenants"] and parts[3].isdigit() and parts[4] == "vacate":
                tenant_id = int(parts[3]); row = self._tenant_owner(tenant_id)
                if row is None or row["owner_id"] != user["user_id"]:
                    return self._send(404, {"error": "Tenant not found."})
                vacate_tenant(tenant_id)
                return self._send(200, {"ok": True})
            if len(parts) == 5 and parts[1:3] == ["api", "tickets"] and parts[3].isdigit() and parts[4] == "status":
                ticket_id = int(parts[3]); new_status = str(data.get("status", ""))
                conn = get_connection()
                try:
                    row = conn.execute("SELECT pg_id FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
                finally:
                    conn.close()
                if row is None or not self._owned_pg(user, row["pg_id"]):
                    return self._send(404, {"error": "Ticket not found."})
                update_ticket_status(ticket_id, new_status)
                return self._send(200, {"ok": True})
            if len(parts) == 5 and parts[1:3] == ["api", "rooms"] and parts[3].isdigit() and parts[4] == "balcony":
                room_id = int(parts[3])
                conn = get_connection()
                try:
                    row = conn.execute(
                        "SELECT r.id, p.owner_id FROM rooms r JOIN pgs p ON p.id = r.pg_id WHERE r.id = ?",
                        (room_id,),
                    ).fetchone()
                    if row is None or row["owner_id"] != user["user_id"]:
                        return self._send(404, {"error": "Room not found."})
                    raw_val = data.get("has_balcony")
                    if raw_val is None:
                        balcony_val = None
                    elif raw_val in (0, 1, False, True):
                        balcony_val = 1 if raw_val else 0
                    else:
                        raise ValueError("has_balcony must be true, false, or null.")
                    conn.execute("UPDATE rooms SET has_balcony = ? WHERE id = ?", (balcony_val, room_id))
                    conn.commit()
                finally:
                    conn.close()
                return self._send(200, {"ok": True, "has_balcony": None if balcony_val is None else bool(balcony_val)})
            return self._send(404, {"error": "Endpoint not found."})
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            return self._send(400, {"error": str(exc)})
        except sqlite3.IntegrityError:
            return self._send(400, {"error": "The record conflicts with existing data. Check the username and bed assignment."})
        except Exception as exc:
            print(f"[PG Manager API] Request failed: {exc}")
            return self._send(500, {"error": "The request could not be completed. Check the API terminal for details."})

    def do_DELETE(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        user = self._user()
        if not user:
            return self._send(401, {"error": "Please sign in to continue."})
        if user["role"] != "owner":
            return self._send(403, {"error": "Owner access required."})
        parts = path.split("/")
        try:
            if len(parts) == 4 and parts[1:3] == ["api", "announcements"] and parts[3].isdigit():
                announcement_id = int(parts[3]); conn = get_connection()
                try:
                    row = conn.execute("SELECT pg_id FROM announcements WHERE id=?", (announcement_id,)).fetchone()
                finally:
                    conn.close()
                if row is None or not self._owned_pg(user, row["pg_id"]):
                    return self._send(404, {"error": "Announcement not found."})
                delete_announcement(announcement_id)
                return self._send(200, {"ok": True})
            return self._send(404, {"error": "Endpoint not found."})
        except Exception:
            return self._send(500, {"error": "The request could not be completed. Check the API terminal for details."})


def main():
    create_tables()
    host = os.environ.get("PG_MANAGER_API_HOST", os.environ.get("GHARPAR_API_HOST", "127.0.0.1"))
    port = int(os.environ.get("PORT", "8765"))
    print(f"PG Manager API running at http://{host}:{port} (Ctrl+C to stop)", flush=True)
    try:
        ThreadingHTTPServer((host, port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nPG Manager API stopped.", flush=True)


if __name__ == "__main__":
    main()
