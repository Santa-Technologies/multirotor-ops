CREATE TYPE "public"."assembly_lot_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "assembly_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"product_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"status" "assembly_lot_status" DEFAULT 'planned' NOT NULL,
	"eta" date,
	"assembler" text,
	"notes" text,
	CONSTRAINT "assembly_lots_qty_positive" CHECK ("assembly_lots"."qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "assembly_lots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "finished_goods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"product_id" uuid NOT NULL,
	"qty" integer DEFAULT 0 NOT NULL,
	"notes" text,
	CONSTRAINT "finished_goods_productId_unique" UNIQUE("product_id"),
	CONSTRAINT "finished_goods_qty_non_negative" CHECK ("finished_goods"."qty" >= 0)
);
--> statement-breakpoint
ALTER TABLE "finished_goods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "part_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"part_id" uuid NOT NULL,
	"on_hand" integer DEFAULT 0 NOT NULL,
	"on_order_qty" integer DEFAULT 0 NOT NULL,
	"eta" date,
	"po_ref" text,
	"notes" text,
	CONSTRAINT "part_inventory_partId_unique" UNIQUE("part_id"),
	CONSTRAINT "part_inventory_on_hand_non_negative" CHECK ("part_inventory"."on_hand" >= 0),
	CONSTRAINT "part_inventory_on_order_non_negative" CHECK ("part_inventory"."on_order_qty" >= 0)
);
--> statement-breakpoint
ALTER TABLE "part_inventory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assembly_lots" ADD CONSTRAINT "assembly_lots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assembly_lots" ADD CONSTRAINT "assembly_lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finished_goods" ADD CONSTRAINT "finished_goods_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_inventory" ADD CONSTRAINT "part_inventory_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_inventory" ADD CONSTRAINT "part_inventory_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assembly_lots_product_id_index" ON "assembly_lots" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "assembly_lots_status_index" ON "assembly_lots" USING btree ("status");--> statement-breakpoint
CREATE INDEX "assembly_lots_eta_index" ON "assembly_lots" USING btree ("eta");--> statement-breakpoint
CREATE INDEX "part_inventory_eta_index" ON "part_inventory" USING btree ("eta");--> statement-breakpoint
CREATE POLICY "assembly_lots_select" ON "assembly_lots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "assembly_lots_insert" ON "assembly_lots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "assembly_lots_update" ON "assembly_lots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "assembly_lots_delete" ON "assembly_lots" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "finished_goods_select" ON "finished_goods" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "finished_goods_insert" ON "finished_goods" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "finished_goods_update" ON "finished_goods" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "finished_goods_delete" ON "finished_goods" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "part_inventory_select" ON "part_inventory" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "part_inventory_insert" ON "part_inventory" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "part_inventory_update" ON "part_inventory" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
CREATE POLICY "part_inventory_delete" ON "part_inventory" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'supply')));--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['part_inventory', 'finished_goods', 'assembly_lots']
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