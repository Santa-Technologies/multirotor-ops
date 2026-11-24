-- Justus's decision of 24 Nov 2026: minimum margin 25%, cost of capital 1% per month.
-- Only fills values the phase 1 seed left empty, so an admin's later edit is kept.
UPDATE public.quote_settings
SET min_margin_pct = 25
WHERE min_margin_pct IS NULL
  AND product_id = (SELECT id FROM public.products WHERE name = 'Pilot H743');
--> statement-breakpoint
UPDATE public.quote_settings
SET cost_of_capital_pct = 1
WHERE cost_of_capital_pct IS NULL
  AND product_id = (SELECT id FROM public.products WHERE name = 'Pilot H743');
