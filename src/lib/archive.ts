// Helpers voor de archief-route: parse search params, bouw queries.

export type ArchiveSort = "recent" | "oldest" | "serial_asc" | "serial_desc";
export type ArchiveQuickFilter = "week" | "month" | "year" | "all";

export type ArchiveQuery = {
  q: string;
  from: string | null; // YYYY-MM-DD
  to: string | null;
  sort: ArchiveSort;
  page: number;
  pageSize: number;
};

export const PAGE_SIZE = 20;

const SORT_VALUES = new Set<ArchiveSort>([
  "recent",
  "oldest",
  "serial_asc",
  "serial_desc",
]);

function isSort(value: string | undefined): value is ArchiveSort {
  return value !== undefined && SORT_VALUES.has(value as ArchiveSort);
}

export function parseArchiveParams(
  raw: Record<string, string | undefined>,
): ArchiveQuery {
  const q = (raw.q ?? "").trim();
  const from = raw.from?.trim() || null;
  const to = raw.to?.trim() || null;
  const sort: ArchiveSort = isSort(raw.sort) ? raw.sort : "recent";
  const pageNum = Number(raw.page ?? "1");
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;
  return { q, from, to, sort, page, pageSize: PAGE_SIZE };
}

// Berekent from/to op basis van een snelfilter, lokale tijd → ISO date string.
export function quickRange(
  filter: ArchiveQuickFilter,
): { from: string | null; to: string | null } {
  if (filter === "all") return { from: null, to: null };
  const now = new Date();
  const from = new Date(now);
  if (filter === "week") {
    from.setDate(now.getDate() - 7);
  } else if (filter === "month") {
    from.setMonth(now.getMonth() - 1);
  } else if (filter === "year") {
    from.setFullYear(now.getFullYear() - 1);
  }
  return { from: from.toISOString().slice(0, 10), to: null };
}

// Bouw URL-querystring zonder lege keys.
export function buildArchiveUrl(
  base: string,
  params: Partial<ArchiveQuery>,
): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.sort && params.sort !== "recent") sp.set("sort", params.sort);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
