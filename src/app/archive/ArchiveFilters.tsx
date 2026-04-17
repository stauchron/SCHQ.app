"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  buildArchiveUrl,
  quickRange,
  type ArchiveQuickFilter,
  type ArchiveSort,
} from "@/lib/archive";

const SORT_OPTIONS: { value: ArchiveSort; label: string }[] = [
  { value: "recent", label: "Nieuwste eerst" },
  { value: "oldest", label: "Oudste eerst" },
  { value: "serial_asc", label: "Serienummer A→Z" },
  { value: "serial_desc", label: "Serienummer Z→A" },
];

const QUICK_FILTERS: { value: ArchiveQuickFilter; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Maand" },
  { value: "year", label: "Jaar" },
  { value: "all", label: "Alles" },
];

type Props = {
  initialQ: string;
  initialFrom: string | null;
  initialTo: string | null;
  initialSort: ArchiveSort;
};

export function ArchiveFilters({
  initialQ,
  initialFrom,
  initialTo,
  initialSort,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [sort, setSort] = useState<ArchiveSort>(initialSort);
  const isFirst = useRef(true);

  // Debounced URL-update bij elke wijziging
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const handle = setTimeout(() => {
      const url = buildArchiveUrl("/archive", {
        q,
        from: from || null,
        to: to || null,
        sort,
        page: 1,
      });
      router.push(url);
    }, 300);
    return () => clearTimeout(handle);
  }, [q, from, to, sort, router]);

  function applyQuick(filter: ArchiveQuickFilter) {
    const range = quickRange(filter);
    setFrom(range.from ?? "");
    setTo(range.to ?? "");
  }

  // Bepaal welk snelfilter actief is op basis van huidige URL params (niet lokale state)
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  function isQuickActive(filter: ArchiveQuickFilter): boolean {
    const expected = quickRange(filter);
    return (
      (expected.from ?? "") === currentFrom &&
      (expected.to ?? "") === currentTo
    );
  }

  return (
    <div className="mb-4 space-y-2">
      <input
        type="text"
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Zoek op serienummer, SKU of model…"
        className="w-full border border-line bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-muted focus:border-navy"
      />

      <div className="grid grid-cols-4 gap-1.5">
        {QUICK_FILTERS.map((qf) => {
          const active = isQuickActive(qf.value);
          return (
            <button
              key={qf.value}
              type="button"
              onClick={() => applyQuick(qf.value)}
              className={`btn-label border px-1 py-1.5 transition-colors duration-150 ease-staudt ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-white text-tier hover:border-navy hover:text-navy"
              }`}
            >
              {qf.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
          <span className="eyebrow mb-1 block">Van</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full border border-line bg-white px-2 py-1.5 text-sm text-black outline-none focus:border-navy"
          />
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">Tot</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full border border-line bg-white px-2 py-1.5 text-sm text-black outline-none focus:border-navy"
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow mb-1 block">Sortering</span>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as ArchiveSort)}
          className="w-full border border-line bg-white px-2 py-1.5 text-sm text-black outline-none focus:border-navy"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
