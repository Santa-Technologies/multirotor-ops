CREATE TYPE "public"."pipedrive_deal_status" AS ENUM('open', 'won', 'lost', 'deleted');--> statement-breakpoint
CREATE TABLE "pipedrive_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"pipedrive_id" integer NOT NULL,
	"title" text NOT NULL,
	"status" "pipedrive_deal_status" DEFAULT 'open' NOT NULL,
	"value_amount" numeric(14, 2),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"pipeline_id" integer,
	"pipeline_name" text,
	"stage_id" integer,
	"stage_name" text,
	"org_pipedrive_id" integer,
	"person_pipedrive_id" integer,
	"company_id" uuid,
	"contact_id" uuid,
	"expected_close_date" date,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pipedrive_deals_pipedriveId_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
ALTER TABLE "pipedrive_deals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "pipedrive_deal_id" integer;--> statement-breakpoint
ALTER TABLE "pipedrive_deals" ADD CONSTRAINT "pipedrive_deals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipedrive_deals" ADD CONSTRAINT "pipedrive_deals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipedrive_deals" ADD CONSTRAINT "pipedrive_deals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipedrive_deals_status_index" ON "pipedrive_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pipedrive_deals_company_id_index" ON "pipedrive_deals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "pipedrive_deals_pipeline_id_index" ON "pipedrive_deals" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "requests_owner_id_index" ON "requests" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "requests_pipedrive_deal_id_index" ON "requests" USING btree ("pipedrive_deal_id");--> statement-breakpoint
CREATE POLICY "pipedrive_deals_select" ON "pipedrive_deals" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "pipedrive_deals_insert" ON "pipedrive_deals" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "pipedrive_deals_update" ON "pipedrive_deals" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "pipedrive_deals_delete" ON "pipedrive_deals" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pipedrive_deals']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields()',
      t || '_audit_fields', t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()',
      t || '_activity_log', t);
  END LOOP;
END $$;