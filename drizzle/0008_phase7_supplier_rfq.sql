CREATE TYPE "public"."rfq_offer_status" AS ENUM('pending_confirm', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rfq_thread_status" AS ENUM('draft', 'sent', 'awaiting_reply', 'offer_received', 'confirmed', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "part_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"part_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"preferred" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "part_suppliers_partId_supplierId_unique" UNIQUE("part_id","supplier_id")
);
--> statement-breakpoint
ALTER TABLE "part_suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rfq_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"rfq_thread_id" uuid NOT NULL,
	"status" "rfq_offer_status" DEFAULT 'pending_confirm' NOT NULL,
	"source_filename" text,
	"inbound_email_id" text,
	"extract_json" jsonb,
	"qty" integer,
	"unit_price_cents" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"stock" integer,
	"valid_until" date,
	"lead_days" integer,
	"parse_notes" text,
	"confirmed_manual_quote_id" uuid,
	CONSTRAINT "rfq_offers_qty_positive" CHECK ("rfq_offers"."qty" is null or "rfq_offers"."qty" > 0),
	CONSTRAINT "rfq_offers_unit_price_non_negative" CHECK ("rfq_offers"."unit_price_cents" is null or "rfq_offers"."unit_price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rfq_offers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rfq_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"part_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "rfq_thread_status" DEFAULT 'draft' NOT NULL,
	"subject_token" text NOT NULL,
	"qty_requested" integer NOT NULL,
	"outbound_resend_id" text,
	"outbound_message_id" text,
	"last_inbound_email_id" text,
	"last_inbound_message_id" text,
	"sent_at" date,
	"notes" text,
	CONSTRAINT "rfq_threads_subjectToken_unique" UNIQUE("subject_token"),
	CONSTRAINT "rfq_threads_qty_positive" CHECK ("rfq_threads"."qty_requested" > 0)
);
--> statement-breakpoint
ALTER TABLE "rfq_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_suppliers" ADD CONSTRAINT "part_suppliers_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_offers" ADD CONSTRAINT "rfq_offers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_offers" ADD CONSTRAINT "rfq_offers_rfq_thread_id_rfq_threads_id_fk" FOREIGN KEY ("rfq_thread_id") REFERENCES "public"."rfq_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_threads" ADD CONSTRAINT "rfq_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_threads" ADD CONSTRAINT "rfq_threads_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfq_threads" ADD CONSTRAINT "rfq_threads_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "part_suppliers_supplier_id_index" ON "part_suppliers" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "rfq_offers_rfq_thread_id_status_index" ON "rfq_offers" USING btree ("rfq_thread_id","status");--> statement-breakpoint
CREATE INDEX "rfq_threads_part_id_status_index" ON "rfq_threads" USING btree ("part_id","status");--> statement-breakpoint
CREATE INDEX "rfq_threads_supplier_id_index" ON "rfq_threads" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_email_lower" ON "suppliers" USING btree (lower("email"));--> statement-breakpoint
CREATE POLICY "part_suppliers_select" ON "part_suppliers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "part_suppliers_insert" ON "part_suppliers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "part_suppliers_update" ON "part_suppliers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "part_suppliers_delete" ON "part_suppliers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "rfq_offers_select" ON "rfq_offers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "rfq_offers_insert" ON "rfq_offers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "rfq_offers_update" ON "rfq_offers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "rfq_offers_delete" ON "rfq_offers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "rfq_threads_select" ON "rfq_threads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "rfq_threads_insert" ON "rfq_threads" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply', 'engineering')));--> statement-breakpoint
CREATE POLICY "rfq_threads_update" ON "rfq_threads" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "rfq_threads_delete" ON "rfq_threads" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "suppliers_select" ON "suppliers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "suppliers_insert" ON "suppliers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "suppliers_update" ON "suppliers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "suppliers_delete" ON "suppliers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers', 'part_suppliers', 'rfq_threads', 'rfq_offers']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_audit_fields()',
      t || '_audit_fields', t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_activity()',
      t || '_activity_log', t);
  END LOOP;
END $$;