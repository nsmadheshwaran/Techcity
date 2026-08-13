# Deployment Guide — Tech City Technology

Three parts:

- **[Part A](#part-a--after-extracting-the-zip)** — what to do after extracting the zip (5 minutes)
- **[Part B](#part-b--deploy-to-vercel)** — deploy to Vercel (10 minutes)
- **[Part C](#part-c--supabase)** — Supabase: read this before you start

---

# Part A — After extracting the zip

## Step 1: Install Node.js (one time only)

Check whether you already have it. Open **PowerShell** (Windows) or **Terminal** (Mac):

```bash
node -v
```

- If you see `v20.x.x` or higher → you're set, go to Step 2.
- If you see "not recognized" or a version below 20 → download the **LTS** version
  from <https://nodejs.org>, run the installer, accept the defaults, then **close and
  reopen** your terminal.

## Step 2: Open a terminal in the project folder

Extract the zip somewhere sensible, e.g. `C:\Projects\techcity` or `~/Projects/techcity`.

**Windows:** open the `techcity` folder in File Explorer, click the address bar,
type `powershell`, press Enter.

**Mac:** right-click the `techcity` folder → Services → New Terminal at Folder.

**Any system:**

```bash
cd path/to/techcity
```

Confirm you are in the right place — this must list `package.json`:

```bash
ls        # Mac/Linux
dir       # Windows
```

## Step 3: Install dependencies

```bash
npm install
```

Takes 30–60 seconds and creates the `node_modules` folder. You only do this once
(and again whenever dependencies change).

## Step 4: Run it

```bash
npm run dev
```

You'll see:

```
➜  Local:   http://localhost:5173/
```

Open <http://localhost:5173> in Chrome or Edge. **The app is now running.**

To stop it, press `Ctrl + C` in the terminal.

## Step 4b: (Optional) Enable the automated tests

**Skip this unless you want to run the test suite** — it is not needed to use the app.

The tests drive a real browser, which Playwright downloads separately (~650 MB) into
your user folder, *not* into the project. Run this **once**:

```bash
npm run test:setup
```

Then:

```bash
npm run test:all
```

> **If you see** `Executable doesn't exist at ...chrome-headless-shell.exe`, this is
> the step you missed. Run `npm run test:setup` and try again. It is safe to re-run
> at any time — it takes under a second once the browser is present.

## Step 5: Load the sample data (optional but recommended)

In the app: **Settings → Backup & Export → Load demo data**

That gives you 10 customers and 20 services to click around in. Remove it with
**Remove demo data** when you're ready for real records — it only deletes demo
rows, never your own.

## Step 6: Enter your real business details

**Settings → Business** — set your real address, phone, email and upload your logo.
These appear on every PDF, so do this before issuing a real service report.

Then **Settings → PDF & Invoice** to adjust the terms and conditions.

---

### Quick command reference

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies (once) |
| `npm run dev` | Run the app locally at `localhost:5173` |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Preview the production build at `localhost:4173` |
| `npm run test:setup` | Download the test browser (once, only if you'll run tests) |
| `npm test` | Run the automated test suite |

---

# Part B — Deploy to Vercel

## Before you start: understand what deploying does and doesn't do

**Read this carefully — it's the most important thing on this page.**

This app stores data in **the browser's own storage (IndexedDB)**. Deploying to
Vercel puts the *application* on the internet, but **not your data**.

That means:

| | |
| --- | --- |
| ✅ | You can open the app from any device, anywhere |
| ✅ | Updates deploy automatically when you change the code |
| ❌ | The shop PC and your phone will have **completely separate customer lists** |
| ❌ | Records created on the counter PC will **not** appear on your phone |

**If you need one shared database across devices, that's exactly what Part C is
about — and it needs code that isn't written yet.**

If you only ever use **one computer**, deploying is optional. The app already runs
perfectly on that machine via `npm run dev`, or by building it once and opening
`dist/index.html`.

---

## Method 1: GitHub + Vercel (recommended)

This gives you automatic redeployment whenever you change the code.

### Step 1: Create a GitHub repository

1. Sign up / log in at <https://github.com>
2. Click the **+** (top right) → **New repository**
3. Name: `techcity` · Visibility: **Private** ← important, this is business software
4. Do **not** tick "Add a README" (you already have one)
5. Click **Create repository**

### Step 2: Push your code

In your `techcity` folder:

```bash
git init
git add .
git commit -m "Tech City Technology service management system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/techcity.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username. If it asks for a
password, use a **Personal Access Token** (GitHub → Settings → Developer settings
→ Personal access tokens), not your login password.

> The included `.gitignore` already keeps `node_modules`, `dist` and `.env` out of
> the repository automatically.

### Step 3: Import into Vercel

1. Go to <https://vercel.com> → **Sign up with GitHub**
2. Click **Add New…** → **Project**
3. Find `techcity` in the list → **Import**
4. Vercel auto-detects the settings from the included `vercel.json`:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Vite |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` |

   **Leave all of these as they are.**

5. Leave **Environment Variables** empty (the app needs none)
6. Click **Deploy**

Wait about a minute. You'll get a URL like `https://techcity.vercel.app`.

**Done.** Every future `git push` redeploys automatically.

### Step 4: Deploy your changes later

```bash
git add .
git commit -m "Describe what you changed"
git push
```

Vercel rebuilds within a minute.

---

## Method 2: Vercel CLI (no GitHub)

Faster, but no automatic redeploys.

```bash
npm install -g vercel
vercel login
vercel --prod
```

Answer the prompts:

```
Set up and deploy? …………………… Y
Which scope? ………………………………… (your account)
Link to existing project? … N
Project name? ……………………………… techcity
In which directory is your code? ./
Want to modify settings? ……… N
```

To deploy updates later, just run `vercel --prod` again.

---

## Recommended: protect the deployed app

Your customer records shouldn't be on a public URL. Two layers:

**1. In the app** — **Settings → Security → Enable Passcode Lock.**
Anyone opening the site then needs your passcode.

**2. In Vercel (better)** — Project → **Settings** → **Deployment Protection** →
enable **Vercel Authentication**. Only people logged into your Vercel account can
open the site at all. Note this is a paid feature on some plans.

I'd use both.

### Add your own domain (optional)

Vercel → Project → **Settings** → **Domains** → add `service.yourbusiness.in`,
then follow the DNS instructions shown. HTTPS is automatic and free.

---

## Vercel troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails: "command not found" | Confirm Build Command is `npm run build` |
| Blank white page | Check Output Directory is `dist`, not `build` |
| 404 on refresh | Shouldn't happen — the app uses HashRouter (`/#/customers`). If it does, confirm `vercel.json` was committed. |
| My data isn't there | Expected. Data is per-browser — see the warning above and Part C. |
| Changes not showing | Hard refresh: `Ctrl + Shift + R` |

---

# Part C — Supabase

## Read this first — an honest status

**Supabase is not currently wired into this application.**

Here is exactly what exists today and what doesn't:

| Item | Status |
| --- | --- |
| `supabase/schema.sql` — full Postgres schema, triggers, RLS policies | ✅ **Written and complete** |
| `.env.example` — documented variables | ✅ Ready |
| Domain model designed to map 1:1 onto SQL tables | ✅ Done deliberately |
| `@supabase/supabase-js` installed | ❌ Not a dependency |
| App code that reads/writes Supabase | ❌ **Does not exist** |
| Supabase login/signup screens | ❌ **Does not exist** |

The app talks to a local IndexedDB database through `src/services/*.ts`. Pointing
it at Supabase means **rewriting that data layer** — roughly 6 files, plus
replacing the passcode lock with real accounts, plus a migration path for records
already on the shop PC.

**Running the SQL schema alone will not make the app sync.** You'd have a correct,
empty database that nothing connects to. I'd rather tell you that now than let you
discover it after an afternoon of setup.

---

## Do you actually need it?

| Your situation | Recommendation |
| --- | --- |
| One computer at the shop | **Stay local.** No accounts, no monthly cost, works during internet outages, faster. Just keep weekly backups. |
| Counter PC + your phone, both needing the same live data | **You need Supabase.** Nothing else solves this. |
| Two staff entering services at once | **You need Supabase.** |
| One PC, but you want an off-site copy | **Stay local** — Settings → Download Full Backup to Google Drive weekly does this for free. |

Be honest about which row you're in. Most single-shop setups are row 1, and the
local version is genuinely the better engineering choice there — an internet
outage doesn't stop you billing a customer.

---

## What the migration involves

If you're in row 2 or 3, here's the real scope of work:

**1. Database setup (~15 min, you can do this now)**

1. Create a project at <https://supabase.com> (free tier is plenty)
2. **SQL Editor** → **New query** → paste all of `supabase/schema.sql` → **Run**
3. **Authentication → Providers** → enable **Email**
4. **Project Settings → API** → copy your Project URL and publishable/anon key

This part is safe and reversible — it just creates empty tables.

**2. Application code (this is the part that needs building)**

- Install `@supabase/supabase-js`
- Create `src/lib/supabase.ts` (the client)
- Rewrite `src/services/customers.ts`, `services.ts`, `equipment.ts`,
  `reminders.ts`, `backup.ts` to query Supabase instead of Dexie
- Replace `src/lib/auth.tsx` with real email/password auth + a login screen
- Convert the `useData` hooks from Dexie live queries to Supabase realtime
  subscriptions (so both devices update instantly)
- Move ID generation (`TC-CUS-00001`) server-side so two devices can't collide
- Write a one-time importer to push existing local records into Supabase
- Re-run the full test suite against the new backend

**3. Environment variables on Vercel**

Vercel → Project → Settings → Environment Variables:

```
VITE_SUPABASE_URL         = https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY    = sb_publishable_xxxxx
```

Then **redeploy** — Vite bakes these in at build time, so existing deployments
won't pick them up automatically.

> **Security note:** the publishable/anon key is safe in the browser *only*
> because every table in `schema.sql` has Row Level Security enabled with
> `owner_id = auth.uid()` policies. Never put the `service_role` key in any
> `VITE_*` variable — it bypasses RLS entirely.

---

## Want me to build it?

I can implement the full Supabase integration — client, auth, rewritten data
layer, realtime sync, a migration tool for your existing records, and tests
against the real backend.

To do that I'd need from you:

1. Your **Supabase Project URL**
2. Your **publishable (anon) key** — *not* the service_role key
3. Whether multiple staff need **separate logins**, or one shared business account

I'd build it on a copy so your working local version keeps running untouched
until the new one is tested and you're happy with it.

Alternatively, if you're in row 1 above, my honest recommendation is to skip
Supabase entirely and set a weekly backup reminder instead.
