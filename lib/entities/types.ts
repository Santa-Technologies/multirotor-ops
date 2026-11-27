export const ENTITY_TYPES = [
  "parts",
  "products",
  "companies",
  "contacts",
  "deals",
  "distributors",
  "suppliers",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export type EntityOption = {
  id: string;
  label: string;
  /** Extra metadata for cascading CRM picks (company/contact/deal). */
  meta?: {
    companyId?: string | null;
    contactId?: string | null;
    pipedriveId?: number | null;
    email?: string | null;
    mpn?: string | null;
  };
};

export type EntitySearchResult = {
  items: EntityOption[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export const DEFAULT_ENTITY_PAGE_SIZE = 25;

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}
