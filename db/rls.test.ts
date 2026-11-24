import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  asUser,
  assertDisposableDatabase,
  migrateDatabase,
  resetDatabase,
} from "@/test/supabase-stubs";

// Runs only against a disposable Postgres, e.g.
// TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/kern_test npm test
const url = process.env.TEST_DATABASE_URL;

const SALES = "00000000-0000-4000-8000-000000000001";
const ENGINEERING = "00000000-0000-4000-8000-000000000002";
const SUPPLY = "00000000-0000-4000-8000-000000000003";
const JUSTUS = "00000000-0000-4000-8000-000000000004";

describe.skipIf(!url)("database: migrations, seed, RLS and activity log", () => {
  let sql: Sql;
  let bomVersionId: string;
  let bomLineId: string;

  /** Users as they exist after first sign-in, plus a BOM engineering builds through RLS. */
  async function createFixtures() {
    await sql`insert into auth.users (id, email) values
      (${SALES}, 'sales@kern.test'), (${ENGINEERING}, 'eng@kern.test'), (${SUPPLY}, 'supply@kern.test')`;
    await sql`insert into public.users (id, name, email, role) values
      (${SALES}, 'Sales', 'sales@kern.test', 'sales'),
      (${ENGINEERING}, 'Engineering', 'eng@kern.test', 'engineering'),
      (${SUPPLY}, 'Supply', 'supply@kern.test', 'supply')`;
    await asUser(sql, ENGINEERING, async (tx) => {
      const [version] = await tx`
        insert into bom_versions (product_id, version, is_current)
        select id, 'A', true from products where name = 'Pilot H743'
        returning id`;
      bomVersionId = version.id;
      const [line] = await tx`
        insert into bom_lines (bom_version_id, mpn, qty_per_board)
        values (${bomVersionId}, 'STM32H743VIT6', 1) returning id`;
      bomLineId = line.id;
    });
  }

  beforeAll(async () => {
    assertDisposableDatabase(url!);
    sql = postgres(url!, { max: 1, onnotice: () => {} });
    await resetDatabase(sql);
    await migrateDatabase(sql);
    await createFixtures();
  });

  afterAll(async () => {
    await sql?.end({ timeout: 1 });
  });

  it("applies on top of the production state: 0000 applied, users already signed in", async () => {
    await resetDatabase(sql);
    await migrateDatabase(sql, 1);
    await sql`insert into auth.users (id, email) values
      (${SALES}, 'sales@kern.test'), (${JUSTUS}, 'J.Nikolaus@santatech.io')`;
    // Signed in before phase 1, so the app already created this row.
    await sql`insert into public.users (id, name, email, role) values (${SALES}, 'Sales', 'sales@kern.test', 'sales')`;

    await migrateDatabase(sql);
    await migrateDatabase(sql);

    const users = await sql`select email, role from users order by email`;
    expect(users).toEqual([
      { email: "j.nikolaus@santatech.io", role: "admin" },
      { email: "sales@kern.test", role: "sales" },
    ]);
    const [{ count }] =
      await sql`select count(*)::int as count from drizzle.__drizzle_migrations`;
    expect(count).toBe(4);

    await sql`delete from public.users where id = ${JUSTUS}`;
    await sql`delete from public.users where id = ${SALES}`;
    await sql`delete from auth.users`;
    await createFixtures();
  });

  it("seeds the products and the Pilot H743 calculator defaults", async () => {
    const products = await sql`select name, pricing_mode from products order by name`;
    expect(products).toEqual([
      { name: "Kern Nano", pricing_mode: "list_price" },
      { name: "Kern Nano Plus", pricing_mode: "list_price" },
      { name: "Pilot H743", pricing_mode: "cost_plus" },
    ]);

    const [settings] = await sql`
      select s.manual_cost_cents, s.cost_factors, s.margin_pct::float8 as margin_pct, s.floor_cents,
             s.std_deposit_pct::float8 as std_deposit_pct, s.lead_weeks, s.monthly_capacity,
             s.validity_days, s.adj_threshold_pct::float8 as adj_threshold_pct
      from quote_settings s join products p on p.id = s.product_id
      where p.name = 'Pilot H743'`;
    expect(settings).toEqual({
      manual_cost_cents: 8600,
      cost_factors: { "100": 1, "1000": 0.85, "5000": 0.78, "10000": 0.75, "20000": 0.7 },
      margin_pct: 30,
      floor_cents: 8000,
      std_deposit_pct: 50,
      lead_weeks: 12,
      monthly_capacity: 2500,
      validity_days: 30,
      adj_threshold_pct: 10,
    });
  });

  it("does not let a sales user edit a BOM", async () => {
    await asUser(sql, SALES, async (tx) => {
      const updated =
        await tx`update bom_lines set qty_per_board = 99 where id = ${bomLineId}`;
      expect(updated.count).toBe(0);
      const deleted = await tx`delete from bom_lines where id = ${bomLineId}`;
      expect(deleted.count).toBe(0);
      const versions =
        await tx`update bom_versions set notes = 'sales edit' where id = ${bomVersionId}`;
      expect(versions.count).toBe(0);
    });

    await expect(
      asUser(
        sql,
        SALES,
        (tx) =>
          tx`insert into bom_lines (bom_version_id, mpn, qty_per_board) values (${bomVersionId}, 'X', 1)`,
      ),
    ).rejects.toMatchObject({ code: "42501" });

    const [line] = await sql`select qty_per_board from bom_lines where id = ${bomLineId}`;
    expect(line.qty_per_board).toBe(1);
    // Sales can still read the BOM.
    const visible = await asUser(sql, SALES, (tx) => tx`select id from bom_lines`);
    expect(visible).toHaveLength(1);
  });

  it("lets each role write its own tables", async () => {
    await asUser(
      sql,
      SALES,
      (tx) => tx`insert into companies (name) values ('Acme Drones')`,
    );
    await asUser(
      sql,
      SUPPLY,
      (
        tx,
      ) => tx`insert into manual_quotes (mpn, supplier, qty, unit_price_cents, quoted_at)
                 values ('STM32H743VIT6', 'Supplier GmbH', 1000, 1250, current_date)`,
    );
    await expect(
      asUser(sql, SUPPLY, (tx) => tx`insert into companies (name) values ('Not mine')`),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(sql, SALES, (tx) => tx`update quote_settings set margin_pct = 1`).then(
        (r) => r.count,
      ),
    ).resolves.toBe(0);
  });

  it("writes activity_log on insert, update and delete with the acting user", async () => {
    await asUser(
      sql,
      ENGINEERING,
      (tx) => tx`update bom_lines set qty_per_board = 2 where id = ${bomLineId}`,
    );

    const [created] = await sql`
      select action, user_id from activity_log where entity = 'bom_lines' and entity_id = ${bomLineId}
      and action = 'insert'`;
    expect(created).toEqual({ action: "insert", user_id: ENGINEERING });

    const [changed] = await sql`
      select user_id, diff from activity_log where entity = 'bom_lines' and entity_id = ${bomLineId}
      and action = 'update'`;
    expect(changed).toEqual({
      user_id: ENGINEERING,
      diff: { qty_per_board: { old: 1, new: 2 } },
    });

    const [line] = await sql`select created_by from bom_lines where id = ${bomLineId}`;
    expect(line.created_by).toBe(ENGINEERING);

    await asUser(
      sql,
      ENGINEERING,
      (tx) => tx`delete from bom_lines where id = ${bomLineId}`,
    );
    const [removed] = await sql`
      select diff ->> 'mpn' as mpn from activity_log where entity = 'bom_lines' and entity_id = ${bomLineId}
      and action = 'delete'`;
    expect(removed.mpn).toBe("STM32H743VIT6");
  });

  it("records server writes under app.user_id", async () => {
    const [company] = await sql.begin(async (tx) => {
      await tx`select set_config('app.user_id', ${SALES}, true)`;
      return tx`insert into companies (name) values ('Server Co') returning id, created_by`;
    });
    expect(company.created_by).toBe(SALES);
    const [entry] =
      await sql`select user_id from activity_log where entity_id = ${company.id}`;
    expect(entry.user_id).toBe(SALES);
  });

  it("keeps price snapshots and the activity log append-only", async () => {
    const [distributor] =
      await sql`insert into distributors (name, approved) values ('Mouser', true) returning id`;
    const [snapshot] = await sql`
      insert into price_snapshots (mpn, distributor_id, currency, price_breaks)
      values ('STM32H743VIT6', ${distributor.id}, 'EUR', '{"1": 12.5}') returning id`;

    await expect(
      sql`update price_snapshots set stock = 1 where id = ${snapshot.id}`,
    ).rejects.toMatchObject({
      code: "23001",
    });
    await expect(sql`delete from activity_log`).rejects.toMatchObject({ code: "23001" });
  });
});
