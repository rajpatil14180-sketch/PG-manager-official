"""Portfolio analytics, monthly financial overview, and revenue forecasting."""
import calendar
import re
from datetime import date
from database import get_connection
from core.pricing import add_months, get_installment_schedule


_MONTH_RE = re.compile(r"^(\d{4})-(\d{2})$")


def parse_month(month_str=None, today=None):
    """Validate YYYY-MM string and return (month_str, month_start, month_end)."""
    if today is None:
        today = date.today()
    if month_str is None or str(month_str).strip() == "":
        year, month = today.year, today.month
    else:
        match = _MONTH_RE.match(str(month_str).strip())
        if not match:
            raise ValueError("Invalid month format. Expected YYYY-MM.")
        year = int(match.group(1))
        month = int(match.group(2))
        if year < 2000 or year > 2100 or month < 1 or month > 12:
            raise ValueError("Month out of valid range (2000-01 to 2100-12).")
    last_day = calendar.monthrange(year, month)[1]
    return f"{year:04d}-{month:02d}", date(year, month, 1), date(year, month, last_day)


def _pct(numerator, denominator):
    """Compute percentage rounded to 1 decimal place without division by zero."""
    if not denominator or denominator <= 0:
        return 0.0
    return (numerator * 1000 // denominator) / 10.0


def _allocate_tenant_installments(agreed_price, join_date_str, total_paid):
    """Allocate cumulative payments oldest-first across the 12-month schedule."""
    join_day = date.fromisoformat(join_date_str)
    schedule = get_installment_schedule(agreed_price, join_day)
    remaining = max(0, total_paid)
    allocated = []
    next_due = None
    for idx, (due_date, amount) in enumerate(schedule, start=1):
        covered = min(amount, remaining)
        remaining -= covered
        unpaid = amount - covered
        if unpaid > 0 and next_due is None:
            next_due = due_date.isoformat()
        allocated.append({
            "no": idx,
            "due_date": due_date,
            "amount": amount,
            "covered": covered,
            "unpaid": unpaid,
        })
    return allocated, next_due


def _is_tenant_eligible_for_month(tenant, due_date, current_month_start):
    """Determine if a tenant's installment on due_date should be counted."""
    if tenant["is_active"] == 1:
        return True
    vacated_on = tenant["vacated_on"]
    if vacated_on:
        return date.fromisoformat(vacated_on) >= due_date
    return False


def get_owner_dashboard(owner_id, month_str=None, today=None):
    """Return full portfolio snapshot, monthly financials, vacant valuations, and forecasts."""
    if today is None:
        today = date.today()
    sel_month, m_start, m_end = parse_month(month_str, today)
    next_m_start = add_months(m_start, 1)
    next_m_end = date(
        next_m_start.year,
        next_m_start.month,
        calendar.monthrange(next_m_start.year, next_m_start.month)[1],
    )
    next_month_str = f"{next_m_start.year:04d}-{next_m_start.month:02d}"

    conn = get_connection()
    try:
        pgs = [dict(r) for r in conn.execute(
            "SELECT id, name, address FROM pgs WHERE owner_id = ? ORDER BY id",
            (owner_id,),
        ).fetchall()]

        if not pgs:
            return _empty_dashboard(sel_month, next_month_str, today)

        pg_ids = [p["id"] for p in pgs]
        placeholders = ",".join("?" for _ in pg_ids)

        rooms = [dict(r) for r in conn.execute(
            f"SELECT id, pg_id, room_no, has_attached_bath, has_balcony "
            f"FROM rooms WHERE pg_id IN ({placeholders}) ORDER BY pg_id, room_no",
            pg_ids,
        ).fetchall()]

        beds = [dict(r) for r in conn.execute(
            f"SELECT b.id AS bed_id, b.room_id, b.label, b.base_yearly_price, "
            f"r.pg_id, r.room_no, r.has_attached_bath, r.has_balcony, p.name AS pg_name "
            f"FROM beds b JOIN rooms r ON r.id = b.room_id "
            f"JOIN pgs p ON p.id = r.pg_id "
            f"WHERE r.pg_id IN ({placeholders}) ORDER BY r.pg_id, r.room_no, b.label",
            pg_ids,
        ).fetchall()]

        tenants = [dict(r) for r in conn.execute(
            f"SELECT t.id AS tenant_id, t.bed_id, t.name, t.phone, t.join_date, "
            f"t.deposit, t.agreed_yearly_price, t.is_active, t.vacated_on, "
            f"b.label AS bed_label, r.room_no, r.pg_id, p.name AS pg_name "
            f"FROM tenants t "
            f"JOIN beds b ON b.id = t.bed_id "
            f"JOIN rooms r ON r.id = b.room_id "
            f"JOIN pgs p ON p.id = r.pg_id "
            f"WHERE r.pg_id IN ({placeholders})",
            pg_ids,
        ).fetchall()]

        payments = [dict(r) for r in conn.execute(
            f"SELECT py.id, py.tenant_id, py.amount, py.paid_on, py.mode, "
            f"t.name AS tenant_name, r.pg_id, p.name AS pg_name, r.room_no, b.label AS bed_label "
            f"FROM payments py "
            f"JOIN tenants t ON t.id = py.tenant_id "
            f"JOIN beds b ON b.id = t.bed_id "
            f"JOIN rooms r ON r.id = b.room_id "
            f"JOIN pgs p ON p.id = r.pg_id "
            f"WHERE r.pg_id IN ({placeholders}) "
            f"ORDER BY py.paid_on DESC, py.id DESC",
            pg_ids,
        ).fetchall()]

        open_tickets_rows = [dict(r) for r in conn.execute(
            f"SELECT tk.id, tk.category, tk.description, tk.urgency, tk.status, tk.created_at, "
            f"t.name AS tenant_name, r.room_no, b.label AS bed_label, p.id AS pg_id, p.name AS pg_name "
            f"FROM tickets tk JOIN tenants t ON t.id = tk.tenant_id "
            f"LEFT JOIN beds b ON b.id = t.bed_id "
            f"LEFT JOIN rooms r ON r.id = b.room_id "
            f"JOIN pgs p ON p.id = tk.pg_id "
            f"WHERE tk.pg_id IN ({placeholders}) AND tk.status != 'Resolved' "
            f"ORDER BY CASE tk.urgency WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END, tk.created_at ASC",
            pg_ids,
        ).fetchall()]

        announcements = [dict(r) for r in conn.execute(
            f"SELECT a.id, a.message, a.created_at, p.id AS pg_id, p.name AS pg_name "
            f"FROM announcements a JOIN pgs p ON p.id = a.pg_id "
            f"WHERE a.pg_id IN ({placeholders}) ORDER BY a.created_at DESC LIMIT 5",
            pg_ids,
        ).fetchall()]
    finally:
        conn.close()

    # Map payments by tenant
    paid_by_tenant = {}
    for py in payments:
        tid = py["tenant_id"]
        paid_by_tenant[tid] = paid_by_tenant.get(tid, 0) + py["amount"]

    # Active bed occupancy
    active_by_bed = {t["bed_id"]: t for t in tenants if t["is_active"] == 1 and t["bed_id"] is not None}

    # Per-PG accumulators
    pg_map = {}
    for p in pgs:
        pid = p["id"]
        pg_map[pid] = {
            "id": pid,
            "name": p["name"],
            "address": p["address"],
            "total_rooms": 0,
            "total_beds": 0,
            "occupied_beds": 0,
            "vacant_beds": 0,
            "occupancy_rate": 0.0,
            "scheduled_rent": 0,
            "paid_against_scheduled": 0,
            "collected_this_month": 0,
            "current_month_overdue": 0,
            "current_month_not_yet_due": 0,
            "previous_arrears": 0,
            "vacant_annual_potential": 0,
            "vacant_monthly_potential": 0,
            "next_month_contracted": 0,
            "has_legacy_vacated": False,
        }

    for r in rooms:
        pg_map[r["pg_id"]]["total_rooms"] += 1

    vacant_beds_list = []
    invalid_price_warnings = []

    for b in beds:
        pid = b["pg_id"]
        pg_map[pid]["total_beds"] += 1
        if b["bed_id"] in active_by_bed:
            pg_map[pid]["occupied_beds"] += 1
        else:
            pg_map[pid]["vacant_beds"] += 1
            raw_price = b["base_yearly_price"]
            price_valid = isinstance(raw_price, int) and raw_price >= 0
            if not price_valid:
                invalid_price_warnings.append(
                    f"{b['pg_name']} Room {b['room_no']} Bed {b['label']} has an invalid price."
                )
            annual = raw_price if price_valid else 0
            monthly = annual // 12 if price_valid else 0
            pg_map[pid]["vacant_annual_potential"] += annual
            vacant_beds_list.append({
                "bed_id": b["bed_id"],
                "pg_id": pid,
                "pg_name": b["pg_name"],
                "room_id": b["room_id"],
                "room_no": b["room_no"],
                "bed_label": b["label"],
                "base_yearly_price": annual if price_valid else None,
                "monthly_equivalent": monthly if price_valid else None,
                "price_valid": price_valid,
                "has_attached_bath": bool(b["has_attached_bath"]),
                "has_balcony": None if b["has_balcony"] is None else bool(b["has_balcony"]),
            })

    for pid, pinfo in pg_map.items():
        pinfo["vacant_monthly_potential"] = pinfo["vacant_annual_potential"] // 12
        pinfo["occupancy_rate"] = _pct(pinfo["occupied_beds"], pinfo["total_beds"])

    # Cash collected in selected month
    for py in payments:
        if m_start.isoformat() <= py["paid_on"] <= m_end.isoformat():
            pg_map[py["pg_id"]]["collected_this_month"] += py["amount"]

    # Process tenant schedules
    overdue_tenants_list = []
    tenant_schedules = {}
    for t in tenants:
        pid = t["pg_id"]
        if t["is_active"] == 0 and t["vacated_on"] is None:
            pg_map[pid]["has_legacy_vacated"] = True

        tid = t["tenant_id"]
        t_paid = paid_by_tenant.get(tid, 0)
        allocated, next_due = _allocate_tenant_installments(t["agreed_yearly_price"], t["join_date"], t_paid)
        tenant_schedules[tid] = (t, allocated)

        t_curr_overdue = 0
        t_prev_arrears = 0
        t_due_left = max(0, t["agreed_yearly_price"] - t_paid)

        for inst in allocated:
            d = inst["due_date"]
            if m_start <= d <= m_end and _is_tenant_eligible_for_month(t, d, m_start):
                pg_map[pid]["scheduled_rent"] += inst["amount"]
                pg_map[pid]["paid_against_scheduled"] += inst["covered"]
                if d <= today:
                    pg_map[pid]["current_month_overdue"] += inst["unpaid"]
                    t_curr_overdue += inst["unpaid"]
                else:
                    pg_map[pid]["current_month_not_yet_due"] += inst["unpaid"]
            elif d < m_start and d <= today and t["is_active"] == 1:
                pg_map[pid]["previous_arrears"] += inst["unpaid"]
                t_prev_arrears += inst["unpaid"]
            elif next_m_start <= d <= next_m_end and t["is_active"] == 1:
                pg_map[pid]["next_month_contracted"] += inst["amount"]

        if t["is_active"] == 1 and (t_curr_overdue > 0 or t_prev_arrears > 0):
            overdue_tenants_list.append({
                "tenant_id": tid,
                "name": t["name"],
                "phone": t["phone"],
                "pg_id": pid,
                "pg_name": t["pg_name"],
                "room_no": t["room_no"],
                "bed_label": t["bed_label"],
                "current_month_overdue": t_curr_overdue,
                "previous_period_arrears": t_prev_arrears,
                "overdue_amount": t_curr_overdue + t_prev_arrears,
                "due_left": t_due_left,
                "next_due_date": next_due,
            })

    # Aggregate portfolio totals from property-level values (Section 8.R)
    total_rooms = sum(p["total_rooms"] for p in pg_map.values())
    total_beds = sum(p["total_beds"] for p in pg_map.values())
    occupied_beds = sum(p["occupied_beds"] for p in pg_map.values())
    vacant_beds = sum(p["vacant_beds"] for p in pg_map.values())

    scheduled_rent = sum(p["scheduled_rent"] for p in pg_map.values())
    paid_against_scheduled = sum(p["paid_against_scheduled"] for p in pg_map.values())
    actual_collected = sum(p["collected_this_month"] for p in pg_map.values())
    curr_overdue = sum(p["current_month_overdue"] for p in pg_map.values())
    curr_not_due = sum(p["current_month_not_yet_due"] for p in pg_map.values())
    prev_arrears = sum(p["previous_arrears"] for p in pg_map.values())

    vacant_annual = sum(p["vacant_annual_potential"] for p in pg_map.values())
    vacant_monthly = vacant_annual // 12  # Aggregate annual first, then // 12

    next_contracted = sum(p["next_month_contracted"] for p in pg_map.values())

    # 12-month historical & selected collection series
    monthly_history = _build_monthly_history(
        m_start, today, pg_map, payments, tenant_schedules
    )

    # Ticket ages
    open_tickets = []
    for tr in open_tickets_rows:
        c_date = date.fromisoformat(tr["created_at"][:10])
        tr["age_in_days"] = max(0, (today - c_date).days)
        open_tickets.append(tr)

    return {
        "selected_month": sel_month,
        "today": today.isoformat(),
        "portfolio": {
            "total_pgs": len(pgs),
            "total_rooms": total_rooms,
            "total_beds": total_beds,
            "occupied_beds": occupied_beds,
            "vacant_beds": vacant_beds,
            "occupancy_percentage": _pct(occupied_beds, total_beds),
            "vacant_percentage": _pct(vacant_beds, total_beds),
            "active_tenants": len(active_by_bed),
            "open_tickets_count": len(open_tickets),
        },
        "monthly_overview": {
            "month": sel_month,
            "scheduled_rent": scheduled_rent,
            "actual_collected": actual_collected,
            "paid_against_scheduled": paid_against_scheduled,
            "remaining_to_collect": curr_overdue + curr_not_due,
            "current_month_overdue": curr_overdue,
            "current_month_not_yet_due": curr_not_due,
            "previous_period_arrears": prev_arrears,
            "collection_percentage": _pct(paid_against_scheduled, scheduled_rent),
            "overdue_tenants_count": len([x for x in overdue_tenants_list if x["current_month_overdue"] > 0]),
            "arrears_tenants_count": len([x for x in overdue_tenants_list if x["previous_period_arrears"] > 0]),
        },
        "vacant_inventory": {
            "total_vacant_beds": vacant_beds,
            "total_beds": total_beds,
            "vacant_percentage": _pct(vacant_beds, total_beds),
            "estimated_annual_potential": vacant_annual,
            "estimated_monthly_potential": vacant_monthly,
            "by_property": [
                {
                    "pg_id": p["id"],
                    "pg_name": p["name"],
                    "vacant_beds": p["vacant_beds"],
                    "total_beds": p["total_beds"],
                    "estimated_annual_potential": p["vacant_annual_potential"],
                    "estimated_monthly_potential": p["vacant_monthly_potential"],
                }
                for p in pg_map.values()
            ],
            "beds": vacant_beds_list,
            "warnings": invalid_price_warnings,
        },
        "next_month_outlook": {
            "month": next_month_str,
            "contracted_rent": next_contracted,
            "estimated_vacant_potential": vacant_monthly,
            "combined_opportunity": next_contracted + vacant_monthly,
            "occupied_beds": occupied_beds,
            "vacant_beds": vacant_beds,
            "contributing_properties": len(pgs),
        },
        "monthly_history": monthly_history,
        "properties": list(pg_map.values()),
        "overdue_tenants": overdue_tenants_list,
        "recent_payments": payments[:10],
        "open_tickets": open_tickets,
        "recent_announcements": announcements,
    }


def _build_monthly_history(m_start, today, pg_map, payments, tenant_schedules):
    """Build 12-month history ending at m_start, overall and per PG."""
    months = []
    # 11 months before m_start up to m_start
    for offset in range(-11, 1):
        # Compute month start by shifting year/month
        total_m = (m_start.year * 12 + (m_start.month - 1)) + offset
        y = total_m // 12
        m = (total_m % 12) + 1
        ms = date(y, m, 1)
        me = date(y, m, calendar.monthrange(y, m)[1])
        m_key = f"{y:04d}-{m:02d}"

        by_pg = {}
        for pid, pinfo in pg_map.items():
            # Scheduled rent is reliable if in current/future month or if no legacy inactive tenants exist
            reliable = (ms >= date(today.year, today.month, 1)) or (not pinfo["has_legacy_vacated"])
            by_pg[str(pid)] = {
                "collected": 0,
                "scheduled": 0 if reliable else None,
                "outstanding": None,
                "scheduled_reliable": reliable,
            }

        for py in payments:
            if ms.isoformat() <= py["paid_on"] <= me.isoformat():
                by_pg[str(py["pg_id"])]["collected"] += py["amount"]

        for tid, (t, allocated) in tenant_schedules.items():
            pid_str = str(t["pg_id"])
            if not by_pg[pid_str]["scheduled_reliable"]:
                continue
            for inst in allocated:
                d = inst["due_date"]
                if ms <= d <= me and _is_tenant_eligible_for_month(t, d, ms):
                    by_pg[pid_str]["scheduled"] += inst["amount"]

        all_reliable = all(v["scheduled_reliable"] for v in by_pg.values())
        tot_collected = sum(v["collected"] for v in by_pg.values())
        tot_scheduled = sum(v["scheduled"] for v in by_pg.values()) if all_reliable else None
        for v in by_pg.values():
            if v["scheduled_reliable"]:
                v["outstanding"] = max(0, v["scheduled"] - v["collected"])

        months.append({
            "month": m_key,
            "collected": tot_collected,
            "scheduled": tot_scheduled,
            "outstanding": max(0, tot_scheduled - tot_collected) if tot_scheduled is not None else None,
            "scheduled_reliable": all_reliable,
            "by_pg": by_pg,
        })
    return months


def _empty_dashboard(sel_month, next_month_str, today):
    """Return zeroed dashboard structure when owner has no properties."""
    return {
        "selected_month": sel_month,
        "today": today.isoformat(),
        "portfolio": {
            "total_pgs": 0,
            "total_rooms": 0,
            "total_beds": 0,
            "occupied_beds": 0,
            "vacant_beds": 0,
            "occupancy_percentage": 0.0,
            "vacant_percentage": 0.0,
            "active_tenants": 0,
            "open_tickets_count": 0,
        },
        "monthly_overview": {
            "month": sel_month,
            "scheduled_rent": 0,
            "actual_collected": 0,
            "paid_against_scheduled": 0,
            "remaining_to_collect": 0,
            "current_month_overdue": 0,
            "current_month_not_yet_due": 0,
            "previous_period_arrears": 0,
            "collection_percentage": 0.0,
            "overdue_tenants_count": 0,
            "arrears_tenants_count": 0,
        },
        "vacant_inventory": {
            "total_vacant_beds": 0,
            "total_beds": 0,
            "vacant_percentage": 0.0,
            "estimated_annual_potential": 0,
            "estimated_monthly_potential": 0,
            "by_property": [],
            "beds": [],
            "warnings": [],
        },
        "next_month_outlook": {
            "month": next_month_str,
            "contracted_rent": 0,
            "estimated_vacant_potential": 0,
            "combined_opportunity": 0,
            "occupied_beds": 0,
            "vacant_beds": 0,
            "contributing_properties": 0,
        },
        "monthly_history": [],
        "properties": [],
        "overdue_tenants": [],
        "recent_payments": [],
        "open_tickets": [],
        "recent_announcements": [],
    }
