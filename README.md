# Staudt Chronometrie — Testadministratie (schq.app)

Mobiel-first webapp om mechanische horloge-tests te administreren. Fase 1 MVP.

**Stack**: Next.js 14 · TypeScript (strict) · Tailwind · Supabase (Postgres + Storage) · Vercel.

---

## 1. Lokaal draaien (eerste keer)

```bash
cd /Users/yvostaudt/Desktop/schq-app
npm install        # alleen nodig als je deps mist
npm run dev
```

De app draait op http://localhost:3000 — maar zonder `.env.local` werkt de
database nog niet. Volg eerst stap 2.

---

## 2. Supabase opzetten — stap voor stap

### 2.1 — Account + project aanmaken

1. Ga naar **https://supabase.com** en maak een gratis account (kan met GitHub).
2. Klik **New project**:
   - **Name**: `schq` (of wat je wilt)
   - **Database password**: laat Supabase er één genereren en bewaar 'm in een
     password manager. Je hebt 'm zelden nodig.
   - **Region**: `Frankfurt (eu-central-1)` — dichtst bij NL
   - **Pricing plan**: Free
3. Wacht ~1 min tot het project klaar is.

### 2.2 — Schema uitvoeren

1. Linker zijbalk → **SQL Editor** → **+ New query**.
2. Open lokaal `supabase/migrations/0001_init.sql`, kopieer de **volledige
   inhoud** en plak in de editor.
3. Klik **Run** (rechtsonder, of ⌘+Enter). Je ziet `Success. No rows returned`.

Dit maakt drie tabellen aan (`watch_passports`, `test_sessions`,
`timegrapher_measurements`), de auto-gemiddelden trigger, RLS-policies en de
storage-bucket `measurement-photos`.

### 2.3 — API-keys ophalen

1. Linker zijbalk → **Project Settings** (tandwiel) → **API**.
2. Kopieer:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - **Project API keys → anon / public** → `eyJ...`
3. In je projectmap:
   ```bash
   cp .env.local.example .env.local
   ```
   Open `.env.local` en plak beide waardes erin:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

### 2.4 — Storage controleren

1. Linker zijbalk → **Storage**. Je ziet de bucket `measurement-photos` (door
   de SQL-migratie aangemaakt, public).
2. Geen verdere actie nodig — foto-uploads werken meteen.

### 2.5 — Anthropic API key voor AI foto-analyse

De timegrapher-meting heeft een "Analyseer foto"-knop die Claude Vision gebruikt
om R/A/B-waarden uit een foto te lezen. Dat is optioneel — zonder key werkt de
rest van de app gewoon, alleen de AI-knop geeft dan een fout.

1. Ga naar **https://console.anthropic.com** → log in (of maak een account).
2. Linker menu → **Settings → API Keys** → **Create Key** → naam bv. `schq-app`.
3. Kopieer de key (begint met `sk-ant-...`) — krijg je maar één keer te zien.
4. Voeg toe aan `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Voeg ook in Vercel toe (Settings → Environment Variables) als je deployt.

**NB**: deze key heeft geen `NEXT_PUBLIC_` prefix — hij wordt alléén server-side
gebruikt in `/api/analyze-timegrapher`, nooit naar de browser gestuurd.

### 2.6 — Restart de dev server

```bash
# stop met Ctrl+C, daarna opnieuw:
npm run dev
```

Open http://localhost:3000 en je ziet een leeg dashboard. Klik **+ Nieuwe test**
om je eerste sessie aan te maken.

---

## 3. Deployen naar Vercel + schq.app

### 3.1 — Push naar GitHub

```bash
git add -A
git commit -m "Initial Staudt testadministratie MVP"
gh repo create schq-app --private --source=. --push
```

### 3.2 — Vercel project

1. Ga naar **https://vercel.com/new** en importeer de `schq-app` repo.
2. Bij **Environment Variables** voeg toe (zelfde waardes als `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Klik **Deploy**.

### 3.3 — Custom domain `schq.app`

1. Vercel → project → **Settings → Domains** → voeg `schq.app` toe.
2. Vercel toont DNS-records. Zet die bij je domeinregistrar (waarschijnlijk
   een `A`-record naar `76.76.21.21` en/of `CNAME` voor `www`).
3. Wacht tot Vercel "Valid configuration" toont. SSL wordt automatisch
   geregeld.

---

## 4. Routes

| Pad | Doel |
|-----|------|
| `/` | Dashboard — actieve sessies + zoekveld |
| `/sessions/new` | Nieuwe testsessie starten |
| `/sessions/[id]` | Sessie-detail + meting toevoegen + afsluiten |
| `/passports/[serial]` | Horlogepaspoort + sessie-historie |

---

## 5. Wat er onder de motorkap zit

- **Auto-gemiddelden**: berekend door een Postgres `before insert/update`-trigger
  (`compute_measurement_averages`). De client toont ze ook live tijdens invoer
  voor directe feedback. Beide blijven consistent omdat ze dezelfde formule
  gebruiken (gemiddelde over de niet-NULL posities).
- **Find-or-create paspoort**: bij een nieuwe sessie zoekt de client eerst op
  serienummer. Bestaat het paspoort, dan wordt de sessie eraan gekoppeld;
  anders wordt een nieuw paspoort aangemaakt.
- **RLS in Fase 1**: alle tabellen hebben RLS aan met een `using (true)`-policy.
  Dit betekent dat de anon-key full access heeft — prima voor single-user MVP,
  maar in Fase 2 vervangen door `auth.uid()`-gebaseerde regels.
- **PWA**: `public/manifest.json` + `src/app/icon.svg`. "Add to Home Screen" op
  iOS/Android werkt zonder verdere config.

---

## 6. Wat NIET in Fase 1 zit

Bewust uit scope: duurtest, gangreserve, AI/OCR, reminders, auth-UI,
gebruikersbeheer, externe API-koppelingen.

---

## 7. Stijlgids

Alle visuele tokens komen uit `STAUDT-STIJLGIDS.md` van de hoofdwebsite. Kleuren
in `tailwind.config.ts` (navy `#062035`, zand `#f5f3f1`, taupe `#c4bcb7`),
Whitney-fonts in `public/fonts/`, basisstyling in `src/app/globals.css`.
