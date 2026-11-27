import { parseProductLink } from "./distributor-host";

export type BomColumnKey =
  | "mpn"
  | "manufacturer"
  | "description"
  | "qtyPerBoard"
  | "designators"
  | "sourcing"
  | "alternates"
  | "productUrl";

export type BomColumnMapping = Partial<Record<BomColumnKey, string>>;

export type ParsedBomRow = {
  mpn: string;
  manufacturer: string | null;
  description: string | null;
  qtyPerBoard: number;
  designators: string | null;
  sourcing: "distributor" | "direct_quote";
  alternates: string[];
  productUrl: string | null;
  distributorHostKey: string | null;
};

export type BomParseIssue = {
  row: number;
  message: string;
};

export type BomParseResult = {
  headers: string[];
  rows: ParsedBomRow[];
  issues: BomParseIssue[];
};

const HEADER_ALIASES: Record<BomColumnKey, string[]> = {
  mpn: ["mpn", "part number", "part_number", "manufacturer part number", "part"],
  manufacturer: ["manufacturer", "mfr", "vendor"],
  description: ["description", "desc", "value", "designation"],
  qtyPerBoard: ["qty", "qty_per_board", "qty per board", "quantity", "qpa"],
  designators: ["designators", "designator", "reference", "refs", "ref des"],
  sourcing: ["sourcing", "source"],
  alternates: ["alternates", "alternate", "alt", "alt mpn"],
  productUrl: ["link", "url", "product url", "product_url", "digikey", "lcsc"],
};

/** Splits one CSV line, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "," || ch === "\t") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

/** Guesses a column mapping from header labels. */
export function suggestBomMapping(headers: string[]): BomColumnMapping {
  const mapping: BomColumnMapping = {};
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [
    BomColumnKey,
    string[],
  ][]) {
    const index = normalized.findIndex((h) => aliases.includes(h));
    if (index >= 0) mapping[key] = headers[index];
  }
  return mapping;
}

/**
 * Parses CSV/TSV text into BOM rows using an explicit column mapping.
 * Skips blank lines; collects per-row issues without aborting the whole file.
 * Link host → distributor is derived without scraping.
 */
export function parseBomCsv(text: string, mapping: BomColumnMapping): BomParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [], issues: [{ row: 0, message: "File is empty." }] };
  }

  const headers = splitCsvLine(lines[0]!);
  const headerIndex = new Map(headers.map((h, i) => [h, i]));
  const issues: BomParseIssue[] = [];
  const rows: ParsedBomRow[] = [];

  if (!mapping.mpn || !mapping.qtyPerBoard) {
    issues.push({
      row: 0,
      message: "Map at least MPN and quantity per board before importing.",
    });
    return { headers, rows, issues };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const cell = (header: string | undefined) => {
      if (!header) return "";
      const idx = headerIndex.get(header);
      return idx === undefined ? "" : (cells[idx] ?? "").trim();
    };

    const mpn = cell(mapping.mpn);
    const qtyRaw = cell(mapping.qtyPerBoard);
    const qtyPerBoard = Number.parseInt(qtyRaw, 10);
    const rowNumber = i + 1;

    if (!mpn) {
      issues.push({ row: rowNumber, message: "Missing MPN." });
      continue;
    }
    if (!Number.isFinite(qtyPerBoard) || qtyPerBoard <= 0) {
      issues.push({
        row: rowNumber,
        message: `Quantity must be a positive integer (got "${qtyRaw}").`,
      });
      continue;
    }

    const sourcingRaw = cell(mapping.sourcing).toLowerCase().replace(/\s+/g, "_");
    const sourcing =
      sourcingRaw === "direct_quote" || sourcingRaw === "direct" ? "direct_quote" : "distributor";

    const alternates = cell(mapping.alternates)
      .split(/[|;]/)
      .map((a) => a.trim())
      .filter(Boolean);

    const linkRaw = cell(mapping.productUrl);
    const link = linkRaw ? parseProductLink(linkRaw) : null;
    let manufacturer = cell(mapping.manufacturer) || null;
    if (!manufacturer && link?.manufacturerSlug) {
      manufacturer = link.manufacturerSlug;
    }

    rows.push({
      mpn,
      manufacturer,
      description: cell(mapping.description) || null,
      qtyPerBoard,
      designators: cell(mapping.designators) || null,
      sourcing,
      alternates,
      productUrl: link?.url ?? null,
      distributorHostKey: link?.distributor?.hostKey ?? link?.hostKey ?? null,
    });
  }

  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = row.mpn.toLowerCase();
    const prev = seen.get(key);
    if (prev !== undefined) {
      issues.push({
        row: prev,
        message: `Duplicate MPN "${row.mpn}" in this file (also later in the file).`,
      });
    } else {
      seen.set(key, rows.indexOf(row) + 2);
    }
  }

  return { headers, rows, issues };
}
