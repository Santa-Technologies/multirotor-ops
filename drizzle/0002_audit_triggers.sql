-- Audit columns, activity log and append-only tables (phase 1).
-- The acting user is the Supabase session user (auth.uid()) for writes through
-- the Supabase client, or the `app.user_id` setting for server writes through
-- DATABASE_URL (set with `select set_config('app.user_id', '<uuid>', true)` in
-- the same transaction). Neither is set for migrations and seeds.
CREATE OR REPLACE FUNCTION public.current_actor_id() RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(auth.uid(), nullif(current_setting('app.user_id', true), '')::uuid)
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_audit_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(NEW.created_by, public.current_actor_id());
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
-- SECURITY DEFINER so the insert into activity_log bypasses its RLS (no write policies).
CREATE OR REPLACE FUNCTION public.log_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := public.current_actor_id();
  row_id uuid;
  change jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    row_id := NEW.id;
    change := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    row_id := OLD.id;
    change := to_jsonb(OLD);
  ELSE
    row_id := NEW.id;
    SELECT coalesce(jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      INTO change
      FROM jsonb_each(to_jsonb(NEW)) n
      JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
     WHERE n.value IS DISTINCT FROM o.value AND n.key <> 'updated_at';
  END IF;

  INSERT INTO public.activity_log (entity, entity_id, action, user_id, diff, created_by)
  VALUES (TG_TABLE_NAME, row_id, lower(TG_OP)::public.activity_action, actor, change, actor);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reject_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END
$$;
--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'companies', 'contacts', 'requests', 'requirements', 'products', 'list_prices',
    'bom_versions', 'bom_lines', 'distributors', 'price_snapshots', 'manual_quotes',
    'assembly_prices', 'cost_runs', 'quote_settings', 'quotes'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields()',
      t || '_audit_fields', t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()',
      t || '_activity_log', t);
  END LOOP;
END
$$;
--> statement-breakpoint
CREATE TRIGGER price_snapshots_append_only BEFORE UPDATE OR DELETE ON public.price_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.reject_change();
--> statement-breakpoint
CREATE TRIGGER activity_log_append_only BEFORE UPDATE OR DELETE ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_change();
