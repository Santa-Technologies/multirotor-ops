import "server-only";

import { and, asc, count, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import {
  companies,
  contacts,
  distributors,
  parts,
  pipedriveDeals,
  products,
  suppliers,
} from "@/db/schema";

import {
  DEFAULT_ENTITY_PAGE_SIZE,
  type EntitySearchResult,
  type EntityType,
} from "./types";

export type EntitySearchParams = {
  type: EntityType;
  q?: string;
  page?: number;
  pageSize?: number;
  companyId?: string;
  pipelineId?: number;
};

/**
 * Server-side paginated entity search for pickers. Never dumps full tables;
 * filters with `q` and optional CRM cascade params.
 */
export async function searchEntities(
  params: EntitySearchParams,
): Promise<EntitySearchResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(
    100,
    Math.max(1, params.pageSize ?? DEFAULT_ENTITY_PAGE_SIZE),
  );
  const offset = (page - 1) * pageSize;
  const q = params.q?.trim() ?? "";

  switch (params.type) {
    case "parts":
      return searchParts(q, page, pageSize, offset);
    case "products":
      return searchProducts(q, page, pageSize, offset);
    case "companies":
      return searchCompanies(q, page, pageSize, offset);
    case "contacts":
      return searchContacts(q, page, pageSize, offset, params.companyId);
    case "deals":
      return searchDeals(q, page, pageSize, offset, params.companyId, params.pipelineId);
    case "distributors":
      return searchDistributors(q, page, pageSize, offset);
    case "suppliers":
      return searchSuppliers(q, page, pageSize, offset);
  }
}

async function searchParts(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
): Promise<EntitySearchResult> {
  const db = getDb();
  const where = q
    ? or(ilike(parts.mpn, `%${q}%`), ilike(parts.description, `%${q}%`))
    : undefined;
  const [totalRow] = await db.select({ n: count() }).from(parts).where(where);
  const rows = await db
    .select({
      id: parts.id,
      mpn: parts.mpn,
      manufacturer: parts.manufacturer,
      description: parts.description,
    })
    .from(parts)
    .where(where)
    .orderBy(asc(parts.mpn))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label: [r.mpn, r.manufacturer, r.description].filter(Boolean).join(" · "),
      meta: { mpn: r.mpn },
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

async function searchProducts(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
): Promise<EntitySearchResult> {
  const db = getDb();
  const where = and(
    eq(products.active, true),
    q ? ilike(products.name, `%${q}%`) : undefined,
  );
  const [totalRow] = await db.select({ n: count() }).from(products).where(where);
  const rows = await db
    .select({ id: products.id, name: products.name, variantLabel: products.variantLabel })
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label:
        r.variantLabel && r.variantLabel !== "Standard"
          ? `${r.name} · ${r.variantLabel}`
          : r.name,
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

async function searchCompanies(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
): Promise<EntitySearchResult> {
  const db = getDb();
  const where = q ? ilike(companies.name, `%${q}%`) : undefined;
  const [totalRow] = await db.select({ n: count() }).from(companies).where(where);
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      country: companies.country,
      pipedriveId: companies.pipedriveId,
    })
    .from(companies)
    .where(where)
    .orderBy(asc(companies.name))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label: [r.name, r.country].filter(Boolean).join(" · "),
      meta: { pipedriveId: r.pipedriveId },
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

async function searchContacts(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
  companyId?: string,
): Promise<EntitySearchResult> {
  const db = getDb();
  const filters: SQL[] = [];
  if (companyId) filters.push(eq(contacts.companyId, companyId));
  if (q) {
    const match = or(ilike(contacts.name, `%${q}%`), ilike(contacts.email, `%${q}%`));
    if (match) filters.push(match);
  }
  const where = filters.length > 0 ? and(...filters) : undefined;
  const [totalRow] = await db.select({ n: count() }).from(contacts).where(where);
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      companyId: contacts.companyId,
      pipedriveId: contacts.pipedriveId,
    })
    .from(contacts)
    .where(where)
    .orderBy(asc(contacts.name))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label: [r.name, r.email].filter(Boolean).join(" · "),
      meta: {
        companyId: r.companyId,
        email: r.email,
        pipedriveId: r.pipedriveId,
      },
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

async function searchDeals(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
  companyId?: string,
  pipelineId?: number,
): Promise<EntitySearchResult> {
  const db = getDb();
  const filters: SQL[] = [eq(pipedriveDeals.status, "open")];
  if (companyId) filters.push(eq(pipedriveDeals.companyId, companyId));
  if (pipelineId != null) filters.push(eq(pipedriveDeals.pipelineId, pipelineId));
  if (q) {
    filters.push(
      or(
        ilike(pipedriveDeals.title, `%${q}%`),
        sql`cast(${pipedriveDeals.pipedriveId} as text) ilike ${`%${q}%`}`,
      )!,
    );
  }
  const where = and(...filters);
  const [totalRow] = await db.select({ n: count() }).from(pipedriveDeals).where(where);
  const rows = await db
    .select({
      id: pipedriveDeals.id,
      title: pipedriveDeals.title,
      stageName: pipedriveDeals.stageName,
      pipedriveId: pipedriveDeals.pipedriveId,
      companyId: pipedriveDeals.companyId,
      contactId: pipedriveDeals.contactId,
    })
    .from(pipedriveDeals)
    .where(where)
    .orderBy(asc(pipedriveDeals.title))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label: `${r.title}${r.stageName ? ` · ${r.stageName}` : ""} · PD #${r.pipedriveId}`,
      meta: {
        companyId: r.companyId,
        contactId: r.contactId,
        pipedriveId: r.pipedriveId,
      },
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

async function searchDistributors(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
): Promise<EntitySearchResult> {
  const db = getDb();
  const where = q ? ilike(distributors.name, `%${q}%`) : undefined;
  const [totalRow] = await db.select({ n: count() }).from(distributors).where(where);
  const rows = await db
    .select({
      id: distributors.id,
      name: distributors.name,
      approved: distributors.approved,
      rfqEmail: distributors.rfqEmail,
    })
    .from(distributors)
    .where(where)
    .orderBy(asc(distributors.name))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label: `${r.name}${r.approved ? "" : " (unapproved)"}${r.rfqEmail ? ` · ${r.rfqEmail}` : ""}`,
      meta: { email: r.rfqEmail },
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

async function searchSuppliers(
  q: string,
  page: number,
  pageSize: number,
  offset: number,
): Promise<EntitySearchResult> {
  const db = getDb();
  const where = and(
    eq(suppliers.active, true),
    q
      ? or(ilike(suppliers.name, `%${q}%`), ilike(suppliers.email, `%${q}%`))
      : undefined,
  );
  const [totalRow] = await db.select({ n: count() }).from(suppliers).where(where);
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      email: suppliers.email,
    })
    .from(suppliers)
    .where(where)
    .orderBy(asc(suppliers.name))
    .limit(pageSize)
    .offset(offset);
  return pageResult(
    rows.map((r) => ({
      id: r.id,
      label: `${r.name} · ${r.email}`,
      meta: { email: r.email },
    })),
    page,
    pageSize,
    Number(totalRow?.n ?? 0),
  );
}

function pageResult(
  items: EntitySearchResult["items"],
  page: number,
  pageSize: number,
  total: number,
): EntitySearchResult {
  return {
    items,
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  };
}
