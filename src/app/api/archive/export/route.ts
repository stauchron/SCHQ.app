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

function applySort<T>(
  query: { order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => T },
  sort: ArchiveSort,
): T {
  switch (sort) {
    case "oldest":
      return query.order("completed_at", { ascending: true, nullsFirst: false });
    case "serial_asc":
      return query.order("serial_number", { ascending: true });
    case "serial_desc":
      return query.order("serial_number", { ascending: false });
    case "recent":
    default:
      return query.order("completed_at", { ascending: false, nullsFirst: false });
  }
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
  let query = supabase
    .from("archived_sessions_view")
    .select("*")
    .limit(10_000);

  if (archive.q) {
    const term = `%${archive.q}%`;
    query = query.or(
      `serial_number.ilike.${term},sku.ilike.${term},model_name.ilike.${term}`,
    );
  }
  if (archive.from) {
    query = query.gte("completed_at", `${archive.from}T00:00:00Z`);
  }
  if (archive.to) {
    query = query.lte("completed_at", `${archive.to}T23:59:59Z`);
  }
  query = applySort(query, archive.sort);

  const { data, error } = await query;
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
