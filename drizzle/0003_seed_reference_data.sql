-- Reference data from the spec (phase 1). Idempotent: rerunning changes nothing.
INSERT INTO public.products (name, pricing_mode) VALUES
  ('Pilot H743', 'cost_plus'),
  ('Kern Nano', 'list_price'),
  ('Kern Nano Plus', 'list_price')
ON CONFLICT (name) DO NOTHING;
--> statement-breakpoint
-- Calculator defaults. min_margin_pct and cost_of_capital_pct stay NULL until Justus sets them.
INSERT INTO public.quote_settings (
  product_id, manual_cost_cents, cost_factors, margin_pct, floor_cents, std_deposit_pct,
  surcharges, savings_pct, cost_risk_pct, lead_weeks, monthly_capacity, validity_days,
  adj_threshold_pct, approval_min_deposit_pct, approval_max_payment_days
)
SELECT
  id, 8600,
  '{"100": 1.00, "1000": 0.85, "5000": 0.78, "10000": 0.75, "20000": 0.70}'::jsonb,
  30, 8000, 50,
  '{"depositRatePct": 1, "paymentTermsRatePct": 1}'::jsonb,
  5, 15, 12, 2500, 30,
  10, 30, 60
FROM public.products
WHERE name = 'Pilot H743'
ON CONFLICT (product_id) DO NOTHING;
--> statement-breakpoint
-- Justus's row, if his Supabase Auth user exists. The other users get their row
-- (role from ALLOWED_EMAILS) on first sign-in; their emails are still TBD.
INSERT INTO public.users (id, name, email, role)
SELECT id, 'Justus Nikolaus', lower(email), 'admin'
FROM auth.users
WHERE lower(email) = 'j.nikolaus@santatech.io'
ON CONFLICT DO NOTHING;
