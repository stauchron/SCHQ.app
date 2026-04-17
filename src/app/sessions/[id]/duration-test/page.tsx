import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type {
  DurationCheckpoint,
  DurationTest,
  TestSession,
  WatchPassport,
} from "@/lib/types";
import { DurationTestClient } from "./DurationTestClient";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }> | { id: string };

type SessionWithPassport = TestSession & {
  watch_passports: WatchPassport | null;
};

export default async function DurationTestPage({ params }: { params: Params }) {
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

  // Actieve duurtest (max 1 per sessie via DB-constraint)
  const { data: activeRow } = await supabase
    .from("duration_tests")
    .select("*")
    .eq("test_session_id", id)
    .eq("active", true)
    .maybeSingle();
  const activeTest = (activeRow as DurationTest | null) ?? null;

  // Eerdere afgeronde duurtesten (historie)
  const { data: completedRaw } = await supabase
    .from("duration_tests")
    .select("*")
    .eq("test_session_id", id)
    .eq("active", false)
    .order("started_at", { ascending: false });
  const completed = (completedRaw ?? []) as DurationTest[];

  let checkpoints: DurationCheckpoint[] = [];
  if (activeTest) {
    const { data: cpRaw } = await supabase
      .from("duration_checkpoints")
      .select("*")
      .eq("duration_test_id", activeTest.id)
      .order("checkpoint_time", { ascending: false });
    checkpoints = (cpRaw ?? []) as DurationCheckpoint[];
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
          <span className="btn-label text-tier">Duurtest</span>
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

      <DurationTestClient
        sessionId={id}
        sessionStatus={session.status}
        activeTest={activeTest}
        checkpoints={checkpoints}
      />

      {completed.length > 0 ? (
        <section className="mt-12">
          <div className="eyebrow mb-3">Eerdere duurtesten</div>
          <ul className="space-y-2">
            {completed.map((t) => (
              <li
                key={t.id}
                className="border border-line bg-white p-3 text-sm text-body"
              >
                <div className="text-xs uppercase tracking-[0.18em] text-tier">
                  {formatDateTime(t.started_at)}
                  {t.completed_at ? ` → ${formatDateTime(t.completed_at)}` : ""}
                </div>
                {t.notes ? (
                  <p className="mt-1 italic">{t.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
