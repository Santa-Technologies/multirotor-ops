import "server-only";

import { asc, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  companies,
  contacts,
  pipedriveDeals,
  products,
  requests,
  users,
} from "@/db/schema";

const OPEN_STATUSES = ["new", "triaged", "accepted", "planned"] as const;

/** Lists requests newest-first with company / owner / product labels. */
export async function listRequests() {
  const db = getDb();
  return db
    .select({
      request: requests,
      companyName: companies.name,
      contactName: contacts.name,
      ownerName: users.name,
      ownerEmail: users.email,
      productName: products.name,
    })
    .from(requests)
    .innerJoin(companies, eq(companies.id, requests.companyId))
    .leftJoin(contacts, eq(contacts.id, requests.contactId))
    .leftJoin(users, eq(users.id, requests.ownerId))
    .leftJoin(products, eq(products.id, requests.productId))
    .orderBy(desc(requests.createdAt));
}

/**
 * Open (not done/declined) requests. When ownerId is set, returns that owner's
 * work plus unassigned items (useful for Marc's weekly triage).
 */
export async function listOpenRequests(ownerId?: string) {
  const db = getDb();
  const rows = await db
    .select({
      request: requests,
      companyName: companies.name,
      ownerName: users.name,
      productName: products.name,
    })
    .from(requests)
    .innerJoin(companies, eq(companies.id, requests.companyId))
    .leftJoin(users, eq(users.id, requests.ownerId))
    .leftJoin(products, eq(products.id, requests.productId))
    .where(inArray(requests.status, [...OPEN_STATUSES]))
    .orderBy(asc(requests.dueDate), desc(requests.createdAt));

  if (!ownerId) return rows;
  return rows.filter(
    (r) => r.request.ownerId === ownerId || r.request.ownerId == null,
  );
}

export async function listCompaniesForSelect() {
  const db = getDb();
  return db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .orderBy(asc(companies.name));
}

export async function listContactsForSelect() {
  const db = getDb();
  return db
    .select({
      id: contacts.id,
      name: contacts.name,
      companyId: contacts.companyId,
    })
    .from(contacts)
    .orderBy(asc(contacts.name));
}

export async function listUsersForOwnerSelect() {
  const db = getDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .orderBy(asc(users.email));
}

export async function listOpenPipedriveDeals(limit = 40) {
  const db = getDb();
  return db
    .select({
      deal: pipedriveDeals,
      companyName: companies.name,
    })
    .from(pipedriveDeals)
    .leftJoin(companies, eq(companies.id, pipedriveDeals.companyId))
    .where(eq(pipedriveDeals.status, "open"))
    .orderBy(desc(pipedriveDeals.syncedAt))
    .limit(limit);
}

export async function listCompaniesWithContactCounts() {
  const db = getDb();
  const companyRows = await db
    .select()
    .from(companies)
    .orderBy(asc(companies.name));
  const contactRows = await db.select().from(contacts);
  return companyRows.map((company) => ({
    company,
    contacts: contactRows.filter((c) => c.companyId === company.id),
  }));
}

/** Cost / inventory style flags already covered elsewhere; request open count. */
export async function countOpenRequests() {
  const db = getDb();
  const rows = await db
    .select({ id: requests.id })
    .from(requests)
    .where(inArray(requests.status, [...OPEN_STATUSES]));
  return rows.length;
}

export async function countOpenDeals() {
  const db = getDb();
  const rows = await db
    .select({ id: pipedriveDeals.id })
    .from(pipedriveDeals)
    .where(eq(pipedriveDeals.status, "open"));
  return rows.length;
}

export { OPEN_STATUSES };
