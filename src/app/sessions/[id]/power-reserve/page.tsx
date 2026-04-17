import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type {
  PowerReserveCheckpoint,
  PowerReserveTest,
  TestSession,
  WatchPassport,
} from "@/lib/types";
import { PowerReserveClient } from "./PowerReserveClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }> | { id: string };

type SessionWithPassport = TestSession & {
  watch_passports: WatchPassport | null;
};

export default async function PowerReservePage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = createSupabaseServerClient();

  const { data: sessionRow } = await supabase
    .from("test_sessions")
    .select("*, watch_passports(*)")
    .eq("id", id)
    .maybeSingle();

  if (!sessionRow) notFound();
  const session = sessionRow as unknown as SessionWithPassport;
  const passport = session.watch_passports;

  const { data: activeRow } = await supabase
    .from("power_reserve_tests")
    .select("*")
    .eq("test_session_id", id)
    .eq("still_running", true)
    .maybeSingle();
  const activeTest = (activeRow as PowerReserveTest | null) ?? null;

  const { data: completedRaw } = await supabase
    .from("power_reserve_tests")
    .select("*")
    .eq("test_session_id", id)
    .eq("still_running", false)
    .order("started_at", { ascending: false });
  const completed = (completedRaw ?? []) as PowerReserveTest[];

  let checkpoints: PowerReserveCheckpoint[] = [];
  if (activeTest) {
    const { data: cpRaw } = await supabase
      .from("power_reserve_checkpoints")
      .select("*")
      .eq("power_reserve_test_id", activeTest.id)
      .order("checkpoint_time", { ascending: false });
    checkpoints = (cpRaw ?? []) as PowerReserveCheckpoint[];
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/sessions/${id}`}
            className="btn-label text-tier transition-colors duration-200 ease-staudt hover:text-navy"
          >
            ← Sessie
          </Link>
          <span className="btn-label text-tier">Gangreserve</span>
        </div>

        <div className="mt-5">
          <div className="eyebrow mb-1">{passport?.sku ?? "—"}</div>
          <h1
            className="font-black tracking-tight text-black"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", lineHeight: 1.2 }}
          >
            {passport?.serial_number ?? "Onbekend"}
          </h1>
          {passport?.model_name ? (
            <div className="mt-1 text-base text-body">{passport.model_name}</div>
          ) : null}
        </div>
      </div>

      <PowerReserveClient
        sessionId={id}
        sessionStatus={session.status}
        activeTest={activeTest}
        checkpoints={checkpoints}
      />

      {completed.length > 0 ? (
        <section className="mt-12">
          <div className="eyebrow mb-3">Eerdere gangreserve-tests</div>
          <ul className="space-y-1.5">
            {completed.map((t) => {
              const start = new Date(t.started_at).getTime();
              const end = t.ended_at ? new Date(t.ended_at).getTime() : null;
              const hours =
                end !== null ? Math.round((end - start) / 3_600_000) : null;
              return (
                <li
                  key={t.id}
                  className="border border-line bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-tier">
                    <span>{formatDateTime(t.started_at)}</span>
                    <span>
                      {t.ended_at ? `→ ${formatDateTime(t.ended_at)}` : "—"}
                    </span>
                  </div>
                  <div className="mt-1 font-medium tabular-nums text-black">
                    {hours !== null ? `${hours} uur` : "—"}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
