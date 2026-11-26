-- Phase 3: shared parts catalog, product lines, variants under lines, BOM lines → part_id.
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"mpn" text NOT NULL,
	"manufacturer" text,
	"description" text,
	"default_sourcing" "bom_sourcing" DEFAULT 'distributor' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_lines_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "product_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_lines" ADD CONSTRAINT "product_lines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "parts_mpn_lower" ON "parts" USING btree (lower("mpn"));--> statement-breakpoint
CREATE INDEX "parts_manufacturer_index" ON "parts" USING btree ("manufacturer");--> statement-breakpoint
-- Rename legacy Kern list-price products to CoPilot before creating lines.
UPDATE "products" SET "name" = 'CoPilot Nano' WHERE "name" = 'Kern Nano';--> statement-breakpoint
UPDATE "products" SET "name" = 'CoPilot Nano Plus' WHERE "name" = 'Kern Nano Plus';--> statement-breakpoint
-- One product line per existing variant name, then attach variants.
INSERT INTO "product_lines" ("name")
SELECT "name" FROM "products"
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "product_line_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "variant_label" text DEFAULT 'Standard' NOT NULL;--> statement-breakpoint
UPDATE "products" p
SET "product_line_id" = pl.id
FROM "product_lines" pl
WHERE pl.name = p.name;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "product_line_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_product_line_id_product_lines_id_fk" FOREIGN KEY ("product_line_id") REFERENCES "public"."product_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_product_line_id_index" ON "products" USING btree ("product_line_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_productLineId_variantLabel_unique" UNIQUE("product_line_id","variant_label");--> statement-breakpoint
-- Move embedded MPN fields onto parts, then point bom_lines at part_id.
ALTER TABLE "bom_lines" ADD COLUMN "part_id" uuid;--> statement-breakpoint
INSERT INTO "parts" ("mpn", "manufacturer", "description", "default_sourcing")
SELECT bl.mpn, bl.manufacturer, bl.description, bl.sourcing
FROM (
  SELECT DISTINCT ON (lower(mpn)) mpn, manufacturer, description, sourcing, created_at
  FROM "bom_lines"
  ORDER BY lower(mpn), created_at
) bl
WHERE NOT EXISTS (
  SELECT 1 FROM "parts" p WHERE lower(p.mpn) = lower(bl.mpn)
);--> statement-breakpoint
UPDATE "bom_lines" bl
SET "part_id" = p.id
FROM "parts" p
WHERE lower(p.mpn) = lower(bl.mpn);--> statement-breakpoint
-- Empty bom_lines: no rows to constrain; tables with rows must all have part_id set above.
ALTER TABLE "bom_lines" ALTER COLUMN "part_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_lines" ADD CONSTRAINT "bom_lines_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bom_lines_part_id_index" ON "bom_lines" USING btree ("part_id");--> statement-breakpoint
DROP INDEX "bom_lines_mpn_index";--> statement-breakpoint
ALTER TABLE "bom_lines" DROP COLUMN "mpn";--> statement-breakpoint
ALTER TABLE "bom_lines" DROP COLUMN "manufacturer";--> statement-breakpoint
ALTER TABLE "bom_lines" DROP COLUMN "description";--> statement-breakpoint
CREATE POLICY "parts_select" ON "parts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "parts_insert" ON "parts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "parts_update" ON "parts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "parts_delete" ON "parts" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "product_lines_select" ON "product_lines" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "product_lines_insert" ON "product_lines" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "product_lines_update" ON "product_lines" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering'))) WITH CHECK (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
CREATE POLICY "product_lines_delete" ON "product_lines" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select 1 from public.users u where u.id = (select auth.uid()) and u.role in ('admin', 'engineering')));--> statement-breakpoint
-- Audit triggers for the new tables (same pattern as 0002).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parts', 'product_lines']
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
