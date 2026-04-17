import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

// ──────────────────────────────────────────────────────────────────────────
// Schema's voor de gestructureerde output
// ──────────────────────────────────────────────────────────────────────────
const measurementSchema = z
  .object({
    rate: z.number().nullable(),
    amplitude: z.number().nullable(),
    beat_error: z.number().nullable(),
  })
  .nullable();

const allPositionsSchema = z.object({
  ch: measurementSchema,
  h6: measurementSchema,
  h9: measurementSchema,
  h12: measurementSchema,
  h3: measurementSchema,
  fh: measurementSchema,
});

const singlePositionSchema = z.object({
  rate: z.number().nullable(),
  amplitude: z.number().nullable(),
  beat_error: z.number().nullable(),
});

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("all"),
    photo_url: z.string().url(),
  }),
  z.object({
    mode: z.literal("single"),
    photo_url: z.string().url(),
    position: z.enum(["ch", "h6", "h9", "h12", "h3", "fh"]),
  }),
]);

// ──────────────────────────────────────────────────────────────────────────
// Prompts
// ──────────────────────────────────────────────────────────────────────────
const ALL_POSITIONS_PROMPT = `Je analyseert een foto van een mechanische horloge timegrapher (bv. Witschi, Weishi, Microset).

Lees de meetwaarden af voor zoveel posities als zichtbaar zijn. Posities kunnen op verschillende manieren gelabeld zijn — herken alle varianten:

- CH (cadran haut, dial up, DU, "wijzerplaat boven", positie 1)
- FH (cadran bas, dial down, DD, "wijzerplaat onder", positie 2)
- 12H (pendant up, PU, kroon boven, positie 3)
- 6H (pendant down, PD, kroon onder, positie 4)
- 9H (pendant left, PL, kroon links, positie 5)
- 3H (pendant right, PR, kroon rechts, positie 6)

Per positie:
- rate: gangafwijking in seconden per dag (s/d). Kan negatief zijn (bv. -3.2 of +5.7).
- amplitude: in graden (°). Typisch 200-330.
- beat_error: in milliseconden (ms). Typisch 0.0-2.0, meestal 1 decimaal.

Geef ALLEEN een JSON-object terug, exact in dit formaat:
{
  "ch":  { "rate": <getal of null>, "amplitude": <getal of null>, "beat_error": <getal of null> },
  "fh":  { ... },
  "h12": { ... },
  "h6":  { ... },
  "h9":  { ... },
  "h3":  { ... }
}

Regels:
- Als een positie niet zichtbaar is in de foto: zet de hele waarde op null (bv. "h12": null).
- Als een specifieke waarde onleesbaar is binnen een wel-zichtbare positie: zet díe waarde op null.
- Geen tekst eromheen, geen markdown, alleen JSON.`;

function singlePositionPrompt(position: string) {
  return `Je analyseert een foto van een mechanische horloge timegrapher (bv. Witschi, Weishi, Microset) waarop één meetpositie zichtbaar is. De positie is ${position.toUpperCase()}.

Lees deze drie waarden af:
- rate: gangafwijking in seconden per dag (s/d). Kan negatief zijn.
- amplitude: in graden (°). Typisch 200-330.
- beat_error: in milliseconden (ms). Typisch 0.0-2.0, meestal 1 decimaal.

Geef ALLEEN een JSON-object terug:
{ "rate": <getal of null>, "amplitude": <getal of null>, "beat_error": <getal of null> }

Als een waarde onleesbaar is, zet 'm op null. Geen tekst eromheen, geen markdown.`;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Strip eventuele markdown-fences
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  // Pak de eerste {...} substring
  const match = candidate.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Geen JSON-object gevonden in modelrespons");
  }
  return JSON.parse(match[0]);
}

// ──────────────────────────────────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY ontbreekt op de server." },
      { status: 500 },
    );
  }

  let body: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    body = requestSchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Ongeldige request body.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userText =
    body.mode === "all"
      ? ALL_POSITIONS_PROMPT
      : singlePositionPrompt(body.position);

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: body.photo_url },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    // Pak de text-blokken
    const textOut = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!textOut) {
      return NextResponse.json(
        { error: "Lege respons van het model." },
        { status: 502 },
      );
    }

    let raw: unknown;
    try {
      raw = extractJsonObject(textOut);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Modelrespons kon niet als JSON geparsed worden.",
          detail: err instanceof Error ? err.message : String(err),
          raw_text: textOut,
        },
        { status: 502 },
      );
    }

    if (body.mode === "all") {
      const parsed = allPositionsSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Modelrespons paste niet op het verwachte schema.",
            detail: parsed.error.message,
            raw,
          },
          { status: 502 },
        );
      }
      return NextResponse.json({
        mode: "all",
        positions: parsed.data,
      });
    }

    const parsed = singlePositionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Modelrespons paste niet op het verwachte schema.",
          detail: parsed.error.message,
          raw,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      mode: "single",
      position: body.position,
      values: parsed.data,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API fout: ${err.message}`, status: err.status },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onbekende fout" },
      { status: 500 },
    );
  }
}
