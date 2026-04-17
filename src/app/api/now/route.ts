import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Geeft serverside epoch ms terug. De client meet z'n eigen Date.now()
// vóór en na de fetch en gebruikt het gemiddelde als RTT-correctie om de
// klok-offset te bepalen voor sub-seconde nauwkeurigheid.
export async function GET() {
  return NextResponse.json({ now: Date.now() });
}
