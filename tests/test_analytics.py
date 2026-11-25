"""Focused unit tests for portfolio analytics date and allocation rules."""
import unittest
from datetime import date

from core.analytics import (
    parse_month,
    _pct,
    _allocate_tenant_installments,
    _is_tenant_eligible_for_month,
)


class AnalyticsDateTests(unittest.TestCase):
    def test_default_month_uses_supplied_today(self):
        month, start, end = parse_month(None, date(2026, 11, 25))
        self.assertEqual(month, "2026-11")
        self.assertEqual(start, date(2026, 11, 1))
        self.assertEqual(end, date(2026, 11, 30))

    def test_leap_year_february(self):
        _, start, end = parse_month("2028-02")
        self.assertEqual(start, date(2028, 2, 1))
        self.assertEqual(end, date(2028, 2, 29))

    def test_december_month_end(self):
        _, start, end = parse_month("2026-12")
        self.assertEqual(start, date(2026, 12, 1))
        self.assertEqual(end, date(2026, 12, 31))

    def test_rejects_invalid_months(self):
        for value in ("2026-13", "2026-00", "26-01", "2026/01"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_month(value)


class AnalyticsCalculationTests(unittest.TestCase):
    def test_percentage_zero_denominator(self):
        self.assertEqual(_pct(10, 0), 0.0)

    def test_percentage_rounds_to_one_decimal(self):
        self.assertEqual(_pct(2, 3), 66.6)

    def test_oldest_first_allocation(self):
        schedule, next_due = _allocate_tenant_installments(
            12000, "2026-08-01", 1500
        )
        self.assertEqual(schedule[0]["covered"], 1000)
        self.assertEqual(schedule[0]["unpaid"], 0)
        self.assertEqual(schedule[1]["covered"], 500)
        self.assertEqual(schedule[1]["unpaid"], 500)
        self.assertEqual(next_due, "2026-09-01")

    def test_final_installment_preserves_remainder(self):
        schedule, _ = _allocate_tenant_installments(
            10001, "2026-01-31", 0
        )
        self.assertEqual(sum(x["amount"] for x in schedule), 10001)
        self.assertEqual(schedule[-1]["due_date"], date(2026, 12, 31))

    def test_vacated_tenant_eligible_through_vacating_date(self):
        tenant = {"is_active": 0, "vacated_on": "2026-10-15"}
        self.assertTrue(_is_tenant_eligible_for_month(
            tenant, date(2026, 10, 1), date(2026, 10, 1)
        ))
        self.assertFalse(_is_tenant_eligible_for_month(
            tenant, date(2026, 11, 1), date(2026, 11, 1)
        ))

    def test_legacy_vacated_tenant_is_not_assumed_eligible(self):
        tenant = {"is_active": 0, "vacated_on": None}
        self.assertFalse(_is_tenant_eligible_for_month(
            tenant, date(2026, 10, 1), date(2026, 10, 1)
        ))

    def test_active_tenant_is_eligible(self):
        tenant = {"is_active": 1, "vacated_on": None}
        self.assertTrue(_is_tenant_eligible_for_month(
            tenant, date(2026, 10, 1), date(2026, 10, 1)
        ))


if __name__ == "__main__":
    unittest.main()
