## Context

Greenfield repo: only metadata exists. See proposal.md for motivation and specs/ for behavior. Stack: Next.js (web), Express (API), Prisma on PostgreSQL, Zod, Tailwind, Biome, in an npm-workspaces monorepo.

## Goals / Non-Goals

**Goals:**
- A web app and an API with all business rules in the API; payment and video providers behind thin interfaces.
- Platform-owned subscription state with idempotent payment and refund handling.

**Non-Goals:**
- Native apps, multi-currency, a free-form page editor, paid featured placement, card auto-billing.

## Decisions

**Monorepo layout.** `apps/web` (Next.js), `apps/api` (Express, Prisma), `packages/shared` (Zod schemas and pure functions both sides use: block configs, coupon-value parsing, plan price formula). The web app has no database access and only calls the API through a typed client. Alternative: Next.js only; rejected by the author.

**API modules.** One folder per capability under `apps/api/src/modules/` (courses, plans, coupons, pages, progress, subscriptions, renewals, refunds, catalog, dashboard, admin, auth) owning its routes, rules and queries. `providers/` holds `PaymentProvider` (Asaas), `VideoHost` (Bunny Stream) and email; `webhooks/` and `jobs/` hold the Asaas/Bunny handlers and the renewal scheduler.

**Roles as one enum on User.** A creator is a user with `role = creator` plus a `CreatorProfile` for the payout account. Username and bio live on User.

**Data model (core, Prisma):** `User`, `CreatorProfile`, `Course` (base monthly price, `published`, `featured`), `Plan` (course, months 1-12 or lifetime, `discountPercent`, lifetime price; unique per course and length), `Coupon` (course, code, type, value, `expiresAt`, `canceledAt`), `Subscription` (user, course, plan, nullable `expiresAt`, `canceledAt`), `Charge` (subscription, amount, months granted, provider id, status, `dueAt`, `refundedAt`), `Page` (course, `parentId`, `position`, `slug`), `Block` (page, `position`, `type`, `config` JSON), `PageProgress` (user, page, completedAt), auth tables (verification and reset tokens).

**Blocks as typed JSON.** One `Block` table; a Zod schema per type in `packages/shared` validates `config` on write and read. Alternative: a table per type; rejected as heavier with no query benefit.

**Subscriptions are platform-owned; Asaas handles charges only.** Every purchase and renewal is a one-off Asaas charge with split. A payment webhook extends `expiresAt`. Alternative: Asaas subscriptions; rejected because it duplicates state and needs value syncing.

**Refunds roll back access.** Each `Charge` records the months it granted. A refund webhook subtracts those months from `expiresAt` (access ends if the result is not in the future; lifetime removes the subscription). Creators refund own sales, admins any; the API calls Asaas, then reacts to the confirming webhook.

**Idempotency.** Provider event ids have a unique constraint, and the status change plus `expiresAt` update run in one Prisma transaction, so duplicate payment or refund events are no-ops.

**Renewal scheduler.** The renewal window is 7 days before `expiresAt`. A periodic job in the API finds non-canceled recurring subscriptions inside the renewal window with no pending charge, creates the charge and emails the link. A unique "one pending charge per subscription cycle" constraint prevents duplicates when the user also clicks renew.

**Providers chosen.** Email via Resend. Scheduler is `node-cron` inside the API process, which assumes a single API instance (ponytail: move to a job queue such as pg-boss before running multiple instances). There is no platform fee, so charges route full proceeds to the creator's sub-account and the platform earns nothing yet; the business model is outside this change.

**Access check in one place.** `hasAccess(user, course)` in the subscriptions module is used by pages, progress and video playback.

**Pricing computed server-side.** The API computes plan price, discount and coupon each time it creates a charge; clients never send amounts.

**Auth.** Email and username plus password, hashed with a slow salted hash, rate-limited sign-in, email verification and password reset via expiring tokens. Transport is a session cookie shared by web and API, which requires the two to share a parent domain in production (for example `app.` and `api.` under one domain).

## Risks / Trade-offs

- Asaas split and refund-with-split-reversal on one-off charges are assumed → verify in sandbox before building payments.
- Pix and boleto renewals need the user to pay each cycle, so churn is higher than card auto-billing → early platform charge and email reduce it; card tokenization could come later.
- Minimum charge on large fixed coupons is unknown → confirm with Asaas and clamp in pricing.
- Email deliverability and scheduler uptime affect renewals → managed email and a retrying scheduler.
- Two deployables plus Postgres add operational work → keep one repo and one CI pipeline.
- Consumer-law refund rights and tax invoicing may force policy changes → review with a lawyer and accountant before launch.


## Asaas sandbox spike findings (task 7.1, partial, 2026-10-27)

Verified:
- Auth with `access_token` header on `https://api-sandbox.asaas.com/v3` works; customer and one-off `billingType: "UNDEFINED"` charges (buyer picks Pix, boleto or card) are created with an `invoiceUrl`.
- **Minimum charge is R$ 5,00** for `UNDEFINED` charges (400 below it). Pricing clamps the final amount to R$ 5,00.
- A split to a nonexistent `walletId` is rejected at charge creation (`Wallet [...] inexistente`).
- **Refunds only work for credit card and Pix charges**, not boleto (400 otherwise). Boleto purchases cannot be refunded through the API; the refund flow must surface this error and the creator/admin must refund boleto sales outside the system.

Not verified (blocked):
- **Sub-accounts require a CNPJ root account.** The sandbox root account here is a CPF (pessoa física), so `POST /accounts` returns 403. Sub-account creation, `/myAccount/status` on a sub-account, full-proceeds split routing and refund-with-split-reversal remain unconfirmed. A second sandbox account (CNPJ, MEI, overall status APPROVED) still returns the same 403, so a CNPJ alone is not enough: the sub-account feature probably has to be enabled by Asaas for the account, or MEI is not eligible. Either way it is a product constraint on the platform operator.
- Webhook payload and event names (`PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`) are still taken from the docs; sandbox cannot confirm a Pix/boleto payment without a payer simulation.
