// Klok-sync: meet de offset tussen client- en serverklok via /api/now en
// corrigeer voor round-trip-time. Resultaat is sub-seconde nauwkeurig.

export type ClockSync = {
  // Voeg dit toe aan Date.now() om de gesynchroniseerde server-tijd te krijgen.
  offsetMs: number;
  // Geschatte ondergrens van de onnauwkeurigheid (half RTT).
  uncertaintyMs: number;
  // Wanneer de sync is gedaan (server tijd).
  syncedAt: number;
};

export async function syncClock(): Promise<ClockSync> {
  // Drie samples nemen, beste (laagste RTT) gebruiken
  let best: ClockSync | null = null;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const res = await fetch("/api/now", { cache: "no-store" });
    const t1 = Date.now();
    if (!res.ok) continue;
    const json = (await res.json()) as { now: number };
    const rtt = t1 - t0;
    // Aanname: server-tijdstempel zit halverwege de RTT
    const serverTimeAtT1 = json.now + rtt / 2;
    const offsetMs = serverTimeAtT1 - t1;
    const candidate: ClockSync = {
      offsetMs,
      uncertaintyMs: rtt / 2,
      syncedAt: serverTimeAtT1,
    };
    if (!best || candidate.uncertaintyMs < best.uncertaintyMs) {
      best = candidate;
    }
  }
  if (!best) {
    // Fallback: gebruik client-klok zonder correctie
    return { offsetMs: 0, uncertaintyMs: 9999, syncedAt: Date.now() };
  }
  return best;
}

export function syncedNow(sync: ClockSync | null): number {
  if (!sync) return Date.now();
  return Date.now() + sync.offsetMs;
}
