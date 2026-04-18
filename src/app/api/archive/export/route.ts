import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseArchiveParams, type ArchiveSort } from "@/lib/archive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  watch_passport_id: string;
  started_at: string;
  completed_at: string | null;
  serial_number: string;
  sku: string;
  model_name: string | null;
  movement_type: string | null;
  notes: string | null;
  measurement_count: number;
  duration_test_count: number;
  power_reserve_count: number;
};

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sortClause(sort: ArchiveSort): {
  column: string;
  ascending: boolean;
} {
  switch (sort) {
    case "oldest":
      return { column: "completed_at", ascending: true };
    case "serial_asc":
      return { column: "serial_number", ascending: true };
    case "serial_desc":
      return { column: "serial_number", ascending: false };
    case "recent":
    default:
      return { column: "completed_at", ascending: false };
  }
}

type FilterableBuilder = {
  or: (filter: string) => FilterableBuilder;
  gte: (column: string, value: string) => FilterableBuilder;
  lte: (column: string, value: string) => FilterableBuilder;
};
function applyFilters<T extends FilterableBuilder>(
  builder: T,
  q: string,
  from: string | null,
  to: string | null,
): T {
  let next = builder;
  if (q) {
    const term = `%${q}%`;
    next = next.or(
      `serial_number.ilike.${term},sku.ilike.${term},model_name.ilike.${term}`,
    ) as T;
  }
  if (from) next = next.gte("completed_at", `${from}T00:00:00Z`) as T;
  if (to) next = next.lte("completed_at", `${to}T23:59:59Z`) as T;
  return next;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const archive = parseArchiveParams({
    q: sp.get("q") ?? undefined,
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    sort: sp.get("sort") ?? undefined,
  });

  const supabase = createSupabaseServerClient();
  const sort = sortClause(archive.sort);

  const filtered = applyFilters(
    supabase
      .from("archived_sessions_view")
      .select("*")
      .limit(10_000),
    archive.q,
    archive.from,
    archive.to,
  );

  const { data, error } = await filtered.order(sort.column, {
    ascending: sort.ascending,
    nullsFirst: false,
  });
  if (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []) as Row[];

  const headers = [
    "id",
    "serienummer",
    "sku",
    "model",
    "uurwerk",
    "gestart",
    "afgerond",
    "metingen",
    "duurtests",
    "gangreserve_tests",
    "notities",
  ];

  const lines: string[] = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.serial_number,
        r.sku,
        r.model_name,
        r.movement_type,
        r.started_at,
        r.completed_at,
        r.measurement_count,
        r.duration_test_count,
        r.power_reserve_count,
        r.notes,
      ]
        .map(escape)
        .join(","),
    );
  }
  // Excel-vriendelijk: BOM voor UTF-8
  const csv = "\uFEFF" + lines.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="schq-archief-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
