CREATE TYPE "public"."sales_document_kind" AS ENUM('quote_pdf', 'invoice_pdf', 'other');--> statement-breakpoint
CREATE TYPE "public"."sales_invoice_status" AS ENUM('draft', 'sent', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('intent', 'quoted', 'ordered', 'invoiced', 'paid', 'shipped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sales_shipment_status" AS ENUM('not_ready', 'ready', 'shipped');--> statement-breakpoint
CREATE TABLE "pipedrive_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"pipeline_id" integer NOT NULL,
	"stage_id" integer NOT NULL,
	"name" text NOT NULL,
	"order_nr" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pipedrive_stages_pipelineId_stageId_unique" UNIQUE("pipeline_id","stage_id")
);
--> statement-breakpoint
ALTER TABLE "pipedrive_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sales_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"kind" "sales_document_kind" DEFAULT 'other' NOT NULL,
	"order_id" uuid,
	"quote_id" uuid,
	"filename" text NOT NULL,
	"url" text,
	"storage_path" text,
	"uploaded_by" uuid,
	CONSTRAINT "sales_documents_parent" CHECK (num_nonnulls("sales_documents"."order_id", "sales_documents"."quote_id") >= 1)
);
--> statement-breakpoint
ALTER TABLE "sales_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"order_id" uuid NOT NULL,
	"external_number" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" "sales_invoice_status" DEFAULT 'draft' NOT NULL,
	"paid_at" timestamp with time zone,
	"pdf_url" text,
	"pdf_storage_path" text,
	CONSTRAINT "sales_invoices_amount_non_negative" CHECK ("sales_invoices"."amount_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deal_id" uuid,
	"company_id" uuid NOT NULL,
	"quote_id" uuid,
	"product_id" uuid,
	"qty" integer,
	"status" "sales_order_status" DEFAULT 'intent' NOT NULL,
	"notes" text,
	"ordered_at" date,
	"shipped_at" date,
	CONSTRAINT "sales_orders_qty_positive" CHECK ("sales_orders"."qty" is null or "sales_orders"."qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "sales_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sales_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"order_id" uuid NOT NULL,
	"status" "sales_shipment_status" DEFAULT 'not_ready' NOT NULL,
	"tracking" text,
	"eta" date,
	"notes" text,
	"shipped_at" date
);
--> statement-breakpoint
ALTER TABLE "sales_shipments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "rfq_email" text;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "rfq_contact_name" text;--> statement-breakpoint
ALTER TABLE "distributors" ADD COLUMN "host_key" text;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD COLUMN "product_url" text;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "product_url" text;--> statement-breakpoint
ALTER TABLE "parts" ADD COLUMN "preferred_distributor_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "pipedrive_stages" ADD CONSTRAINT "pipedrive_stages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_documents" ADD CONSTRAINT "sales_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_deal_id_pipedrive_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."pipedrive_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_shipments" ADD CONSTRAINT "sales_shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_shipments" ADD CONSTRAINT "sales_shipments_order_id_sales_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipedrive_stages_pipeline_id_order_nr_index" ON "pipedrive_stages" USING btree ("pipeline_id","order_nr");--> statement-breakpoint
CREATE INDEX "sales_documents_order_id_index" ON "sales_documents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_documents_quote_id_index" ON "sales_documents" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_order_id_index" ON "sales_invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_status_index" ON "sales_invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_orders_deal_id_index" ON "sales_orders" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "sales_orders_company_id_index" ON "sales_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_orders_status_index" ON "sales_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_shipments_order_id_index" ON "sales_shipments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "sales_shipments_status_index" ON "sales_shipments" USING btree ("status");--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_deal_id_pipedrive_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."pipedrive_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_deal_id_pipedrive_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."pipedrive_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipedrive_deals_stage_id_index" ON "pipedrive_deals" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "parts_preferred_distributor_id_index" ON "parts" USING btree ("preferred_distributor_id");--> statement-breakpoint
CREATE INDEX "quotes_deal_id_index" ON "quotes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "requests_deal_id_index" ON "requests" USING btree ("deal_id");--> statement-breakpoint
ALTER TABLE "distributors" ADD CONSTRAINT "distributors_hostKey_unique" UNIQUE("host_key");--> statement-breakpoint
CREATE POLICY "pipedrive_stages_select" ON "pipedrive_stages" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "pipedrive_stages_insert" ON "pipedrive_stages" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "pipedrive_stages_update" ON "pipedrive_stages" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "pipedrive_stages_delete" ON "pipedrive_stages" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_documents_select" ON "sales_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "sales_documents_insert" ON "sales_documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_documents_update" ON "sales_documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_documents_delete" ON "sales_documents" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_invoices_select" ON "sales_invoices" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "sales_invoices_insert" ON "sales_invoices" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_invoices_update" ON "sales_invoices" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_invoices_delete" ON "sales_invoices" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_orders_select" ON "sales_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "sales_orders_insert" ON "sales_orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_orders_update" ON "sales_orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_orders_delete" ON "sales_orders" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
CREATE POLICY "sales_shipments_select" ON "sales_shipments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "sales_shipments_insert" ON "sales_shipments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales', 'supply')));--> statement-breakpoint
CREATE POLICY "sales_shipments_update" ON "sales_shipments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales', 'supply')));--> statement-breakpoint
CREATE POLICY "sales_shipments_delete" ON "sales_shipments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'sales')));--> statement-breakpoint
ALTER POLICY "distributors_insert" ON "distributors" TO authenticated WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply', 'engineering')));--> statement-breakpoint
ALTER POLICY "distributors_update" ON "distributors" TO authenticated USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply', 'engineering')));--> statement-breakpoint
ALTER POLICY "distributors_delete" ON "distributors" TO authenticated USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));