import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import {
  buildArchiveUrl,
  parseArchiveParams,
  type ArchiveSort,
} from "@/lib/archive";
import { ArchiveFilters } from "./ArchiveFilters";

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
  measurement_count: number;
  duration_test_count: number;
  power_reserve_count: number;
};

type SearchParams = Promise<Record<string, string | undefined>>
  | Record<string, string | undefined>;

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

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const archive = parseArchiveParams(params);
  const supabase = createSupabaseServerClient();

  let query = supabase
    .from("archived_sessions_view")
    .select("*", { count: "exact" });

  if (archive.q) {
    // Search across serial_number, sku, model_name (ILIKE met pg_trgm-index)
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

  const sort = sortClause(archive.sort);
  query = query.order(sort.column, {
    ascending: sort.ascending,
    nullsFirst: false,
  });

  const offset = (archive.page - 1) * archive.pageSize;
  query = query.range(offset, offset + archive.pageSize - 1);

  const { data, count, error } = await query;
  const rows = ((data ?? []) as unknown as Row[]) ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / archive.pageSize));

  const exportUrl = (() => {
    const sp = new URLSearchParams();
    if (archive.q) sp.set("q", archive.q);
    if (archive.from) sp.set("from", archive.from);
    if (archive.to) sp.set("to", archive.to);
    if (archive.sort !== "recent") sp.set("sort", archive.sort);
    const qs = sp.toString();
    return qs ? `/api/archive/export?${qs}` : "/api/archive/export";
  })();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="btn-label text-tier transition-colors duration-200 ease-staudt hover:text-navy"
        >
          ← Dashboard
        </Link>
        <a
          href={exportUrl}
          className="btn-label border-b border-taupe pb-0.5 text-navy transition-colors duration-200 ease-staudt hover:border-navy"
        >
          CSV-export
        </a>
      </div>

      <div className="mb-3">
        <div className="eyebrow mb-1">Archief</div>
        <div className="text-sm text-body">
          <strong className="font-medium text-black">{total}</strong>{" "}
          afgeronde {total === 1 ? "sessie" : "sessies"}
        </div>
      </div>

      <ArchiveFilters
        initialQ={archive.q}
        initialFrom={archive.from}
        initialTo={archive.to}
        initialSort={archive.sort}
      />

      {error ? (
        <div className="border border-dashed border-taupe bg-zand/40 px-4 py-6 text-center text-sm text-body">
          Database niet bereikbaar — controleer of migratie 0007 is uitgevoerd.
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-taupe bg-zand/40 px-4 py-6 text-center text-sm text-body">
          Geen sessies gevonden.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => {
            const tags: string[] = [];
            if (row.measurement_count > 0)
              tags.push(`${row.measurement_count} meting${row.measurement_count === 1 ? "" : "en"}`);
            if (row.duration_test_count > 0)
              tags.push(`${row.duration_test_count} duurtest${row.duration_test_count === 1 ? "" : "s"}`);
            if (row.power_reserve_count > 0)
              tags.push(
                `${row.power_reserve_count} gangres.`,
              );
            return (
              <li key={row.id}>
                <Link
                  href={`/sessions/${row.id}`}
                  className="block border border-line bg-white transition-colors duration-150 hover:bg-zand/60"
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.18em] text-tier">
                      <span>{row.sku}</span>
                      <span>
                        {row.completed_at
                          ? formatDateTime(row.completed_at)
                          : formatDateTime(row.started_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-black tracking-tight text-black">
                        {row.serial_number}
                      </span>
                      {row.model_name ? (
                        <span className="text-[11px] text-tier">
                          {row.model_name}
                        </span>
                      ) : null}
                    </div>
                    {tags.length > 0 ? (
                      <div className="mt-1 text-[11px] text-tier tabular-nums">
                        {tags.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          {archive.page > 1 ? (
            <Link
              href={buildArchiveUrl("/archive", {
                ...archive,
                page: archive.page - 1,
              })}
              className="btn-label text-navy hover:underline"
            >
              ← Vorige
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[11px] uppercase tracking-[0.18em] text-tier">
            pagina {archive.page} / {totalPages}
          </span>
          {archive.page < totalPages ? (
            <Link
              href={buildArchiveUrl("/archive", {
                ...archive,
                page: archive.page + 1,
              })}
              className="btn-label text-navy hover:underline"
            >
              Volgende →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </>
  );
}
