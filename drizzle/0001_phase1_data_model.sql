CREATE TYPE "public"."activity_action" AS ENUM('insert', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('not_required', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."bom_sourcing" AS ENUM('distributor', 'direct_quote');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('cost_plus', 'list_price');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'expired', 'lost');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'triaged', 'accepted', 'planned', 'declined', 'done');--> statement-breakpoint
CREATE TYPE "public"."request_type" AS ENUM('feature', 'custom_variant', 'quote', 'integration_issue', 'bug', 'other');--> statement-breakpoint
CREATE TYPE "public"."request_urgency" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."requirement_status" AS ENUM('open', 'planned', 'done', 'declined');--> statement-breakpoint
CREATE TYPE "public"."source_channel" AS ENUM('linkedin', 'signal', 'email', 'trade_fair');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" "activity_action" NOT NULL,
	"user_id" uuid,
	"diff" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "assembly_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"assembler" text NOT NULL,
	"product_id" uuid NOT NULL,
	"qty_tier" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"setup_cost_cents" integer DEFAULT 0 NOT NULL,
	"quoted_at" date NOT NULL,
	"valid_until" date,
	CONSTRAINT "assembly_prices_qty_tier_positive" CHECK ("assembly_prices"."qty_tier" > 0),
	CONSTRAINT "assembly_prices_prices_non_negative" CHECK ("assembly_prices"."unit_price_cents" >= 0 and "assembly_prices"."setup_cost_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "assembly_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cost_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"product_id" uuid NOT NULL,
	"bom_version_id" uuid NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tiers" jsonb NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coverage_pct" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "distributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"country" text,
	"approved" boolean DEFAULT false NOT NULL,
	"api_provider" text,
	CONSTRAINT "distributors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "distributors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "manual_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"mpn" text,
	"assembler" text,
	"supplier" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quoted_at" date NOT NULL,
	"valid_until" date,
	"source_note" text,
	"entered_by" uuid,
	CONSTRAINT "manual_quotes_mpn_or_assembler" CHECK (num_nonnulls("manual_quotes"."mpn", "manual_quotes"."assembler") = 1),
	CONSTRAINT "manual_quotes_qty_positive" CHECK ("manual_quotes"."qty" > 0),
	CONSTRAINT "manual_quotes_unit_price_non_negative" CHECK ("manual_quotes"."unit_price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "manual_quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "price_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"mpn" text NOT NULL,
	"distributor_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"currency" text NOT NULL,
	"price_breaks" jsonb NOT NULL,
	"stock" integer,
	"factory_lead_days" integer,
	"lifecycle" text,
	"url" text
);
--> statement-breakpoint
ALTER TABLE "price_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"country" text,
	"website" text,
	"pipedrive_id" integer,
	CONSTRAINT "companies_pipedriveId_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"pipedrive_id" integer,
	CONSTRAINT "contacts_pipedriveId_unique" UNIQUE("pipedrive_id")
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bom_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"bom_version_id" uuid NOT NULL,
	"mpn" text NOT NULL,
	"manufacturer" text,
	"description" text,
	"qty_per_board" integer NOT NULL,
	"designators" text,
	"sourcing" "bom_sourcing" DEFAULT 'distributor' NOT NULL,
	"alternates" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "bom_lines_qty_per_board_positive" CHECK ("bom_lines"."qty_per_board" > 0)
);
--> statement-breakpoint
ALTER TABLE "bom_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bom_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"product_id" uuid NOT NULL,
	"version" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "bom_versions_productId_version_unique" UNIQUE("product_id","version")
);
--> statement-breakpoint
ALTER TABLE "bom_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "list_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"product_id" uuid NOT NULL,
	"min_qty" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	CONSTRAINT "list_prices_productId_minQty_unique" UNIQUE("product_id","min_qty"),
	CONSTRAINT "list_prices_min_qty_positive" CHECK ("list_prices"."min_qty" > 0),
	CONSTRAINT "list_prices_unit_price_non_negative" CHECK ("list_prices"."unit_price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "list_prices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"sku" text,
	"pricing_mode" "pricing_mode" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"product_id" uuid NOT NULL,
	"manual_cost_cents" integer NOT NULL,
	"cost_factors" jsonb NOT NULL,
	"margin_pct" numeric(6, 2) NOT NULL,
	"min_margin_pct" numeric(6, 2),
	"floor_cents" integer NOT NULL,
	"std_deposit_pct" numeric(6, 2) NOT NULL,
	"surcharges" jsonb NOT NULL,
	"cost_of_capital_pct" numeric(6, 2),
	"savings_pct" numeric(6, 2) NOT NULL,
	"cost_risk_pct" numeric(6, 2) NOT NULL,
	"lead_weeks" integer NOT NULL,
	"monthly_capacity" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"adj_threshold_pct" numeric(6, 2) NOT NULL,
	"approval_min_deposit_pct" numeric(6, 2) NOT NULL,
	"approval_max_payment_days" integer NOT NULL,
	CONSTRAINT "quote_settings_productId_unique" UNIQUE("product_id"),
	CONSTRAINT "quote_settings_money_non_negative" CHECK ("quote_settings"."manual_cost_cents" >= 0 and "quote_settings"."floor_cents" >= 0),
	CONSTRAINT "quote_settings_capacity_positive" CHECK ("quote_settings"."monthly_capacity" > 0)
);
--> statement-breakpoint
ALTER TABLE "quote_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"number" text NOT NULL,
	"company_id" uuid,
	"request_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"inputs" jsonb NOT NULL,
	"outputs" jsonb NOT NULL,
	"cost_run_id" uuid,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"approval_status" "approval_status" DEFAULT 'not_required' NOT NULL,
	"approved_by" uuid,
	"sent_at" timestamp with time zone,
	"valid_until" date,
	"pipedrive_deal_id" integer,
	CONSTRAINT "quotes_number_version_unique" UNIQUE("number","version"),
	CONSTRAINT "quotes_number_format" CHECK ("quotes"."number" ~ '^MR-[0-9]{4}-[0-9]{4}$'),
	CONSTRAINT "quotes_quantity_positive" CHECK ("quotes"."quantity" > 0),
	CONSTRAINT "quotes_version_positive" CHECK ("quotes"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"contact_id" uuid,
	"source_channel" "source_channel",
	"summary" text NOT NULL,
	"raw_text" text,
	"type" "request_type" NOT NULL,
	"product_id" uuid,
	"quantity" integer,
	"urgency" "request_urgency",
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"owner_id" uuid,
	"requirement_id" uuid,
	"due_date" date,
	CONSTRAINT "requests_quantity_positive" CHECK ("requests"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"title" text NOT NULL,
	"description" text,
	"product_id" uuid,
	"status" "requirement_status" DEFAULT 'open' NOT NULL,
	"roadmap_ref" text
);
--> statement-breakpoint
ALTER TABLE "requirements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assembly_prices" ADD CONSTRAINT "assembly_prices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_prices" ADD CONSTRAINT "assembly_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_runs" ADD CONSTRAINT "cost_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_runs" ADD CONSTRAINT "cost_runs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_runs" ADD CONSTRAINT "cost_runs_bom_version_id_bom_versions_id_fk" FOREIGN KEY ("bom_version_id") REFERENCES "public"."bom_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_quotes" ADD CONSTRAINT "manual_quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_quotes" ADD CONSTRAINT "manual_quotes_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_snapshots" ADD CONSTRAINT "price_snapshots_distributor_id_distributors_id_fk" FOREIGN KEY ("distributor_id") REFERENCES "public"."distributors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_bom_version_id_bom_versions_id_fk" FOREIGN KEY ("bom_version_id") REFERENCES "public"."bom_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_versions" ADD CONSTRAINT "bom_versions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_prices" ADD CONSTRAINT "list_prices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_prices" ADD CONSTRAINT "list_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_settings" ADD CONSTRAINT "quote_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_settings" ADD CONSTRAINT "quote_settings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_cost_run_id_cost_runs_id_fk" FOREIGN KEY ("cost_run_id") REFERENCES "public"."cost_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_entity_entity_id_index" ON "activity_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "activity_log_created_at_index" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assembly_prices_product_id_qty_tier_index" ON "assembly_prices" USING btree ("product_id","qty_tier");--> statement-breakpoint
CREATE INDEX "cost_runs_product_id_run_at_index" ON "cost_runs" USING btree ("product_id","run_at");--> statement-breakpoint
CREATE INDEX "manual_quotes_mpn_index" ON "manual_quotes" USING btree ("mpn");--> statement-breakpoint
CREATE INDEX "price_snapshots_mpn_fetched_at_index" ON "price_snapshots" USING btree ("mpn","fetched_at");--> statement-breakpoint
CREATE INDEX "contacts_company_id_index" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bom_lines_bom_version_id_index" ON "bom_lines" USING btree ("bom_version_id");--> statement-breakpoint
CREATE INDEX "bom_lines_mpn_index" ON "bom_lines" USING btree ("mpn");--> statement-breakpoint
CREATE UNIQUE INDEX "bom_versions_one_current_per_product" ON "bom_versions" USING btree ("product_id") WHERE "bom_versions"."is_current";--> statement-breakpoint
CREATE INDEX "quotes_company_id_index" ON "quotes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "quotes_status_index" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_company_id_index" ON "requests" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "requests_status_index" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_requirement_id_index" ON "requests" USING btree ("requirement_id");--> statement-breakpoint
CREATE POLICY "users_select" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "users_insert" ON "users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "users_update" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "users_delete" ON "users" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "activity_log_select" ON "activity_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "assembly_prices_select" ON "assembly_prices" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "assembly_prices_insert" ON "assembly_prices" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "assembly_prices_update" ON "assembly_prices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "assembly_prices_delete" ON "assembly_prices" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "cost_runs_select" ON "cost_runs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "cost_runs_insert" ON "cost_runs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "cost_runs_update" ON "cost_runs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "cost_runs_delete" ON "cost_runs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "distributors_select" ON "distributors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "distributors_insert" ON "distributors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "distributors_update" ON "distributors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "distributors_delete" ON "distributors" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "manual_quotes_select" ON "manual_quotes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "manual_quotes_insert" ON "manual_quotes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "manual_quotes_update" ON "manual_quotes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "manual_quotes_delete" ON "manual_quotes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "price_snapshots_select" ON "price_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "price_snapshots_insert" ON "price_snapshots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "price_snapshots_update" ON "price_snapshots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "price_snapshots_delete" ON "price_snapshots" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "companies_select" ON "companies" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "companies_insert" ON "companies" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "companies_update" ON "companies" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "companies_delete" ON "companies" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "contacts_select" ON "contacts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "contacts_insert" ON "contacts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "contacts_update" ON "contacts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "contacts_delete" ON "contacts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "bom_lines_select" ON "bom_lines" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "bom_lines_insert" ON "bom_lines" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "bom_lines_update" ON "bom_lines" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "bom_lines_delete" ON "bom_lines" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "bom_versions_select" ON "bom_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "bom_versions_insert" ON "bom_versions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "bom_versions_update" ON "bom_versions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "bom_versions_delete" ON "bom_versions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "list_prices_select" ON "list_prices" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "list_prices_insert" ON "list_prices" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "list_prices_update" ON "list_prices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "list_prices_delete" ON "list_prices" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "products_select" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "products_insert" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "products_update" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "products_delete" ON "products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "quote_settings_select" ON "quote_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "quote_settings_insert" ON "quote_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "quote_settings_update" ON "quote_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "quote_settings_delete" ON "quote_settings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin')));--> statement-breakpoint
CREATE POLICY "quotes_select" ON "quotes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "quotes_insert" ON "quotes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "quotes_update" ON "quotes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "quotes_delete" ON "quotes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "requests_select" ON "requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "requests_insert" ON "requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "requests_update" ON "requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales', 'engineering')));--> statement-breakpoint
CREATE POLICY "requests_delete" ON "requests" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "requirements_select" ON "requirements" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "requirements_insert" ON "requirements" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "requirements_update" ON "requirements" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "requirements_delete" ON "requirements" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));