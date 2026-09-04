# TECH CITY TECHNOLOGY — Customer & Service Management System

**Computer Sales • Service • CCTV • Networking**

A production-ready customer and service management application for a computer/CCTV
service business. It maintains customer records, tracks every service performed,
generates professional PDF service reports, invoices and receipts, tracks payments
and warranties, and reminds you when the next service is due.

Everything below is implemented and tested — there are no placeholder buttons.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [How to run locally](#2-how-to-run-locally)
3. [How to build for production](#3-how-to-build-for-production)
4. [How to deploy](#4-how-to-deploy)
5. [Database setup](#5-database-setup)
6. [Environment variables](#6-environment-variables)
7. [How to back up your data](#7-how-to-back-up-your-data)
8. [Project structure](#8-project-structure)
9. [Implemented features](#9-implemented-features)
10. [Daily workflow](#10-daily-workflow)
11. [Testing](#11-testing)
12. [Things that need external API configuration](#12-things-that-need-external-api-configuration)
13. [Optional: switching to Supabase](#13-optional-switching-to-supabase)
14. [Troubleshooting](#14-troubleshooting)

---

> **Deploying or setting up for the first time?**
> See **[DEPLOYMENT.md](DEPLOYMENT.md)** for step-by-step instructions on running
> the app after extracting the zip, deploying to Vercel, and the current status of
> Supabase integration.

## 1. Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. That's it — no database server, no API keys, no signup.

To explore with sample data: **Settings → Backup & Export → Load demo data**
(10 customers, 20 services, 5 equipment records, mixed paid/pending payments).
Remove it any time with **Remove demo data** — it never touches real records.

### Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | React 19 + TypeScript | Type-safe, familiar, maintainable |
| Build | Vite 8 | Instant dev server, fast production builds |
| Styling | Tailwind CSS v4 | No CSS files to hunt through |
| Icons | lucide-react | One consistent icon set |
| Routing | react-router-dom (HashRouter) | Works on any static host, no rewrite rules |
| Database | Dexie (IndexedDB) | Real relational tables, offline, zero setup |
| PDF | jsPDF + jspdf-autotable | Reliable, offline, print-ready A4 output |
| Tests | Playwright | Real browser end-to-end verification |

Deliberately **not** used: state-management libraries, component frameworks with
heavy runtime costs, chart libraries, AI/chatbot features, or anything else the
business does not need.

---

## 2. How to run locally

**Requirements:** Node.js 20 or newer.

```bash
git clone <your-repo-url>
cd techcity
npm install
cp .env.example .env      # optional — the app runs fine without it
npm run dev               # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run oxlint |
| `npm run test:setup` | Download the Chromium test browser (run once before testing) |
| `npm test` | Run the full Playwright suite (starts the dev server automatically) |
| `npm run test:prod` | Build, serve `dist/` and smoke-test the production bundle |
| `npm run test:all` | Both of the above |
| `npm run typecheck` | Type-check without building |

---

## 3. How to build for production

```bash
npm run build
```

This runs `tsc -b` (fails on any type error) and outputs a static site to `dist/`:

```
dist/index.html
dist/assets/index-*.css       ~43 kB   (8 kB gzipped)
dist/assets/index-*.js        ~586 kB  (172 kB gzipped)  app
dist/assets/documents-*.js    ~439 kB  (143 kB gzipped)  PDF engine, loaded on demand
```

The PDF engine is code-split, so it only downloads the first time someone
generates a report. Preview the real build with:

```bash
npm run preview     # http://localhost:4173
```

---

## 4. How to deploy

`dist/` is a plain static folder — host it anywhere. Because the app uses
`HashRouter`, **no server rewrite rules are needed**.

**Netlify**

```bash
npm run build
npx netlify deploy --prod --dir=dist
```
(or connect the repo: build command `npm run build`, publish directory `dist`)

**Vercel**

```bash
npm run build
npx vercel --prod
```
Framework preset: Vite. Output directory: `dist`.

**GitHub Pages**

```bash
npm run build
npx gh-pages -d dist
```

**Your own server (nginx/Apache)** — copy `dist/` into the web root. Nothing else.

**Offline / single computer** — run `npm run build`, copy `dist/` to the shop PC
and open `index.html` directly, or serve it with `npx serve dist`.

> **Important:** data lives in the browser profile of the machine that uses the app.
> Deploying a new version never deletes it, but a different browser or a
> "clear browsing data" wipe will. Keep backups (section 7).

---

## 5. Database setup

### Default: nothing to set up

The app ships with a real relational database that runs inside the browser
(IndexedDB, via Dexie) — defined in [`src/lib/db.ts`](src/lib/db.ts). Tables are
created automatically on first launch.

```
customers ──┬── services ──┬── service_parts
            │              └── payments
            ├── equipment
            └── reminders
settings, users, counters
```

Service history is never stored as a text blob: each service is its own row
linked to a customer by `customerId`, each part and each payment is its own row
linked to a service. A customer can have unlimited services.

Data **persists across refreshes, restarts and reboots**, and the app works with
no internet connection.

### Optional: PostgreSQL / Supabase

A complete, equivalent SQL schema — with constraints, indexes, auto-calculating
triggers, Row Level Security policies and reporting views — is provided in
[`supabase/schema.sql`](supabase/schema.sql). See section 13.

---

## 6. Environment variables

Copy `.env.example` to `.env`. **Every variable is optional** — the app runs with
none of them.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_ENABLE_DEMO_DATA` | No | Set `true` to allow loading the sample dataset in a production build. Demo data is available in `npm run dev` automatically and never appears on its own. |
| `VITE_SUPABASE_URL` | No | Only if you migrate to Supabase |
| `VITE_SUPABASE_ANON_KEY` | No | Only if you migrate to Supabase (safe to expose — protected by RLS) |
| `VITE_WHATSAPP_PHONE_NUMBER_ID` | No | Only for the paid WhatsApp Business API (see section 12) |
| `VITE_WHATSAPP_TEMPLATE_NAME` | No | Only for the paid WhatsApp Business API |

Rules the codebase follows:

- No API keys are hardcoded anywhere.
- `.env` is git-ignored; only `.env.example` is committed.
- Secret tokens (e.g. a WhatsApp access token) must live on a server, never in `VITE_*`.

---

## 7. How to back up your data

Customer service records are your business. **Settings → Backup & Export** provides:

| Action | Output | Use it for |
| --- | --- | --- |
| **Download Full Backup (JSON)** | Every table, exactly as stored | Weekly safety copy — restores perfectly |
| **Restore from Backup** | — | Move to a new computer, or recover after a wipe |
| **Export Customers** | CSV | Excel / Google Sheets / mail merge |
| **Export Service Records** | CSV | Accounting, GST filing, analysis |
| **Export Payments** | CSV | Cash-flow reconciliation |
| **Export Equipment** | CSV | AMC and warranty planning |

**Recommended routine:** download a full backup every Friday and keep it on a pen
drive or in cloud storage. To move to a new PC: export on the old machine, open
the app on the new one, then **Restore from Backup**.

CSV files include a UTF-8 BOM, so ₹ and Tamil text open correctly in Excel.

---

## 8. Project structure

```
techcity/
├── index.html                     App shell, fonts, meta tags
├── vite.config.ts                 Vite + Tailwind + "@/" path alias
├── playwright.config.ts           E2E config (dev server, port 5173)
├── playwright.prod.config.ts      E2E config (built bundle, port 4173)
├── .env.example                   Documented environment variables
├── DEPLOYMENT.md                  Setup, Vercel deployment, Supabase status
├── vercel.json                    Vercel build configuration
├── supabase/
│   └── schema.sql                 PostgreSQL schema + RLS policies + triggers
├── public/
│   └── logo.svg                   Favicon / default brand mark
├── tests/                         Playwright end-to-end tests
│   ├── e2e.spec.ts                The 10-step specification checklist
│   ├── edit.spec.ts               Editing, settings→PDF, delete safety, empty states
│   ├── extra.spec.ts              Performance, backup, auth, WhatsApp
│   ├── migration.spec.ts          v1 → v2 database upgrade is non-destructive
│   ├── prod.spec.ts               Smoke test of the built production bundle
│   └── responsive.spec.ts         8 breakpoints, overflow + touch targets
└── src/
    ├── main.tsx                   React entry point
    ├── App.tsx                    Routes, providers, DB bootstrap
    ├── index.css                  Design tokens + component classes
    │
    ├── types/index.ts             All domain types in one place
    │
    ├── lib/
    │   ├── db.ts                  Dexie schema, unique-code generator, settings
    │   └── auth.tsx               Passcode lock (SHA-256, never plain text)
    │
    ├── services/                  Data access — all business rules live here
    │   ├── customers.ts           CRUD, duplicate detection, search, stats
    │   ├── services.ts            CRUD, total/balance maths, payments, reminders
    │   ├── equipment.ts           CRUD + warranty expiry calculation
    │   ├── reminders.ts           CRUD + due-date bucketing
    │   ├── backup.ts              JSON backup/restore, CSV exports, wipe
    │   └── seed.ts                Development-only sample dataset
    │
    ├── pdf/
    │   ├── documents.ts           Service Report / Invoice / Receipt generator
    │   └── share.ts               WhatsApp, Web Share, print, clipboard
    │
    ├── hooks/useData.ts           Live IndexedDB queries (auto re-render)
    │
    ├── utils/
    │   ├── format.ts              Money, dates, warranty maths, phone helpers
    │   ├── validation.ts          Form validation rules
    │   └── csv.ts                 CSV building + file download helpers
    │
    ├── layouts/AppLayout.tsx      Desktop sidebar + mobile bottom nav & drawer
    │
    ├── components/
    │   ├── ui/                    Modal, ConfirmDialog, Toast, Field, Badges,
    │   │                          States (empty/loading/error), Pagination
    │   ├── customers/             CustomerFormModal, ServiceTimeline
    │   ├── services/              CustomerPicker, PartsEditor, PaymentModal,
    │   │                          DocumentActions, ServiceFilters
    │   ├── equipment/             EquipmentFormModal
    │   ├── GlobalSearch.tsx       Ctrl+K search across customers & services
    │   ├── PageHeader.tsx         StatCard.tsx  BrandMark.tsx
    │   ├── LockScreen.tsx         ErrorBoundary.tsx
    │
    └── pages/                     One file per screen
        ├── DashboardPage.tsx      Live statistics, recent services, reminders
        ├── CustomersPage.tsx      Searchable, sortable, paginated list
        ├── CustomerDetailPage.tsx Profile, summary, history, timeline, equipment
        ├── ServicesPage.tsx       Filterable service list
        ├── ServiceFormPage.tsx    New/edit service entry
        ├── ServiceDetailPage.tsx  Full record, status, payments, documents
        ├── ReportsPage.tsx        Report history + view/edit/PDF/print/share/delete
        ├── PaymentsPage.tsx       Pending balances + transaction ledger
        ├── RemindersPage.tsx      Overdue / today / week / month buckets
        ├── EquipmentPage.tsx      Installed equipment + warranty tracking
        ├── SettingsPage.tsx       Business, PDF, defaults, security, backup
        └── NotFoundPage.tsx
```

**Key files to know**

| File | Why it matters |
| --- | --- |
| `src/lib/db.ts` | Database schema + the `nextCode()` function that guarantees `TC-CUS-00001` style IDs never duplicate (transactional, with a collision re-check) |
| `src/services/services.ts` | `computeTotals()` — the single source of truth for Total, Balance and Payment Status |
| `src/pdf/documents.ts` | The entire PDF layout — edit here to change how reports look |
| `src/index.css` | Colours, spacing and button/input styles for the whole app |
| `src/types/index.ts` | Change a field here and TypeScript shows every place to update |

---

## 9. Implemented features

### Dashboard
- Total Customers, Services (per selected range), Pending Services, Upcoming
  Maintenance, Warranty Expiring Soon, Revenue, Pending Payments, Services This Month
- **All figures are computed from the database — no hardcoded numbers**
- Date-range selector: This month / Last 30 days / Last 90 days / This year / All time
- Recent Services table (customer, service, date, amount, status)
- Upcoming Maintenance with customer name, service, due date and phone number
- Reminders due within 7 days
- Quick Actions: Add Customer, New Service, Generate Report, Search Customer

### Customers
- **Multiple contacts per customer** — add as many people as you need (owner, manager, accountant…), each with their name, phone and role. The first contact is the primary one.
- Fields: Customer ID, Contacts, Phone, Alternate Phone, Email, **GST Number**, Address, City, Pincode, **Equipment Password** (masked, reveal with the eye icon), Notes, Date Added
- **Download full customer history** as a professional PDF — one button on the profile page
- **Monthly report** — pick any month and see every service for that customer with totals
- Auto-generated non-duplicating IDs: `TC-CUS-00001`, `TC-CUS-00002`, …
- Duplicate phone-number detection (checks both phone fields)
- Search by name, phone, customer ID, email or city — instant, in-memory
- Sort by recent / name / spend / service count, with pagination
- Profile shows Customer Information, Service Summary (total services, total spent,
  amount paid, outstanding, last service, next service) and complete service history
- **Visual service timeline** grouped by year — click any entry to open the full report
- Per-customer equipment and reminders tabs
- One-tap Call and WhatsApp buttons
- Delete cascades to services, parts, payments, equipment and reminders (with confirmation)

### Services
- All specified fields: Service ID, Date, Type, Product, Brand, Model, Serial Number,
  Complaint, Diagnosis, Work Performed, Parts Replaced, Technician, Service Charge,
  Parts Cost, Discount, Total, Payment Status, Payment Method, Warranty Period,
  Warranty Expiry, Next Service Date, Notes
- Auto-generated IDs: `TC-SRV-00001`, …
- **Automatic maths:** `Total = Service Charge + Parts Cost − Discount` (+ tax if GST enabled),
  `Balance = Total − Amount Paid`, and Payment Status derived automatically
- Itemised parts list (name / qty / rate) stored as proper `service_parts` rows;
  the parts total auto-fills Parts Cost
- 20 predefined service types **plus custom types** (editable in Settings) — now includes **AMC Site Visit, RMA, Installation, Monitoring Service**
- 8 statuses with distinct colour coding: Received, Diagnosis, In Progress,
  Waiting for Parts, Ready, Delivered, Completed, Cancelled
- Warranty expiry auto-calculated from text like "1 Year", "6 Months", "15 Days"
- Setting a next service date or warranty automatically creates reminders
- Inline customer search + "create new customer" without leaving the form
- Filters: text search, status, payment status, service type, date from/to

### Service Reports, Invoices & Receipts (PDF)
- Three professional A4 document types: **Service Report**, **Tax Invoice**, **Payment Receipt**
- Header with logo (uploaded or built-in placeholder), business name, tagline,
  full contact details, GSTIN (if enabled), document number, date and status
- Customer details, service details, complaint/diagnosis/work performed
- Itemised parts & charges table
- Financial summary: service charge, parts, discount, tax, total, paid, balance
- PAID / PARTIALLY PAID / PENDING stamp and payment method
- Payment history table for partially paid services
- Warranty period, warranty expiry and next service date
- Terms & conditions (fully editable), signature lines, page numbers
- Footer: "Thank you for choosing TECH CITY TECHNOLOGY" (editable)
- Actions everywhere: **View · Download PDF · Print · Share · WhatsApp**
- After saving a service: a success panel with the Service ID and all document actions

### Payments
- Statuses: Paid, Partially Paid, Pending. Methods: Cash, UPI, Bank Transfer, Card, Other
- Partial payments stored as individual transactions; balance recalculates automatically
- Record or delete a payment from the service page or the Payments page
- Payments page: outstanding total, collected this month, total collected,
  pending-balance list with a **Collect** button, and a full transaction ledger

### Reminders
- Auto-created for next service dates and warranty expiries; manual reminders too
- Grouped into **Overdue / Due Today / Due This Week / Due This Month / Later**
- Filter by type, show/hide completed, mark done or reopen, delete
- One-tap WhatsApp reminder with a pre-filled message
- Surfaced on the dashboard

### Products / Equipment
- Fields: Product ID, Customer, Product Type, Brand, Model, Serial Number,
  Installation Date, Warranty, Warranty Expiry, Location, Status, Notes
- Auto IDs `TC-EQP-00001`; a customer can have unlimited equipment items
- Warranty countdown ("42 days left" / "Expired"), search and status filter

### Settings
- **Business:** name, tagline, address, phone, alternate phone, email, website,
  currency symbol, logo upload, GST toggle + GST number + default tax rate
  (**tax is never applied unless you enable it**)
- **PDF & Invoice:** invoice number prefix, footer text, terms & conditions
- **Service Defaults:** default warranty period, default technician, editable service-type list
- **Security:** optional passcode lock (SHA-256 hash, never plain text)
- **Backup & Export:** full JSON backup, restore, four CSV exports, demo data
  load/remove, and a confirmed "delete all data" danger zone

### Everything else
- Global search (Ctrl+K or `/`) across customers and services — typing a phone
  number shows the customer with their service count and total spend
- Toast notifications, confirmation dialogs, loading skeletons, empty states, error states
- Error boundary so a crash never shows a blank screen
- Validation: required name/phone/date/type/complaint, phone format, email format,
  6-digit pincode, no negative amounts, discount ≤ (service + parts),
  amount paid ≤ total, duplicate phone detection
- Pagination everywhere (20 rows/page) — **verified fast with 2,000 service records**
- Genuinely responsive: desktop sidebar, mobile bottom nav + drawer, card layouts
  instead of shrunken tables, 16px inputs to stop iOS zoom, safe-area padding

---

## 10. Daily workflow

Recording a walk-in customer takes well under two minutes:

```
Customer arrives
   → Ctrl+K, type their phone number
       → Found?    click the result
       → Not found? New Service → "Create new customer" (name + phone is enough)
   → Enter the complaint
   → Set service type (dropdown, or type your own)
   → Add parts, service charge and discount   → total calculates itself
   → Enter amount paid                        → balance calculates itself
   → Set warranty ("1 Year") and next service date  → reminders created automatically
   → "Save & mark completed"
   → Download PDF / Print / WhatsApp the customer copy
   → Saved permanently in the customer's history
```

---

## 11. Testing

The application was tested in a real Chromium browser, not by inspection.

**First time only** — download the browser Playwright drives (~650 MB, installed to
your user folder rather than the project, which is why it isn't in the zip):

```bash
npm run test:setup
```

After that, one command runs everything — Playwright starts the servers itself:

```bash
npm run test:all     # dev-server suite + production-bundle smoke test
```

Or individually:

```bash
npm test             # 15 suites against the dev server
npm run test:prod    # builds dist/, serves it, and verifies the real bundle
```

### `tests/e2e.spec.ts` — the specification's 10-step checklist

```
✓ Test 1: customer created with auto ID TC-CUS-00001
✓ Test 2: totals auto-calculated — Total ₹1,400, Balance ₹400
✓ Test 3: service completed with ID TC-SRV-00001
✓ Test 4: PDF generated (ServiceReport-TC-SRV-00001-Ravi-Kumar.pdf, 8170 bytes)
✓ Test 4b: PDF contains all customer and service information
✓ Test 5: data persisted after browser refresh
✓ Test 6: search by 9876543210 finds Ravi Kumar with service count + total
✓ Test 7: service appears in customer history with correct amounts
✓ Test 7b: timeline renders
✓ Test 8: all service details present
✓ Payment recorded — balance cleared, status now Paid
✓ Test 9: invoice PDF regenerated
✓ Customer update works
✓ Duplicate phone number validation works
✓ Field validation works (name, phone format, email)
✓ Equipment create works
✓ Reminder create + complete works
✓ Customer delete with confirmation + cascade works
✓ Dashboard shows 10 customers (real count)
✓ Payments page lists 7 pending payment(s)
✓ Service filters work
✓ Report search by service ID works
✓ Reminder buckets rendered: Overdue, Due Today, Due This Week, Due This Month, Later
✓ CSV export works and contains data
✓ Mobile: no horizontal overflow / search / service form / customer cards
```

The PDF assertions inflate the real PDF content streams and check that the
customer name, phone, service ID, device, serial number, technician and the exact
amounts (1,400.00 and 400.00) are present in the generated file.

### `tests/edit.spec.ts` — editing, settings→PDF, delete safety, empty states

```
✓ Service created: 2 parts, parts cost auto-filled to ₹8,400, total ₹11,000
✓ Edit form correctly hydrated with existing values and parts
✓ Editing parts recalculates parts cost and total live
✓ Saved edit persisted: part removed, qty updated, balance recalculated to ₹600
✓ Edited service persists after refresh
✓ Business settings saved with GST enabled at 18%
✓ GST toggle adds an 18% tax line: ₹1,000 → ₹1,180
✓ PDF reflects saved address, phone, email, GSTIN, custom terms, tax line and footer
✓ Cancelling the delete confirmation keeps all 20 records
✓ Confirming the delete removes exactly one report (20 → 19)
✓ All six empty states render with helpful guidance
✓ Dashboard shows 0 (real data), not placeholder numbers
```

### `tests/migration.spec.ts` — upgrading an existing installation

Writes a real schema-v1 database (as an existing shop would have), reloads the
app, and proves the upgrade is non-destructive:

```
✓ Wrote a v1 database with 3 parts and no "position" column
✓ Legacy customer survived the upgrade
✓ All 3 parts preserved in entry order: Zulu Camera → Alpha Cable → Mike Adapter
✓ Database upgraded to v2 and positions were backfilled 0,1,2
✓ Editing an upgraded record loads its parts in the right order
```

### `tests/extra.spec.ts` — performance, backup, security, sharing

```
Inserted → 200 customers, 2000 services
  Dashboard rendered in 430ms with 2000 services
  Services  rendered in 411ms
  Customers rendered in 410ms
  Payments  rendered in 406ms
✓ Pagination limits the table to 20 rows per page
✓ Search over 2000 records resolved in 540ms
✓ Backup exported: 10 customers, 20 services, 28 parts, 16 payments
✓ Wipe all data works
✓ Restore from backup works — data is back
✓ Passcode enabled / wrong passcode rejected / correct passcode unlocks / removal works
✓ WhatsApp deep link contains the pre-filled service message
```

### `tests/responsive.spec.ts` — layout integrity

Checks all 9 pages at **360, 390, 414, 768, 1024, 1280, 1440 and 1920 px** for
horizontal overflow, elements escaping the viewport and console errors, plus
mobile nav touch-target sizes. All pass.

Every test run also asserts that **zero console/page errors** occurred.

### `tests/prod.spec.ts` — the real production bundle

Runs against the built `dist/`, not the dev server. `npm run test:prod` builds
the app and starts the preview server automatically:

```
✓ Production bundle boots
✓ Sample data cannot appear in a production build
✓ Customer + service created on the production bundle
✓ Lazy-loaded PDF chunk works in production (7,040 bytes)
✓ Deep links + refresh work on a static host (HashRouter)
✓ Zero console errors in production
```

**Total: 16 test suites, all passing.**

### Bugs found and fixed by these tests

Each of these was a genuine defect caught by the suite, not a hypothetical:

| Bug | Impact | Fix |
| --- | --- | --- |
| `useSettings()` returned a new object every render | Infinite render loop crashed the service form | Memoised the hook |
| Desktop and mobile search each rendered their own dialog | Ctrl+K opened two overlapping search modals | Single provider-owned dialog |
| Form labels had no `htmlFor`/`id` pairing | Labels didn't focus inputs; unusable with a screen reader | Auto-generated ids via `useId` |
| Settings tab strip overflowed at 360–414px | Horizontal scrollbar on small phones | Tabs wrap instead of scrolling |
| Service parts were read back in IndexedDB key order | Line items reshuffled after editing a service | Added a `position` column (schema v2) + defensive `sortParts()` |
| Forms applied built-in defaults before settings loaded | Saved GST rate / default warranty were silently ignored | `useSettingsWithStatus()` waits for the stored row |
| Writes inside the Dexie upgrade transaction didn't persist | Old installs kept unordered parts after upgrading | Backfill runs in a normal transaction at startup, and reads fall back to `createdAt` |

---

## 12. Things that need external API configuration

Only one item, and the app does **not** pretend otherwise:

### WhatsApp — automatic PDF sending

Sending a PDF to a customer automatically requires the **paid WhatsApp Business
Cloud API** from Meta: a verified business, an approved message template, a
publicly reachable media URL for the PDF, and a server to hold the access token.
That is **not configured here**, and the app never claims it is.

**What is implemented instead (and fully working):**

1. **WhatsApp button** → opens WhatsApp (app or web) with a pre-filled message:

   ```
   Hello Ravi,

   Thank you for choosing TECH CITY TECHNOLOGY.

   Your service has been completed.

   Service ID: TC-SRV-00001
   Service: CCTV Maintenance
   Date: 11-Aug-2026
   Amount: ₹1,400
   Balance Due: ₹400
   Warranty valid till: 11-Nov-2026

   Your service report is attached/shared separately.

   Thank you.
   TECH CITY TECHNOLOGY
   +91 98765 43210
   ```

2. **Share button** → uses the Web Share API to share the **actual PDF file**
   through the phone's share sheet (WhatsApp, Gmail, Drive…). On browsers without
   file sharing it downloads the PDF instead and tells you so.

3. **Download PDF / Print** → always available on every device.

In practice: tap **Share** (or **Download PDF**) then **WhatsApp** — two taps to
deliver a customer copy, with no API subscription.

### Everything else needs no configuration

PDF generation, printing, search, statistics, CSV export, backup/restore and the
passcode lock are all fully local and work offline.

---

## 13. Optional: multi-device cloud sync (Supabase)

The default local database is the right choice for a single shop computer. Turn on
cloud sync when the owner wants the **same live data on the phone AND the computer**
(e.g. add a customer from either device and see it on both).

The sync layer is already implemented (`src/lib/cloud.ts`, `src/services/sync.ts`):
when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set, the app shows an owner
sign-in screen and then keeps this device in sync with the cloud every 45 seconds
(and whenever the window regains focus). Without those two variables nothing
changes — the app stays 100% local and offline-capable.

### Setup

1. Create a free project at [supabase.com](https://supabase.com) (one project per
   business account is enough).
2. **SQL Editor → New query →** paste the whole
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. This creates every table,
   index, constraint, trigger, RLS policy and view (re-running is safe).
3. **Authentication → Providers →** enable **Email**.
4. In **Authentication → Users**, add the owner's email + password (this is the
   single owner account — the app is built for one person, no employees).
5. Copy **Project Settings → API** values into `.env` (and into Vercel → project →
   Settings → Environment Variables, then redeploy):
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```
6. Open the app on the first device (computer), log in with the owner email — the
   first login uploads everything already saved locally. Log in on the phone with
   the same email and the records appear there too. Changes made on either device
   reach the other within about a minute or on the next app open.

**How it works (simple, for one owner):** the local store is the working cache.
Each sync pushes local changes (including deletes, journaled per row) and then
pulls the cloud dataset, which is authoritative. The owner works on one device at
a time, so "last device to sync wins" is the intended model.

**Security notes already handled in the schema:**
- Row Level Security is enabled on every table.
- Each row carries `owner_id` and policies restrict access to `auth.uid()` — one
  business can never read another's customers.
- The anon key is safe in the browser precisely because of those policies; the
  `service_role` key must never appear in frontend code or `.env` files with a
  `VITE_` prefix.

---

## 14. Troubleshooting

**"The local database could not be opened"**
You are probably in a private/incognito window, or site data is blocked. Use a
normal window and allow storage for the site.

**My data disappeared**
Data is tied to the browser profile. Clearing "cookies and site data", using a
different browser, or a different computer means a different database. Restore
from your latest JSON backup (Settings → Backup & Export).

**Nothing happens when I click View**
Your browser blocked the pop-up. Allow pop-ups for the site, or use **Download PDF**.

**₹ appears as "Rs." in PDFs**
Intentional. jsPDF's built-in fonts are Latin-1 only, so the rupee glyph cannot be
drawn reliably; "Rs." is used in documents while the app UI shows ₹.

**I forgot the passcode**
There is no recovery by design — the hash is one-way. Clear the site's data in
browser settings (this deletes local records too) and restore from a backup.

**Print dialog doesn't open**
Some mobile browsers block programmatic printing. Download the PDF and print it
from your PDF viewer.

---

**Built for Tech City Technology** — Computer Sales • Service • CCTV • Networking
