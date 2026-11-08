# ARGON — storefront + admin

Next.js 15 (App Router) e‑commerce store for **ARGON**, premium stainless‑steel jewelry and eyewear in Bangladesh (BDT, COD‑first). It has a storefront, API and a Shopify‑style admin in one repo.

- **Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Prisma 6 + PostgreSQL, Zod, `jose` (signed sessions), TOTP 2FA (`otplib`), `three` (lazy hero), Vercel Blob for media.
- **Languages:** English at `/`, Bangla at `/bn/...`.
- **Region:** Vercel `sin1` + a Singapore Postgres (Supabase or Neon).

## Quick start (local)

```bash
npm install
cp .env.example .env            # fill DATABASE_URL, AUTH_SECRET, OWNER_EMAIL, OWNER_PASSWORD
npm run db:local                # optional: embedded Postgres on :5433 (no Docker needed) — leave running
npx prisma migrate deploy       # create tables
npm run db:seed                 # 27 products, zones, CMS pages, templates, roles, owner account
npm run dev                     # http://localhost:3000  ·  admin: /admin
```

With `npm run db:local`, use `DATABASE_URL=DATABASE_URL_UNPOOLED=postgresql://argon:argon@localhost:5433/argon`.

The first admin login asks for the owner email and password, then **forces TOTP 2FA setup** (scan the QR code with Google Authenticator, 1Password or Authy).

`npm run images` regenerates `public/products/*.webp`, the blur placeholders, the favicons, the maskable icon and the OG image from `assets/originals/*.png` and `public/brand/logo-mark.svg`.

## Deploy (Vercel + Supabase/Neon)

1. Create a Postgres database in **Singapore**. On Supabase, use the pooled URL (`:6543?pgbouncer=true&connection_limit=1`) for `DATABASE_URL` and the direct URL for `DATABASE_URL_UNPOOLED` (the Vercel Neon integration sets both automatically).
2. `vercel link`, then add the environment variables from `.env.example` (Production + Preview).
   - Required: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`.
   - Add a **Vercel Blob** store so product uploads work (`BLOB_READ_WRITE_TOKEN`).
3. Deploy. The `vercel-build` script runs `prisma migrate deploy` before `next build`.
4. Seed once against production: `DATABASE_URL=… DATABASE_URL_UNPOOLED=… OWNER_EMAIL=… OWNER_PASSWORD=… npm run db:seed`.
5. Cron jobs are declared in `vercel.json`:
   - Courier status sync and abandoned‑checkout reminders, every 30 minutes.
   - Low‑stock alerts and review requests, daily.

   Vercel Hobby only allows daily crons, so either use Pro or point Upstash QStash at the same URLs with `Authorization: Bearer $CRON_SECRET`.

**Backups.** Supabase and Neon both take automatic daily backups. Enable point‑in‑time recovery on your plan, or add a scheduled `pg_dump` (for example a GitHub Action) to off‑site storage.

## Payments (sandbox)

Each gateway is enabled and switched between sandbox and live in **Admin → Payments**. Secrets live only in environment variables.

| Gateway | Flow | Sandbox credentials |
|---|---|---|
| COD | Order placed immediately. Optional bKash advance for the delivery charge outside Dhaka. Optional OTP (off / always / flagged numbers). | — |
| bKash Tokenized | grant → create → redirect → callback → **execute + query server‑side** → paid | developer.bka.sh → Tokenized Checkout sandbox (username, password, app key, app secret). Test wallet `01770618575`, OTP `123456`, PIN `12121`. |
| Nagad | initialize (RSA‑encrypted and signed) → complete → redirect → **verify API** → paid | Request merchant ID and keys from Nagad (sandbox host `sandbox.mynagad.com:10080`). |
| SSLCommerz | session → gateway → browser return + **IPN (verify_sign) → validation API** → paid | Register a free sandbox store at developer.sslcommerz.com. Test card `4111 1111 1111 1111`, any future expiry, CVV `111`, OTP `111111`. |

Orders are only marked paid after server‑side verification; a client redirect alone never counts. A failed or abandoned payment leaves the order *on hold*. The thank‑you page then offers to **retry** or **switch to COD**. Stock is reserved when the order is created.

> These sandbox credentials come from the gateways' public docs and may change. The integrations are written to each gateway's documented API but have **not yet been run end‑to‑end against live sandboxes**, because that needs your merchant credentials (see the test plan).

## Couriers

Steadfast, Pathao and RedX sit behind one `CourierProvider` interface (`src/lib/couriers.ts`):

- Create a consignment ("Send to courier", per order or in bulk).
- Fetch status every 30 minutes and auto‑mark the order delivered, recording the COD collected.
- Returns raise the customer's risk score.
- "Manual" handles couriers without an API.

## Architecture notes

- **Orders** (`src/lib/orders.ts`):
  - Stock decrements atomically inside a transaction with `UPDATE … WHERE stock >= qty`, so concurrent orders can't oversell.
  - An idempotency key (unique column) means double‑clicks and retries return the same order.
  - Cancelling restocks the items.
  - Every change is appended to the order's `timeline` with the admin's name.
- **Pricing** (`src/lib/pricing.ts`):
  - Always recomputed server‑side.
  - Handles zone detection by district and area, free‑delivery threshold, percent, fixed, free‑shipping, BOGO and bundle discounts, and per‑customer limits.
- **Caching:** catalog, settings and content use `unstable_cache` tags. Admin edits call `revalidateTag`, so ISR pages update immediately.
- **Security:**
  - Zod on every input; Postgres‑backed rate limits on checkout, OTP, login, reviews and tracking.
  - HttpOnly signed cookies; admin password plus mandatory TOTP; per‑permission RBAC.
  - An audit log of every admin mutation, rich text sanitised server‑side, and HSTS and security headers.
- **Performance:**
  - Server Components by default.
  - Only the cart store, the drawer and small widgets hydrate.
  - `three` is dynamically imported after idle, on the homepage only. It is skipped on Save‑Data, 2G, low memory, reduced motion or no WebGL, and the SVG logo stays as the poster.
  - Images are WebP sources served as AVIF/WebP via `next/image` at 320/640/960/1200, with blur placeholders.
- **Reviews** come only from verified buyers: the order number and phone must match a delivered order containing that product. Every review goes through moderation. No reviews are seeded, and the section hides when there are none.

## Test plan

1. **COD in 3 taps.** Product → *Order Now* → fill the form → *Place Order*. Expect ARG‑100xx and stock −1 (Admin → Inventory log).
2. **Idempotency.** Double‑click *Place Order*, or replay the request. Expect one order.
3. **Oversell.** Set a variant's stock to 1, then place two orders at the same time. Expect exactly one to succeed.
4. **Cancel.** Admin → order → status *cancelled*. Expect stock restored and a timeline entry.
5. **Gateways.** Use the sandbox credentials above. Expect `paymentStatus = paid` only after the callback/IPN. Repeat with a cancelled payment and expect *on hold* plus the retry/COD options.
6. **Bulk.** Select 20 orders → Confirm → Send to courier → Labels 4×6 / A4 → Export CSV.
7. **Audit.** Every action above appears in Admin → Audit log.
8. **i18n.** `/bn` renders Bangla UI, product names and policies.
9. **Responsive and a11y.**
   - No horizontal scroll at 360px.
   - Keyboard‑only checkout works.
   - With `prefers-reduced-motion`, the tilt, sheen and 3D are disabled.
10. **Lighthouse (mobile)** on the production URL for `/`, `/shop/rings` and `/product/fang-ring`.

## Project map

```
prisma/            schema, migrations, seed (catalog from the brief)
src/app/[locale]/  storefront (home, shop, product, checkout, thank-you, track, account, CMS pages)
src/app/admin/     admin (login + 2FA, dashboard, orders, products, inventory, collections, customers,
                   discounts, content, reviews, analytics, marketing, shipping, payments,
                   notifications, staff & roles, audit log, settings)
src/app/api/       quote, events, reviews, subscribe, payment callbacks/IPN, cron, admin search/exports
src/lib/           orders, pricing, payments, couriers, notify (SMS/email), auth, security, reports, feeds
```
