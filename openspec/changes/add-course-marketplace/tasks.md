## 1. Workspace setup

- [x] 1.1 Create npm workspaces (`apps/web`, `apps/api`, `packages/shared`), root Biome config, and verify `npm install` and `npx biome check` succeed
- [x] 1.2 Scaffold Express API with a health route and verify `GET /health` returns 200 in a test
- [x] 1.3 Scaffold Next.js web app and verify it builds and renders a home page
- [x] 1.4 Add Prisma with Postgres connection, an initial empty migration, and verify `prisma migrate dev` runs

## 2. Shared package

- [x] 2.1 Add Zod block schemas for title, text, image, video, URL, voice channel, Zoom and verify unit tests accept valid and reject malformed configs
- [x] 2.2 Add coupon-value parser (`30%` percent, `30` fixed) and verify tests for 0%, 150%, negatives and non-numeric text
- [x] 2.3 Add plan price formula (base x months x (1 - discount)) and verify tests (R$100, 12 months, 20% = R$960)

## 3. Authentication and roles

- [x] 3.1 Add User and token models; implement sign-up with unique email and username and verify duplicate rejection tests
- [x] 3.2 Implement sign-in/out with slow salted hashing, session cookie and rate limiting, and verify wrong-password and lockout tests
- [x] 3.3 Implement email verification and password reset via expiring tokens (Resend provider behind an email interface) and verify expired-link tests
- [x] 3.4 Implement profile edit (username, bio, password) and verify creator bio shows on course data
- [x] 3.5 Implement role guards and course/data ownership checks and verify tests for creator-vs-other-creator and user-vs-user access

## 4. Courses, plans and coupons

- [x] 4.1 Add Course, Plan and Coupon models and course CRUD with ownership, and verify creators cannot edit others' courses
- [x] 4.2 Implement plans (1-12 months, lifetime, one per length, discount default 0) and verify validation tests
- [x] 4.3 Implement coupons (create, cancel, expiry, per-course active-code uniqueness) and verify duplicate, reuse-after-cancel and expired tests
- [x] 4.4 Implement server-side price computation with a single coupon, minimum-charge clamp, and verify tests for fixed coupon above price

## 5. Pages and blocks

- [x] 5.1 Add Page and Block models; implement page tree CRUD with reorder, nesting and slug uniqueness, and verify tests
- [x] 5.2 Implement block CRUD validated with shared Zod schemas and reordering, and verify invalid block rejection
- [x] 5.3 Implement selling page and members-area read endpoints, gated by `hasAccess`, and verify expired/anonymous denial tests

## 6. Video hosting

- [x] 6.1 Define the `VideoHost` interface and Bunny Stream implementation (create upload, status webhook, signed expiring playback URL) and verify with mocked-host tests
- [x] 6.2 Wire video blocks to uploads and gated playback and verify no link is issued without access

## 7. Payments, subscriptions and renewals

- [ ] 7.1 Run an Asaas sandbox spike to confirm one-off charges with full routing to a sub-account, Pix/boleto/card, refunds and the minimum charge, and record findings in the change
- [x] 7.2 Define the `PaymentProvider` interface and Asaas implementation (sub-account onboarding, create charge, refund, webhook parsing) with mocked tests
- [x] 7.3 Implement creator payout onboarding and the sellable-only-when-enabled rule and verify purchase blocking test
- [x] 7.4 Add Subscription and Charge models and `hasAccess`; implement purchase from a confirmed payment and verify `expiresAt` tests (recurring, lifetime, expired)
- [x] 7.5 Implement idempotent Asaas webhook handling in one transaction and verify duplicate-event test
- [x] 7.6 Implement user-initiated renewal and the extension rule (early vs after expiry) and verify both tests
- [x] 7.7 Implement the `node-cron` job creating a renewal charge 7 days before expiry with one pending charge per cycle, emailing the link, and verify duplicate prevention test
- [x] 7.8 Implement subscription self-service (list, expiry, payment history, cancel renewals) and expiry warnings, and verify tests

## 8. Refunds

- [x] 8.1 Implement refund endpoint (creator own sales, admin any) calling the provider and verify authorization tests
- [x] 8.2 Implement refund webhook rolling back `expiresAt` by the charge's months (lifetime removes subscription), idempotently, and verify the three spec scenarios

## 9. Progress

- [x] 9.1 Implement page completion toggle and course percentage and verify tests including pages added later
- [x] 9.2 Enforce progress visibility (user, own-course creator, admin) and verify rejection for other creators; verify progress survives expiry and refund

## 10. Catalog, dashboard and admin

- [x] 10.1 Implement public catalog with starting price and admin-only featured flag and verify draft hiding and creator-cannot-feature tests
- [x] 10.2 Implement creator dashboard endpoints (courses, income with refunds, subscribers, subscriber progress, coupons, payout status) and verify other-creator isolation
- [x] 10.3 Implement admin endpoints (courses, creators, users, suspend/restore, role change, unpublish keeping subscriber access) and verify tests

## 11. Web app

- [x] 11.1 Build typed API client and auth screens (sign-up, sign-in, verify, reset) and verify the flow end to end
- [ ] 11.2 Build catalog and selling page with plan picker, coupon input and checkout, and verify a sandbox purchase
- [ ] 11.3 Build the curso.dev-style members area (sidebar tree, content, prev/next, mark complete, video player) and verify navigation and gating manually
- [ ] 11.4 Build the creator dashboard and block/page editor and verify creating a course, plans, pages and a coupon
- [ ] 11.5 Build the account area (subscriptions, renew, cancel, expiry warning) and admin screens and verify manually

## 12. Launch readiness

- [ ] 12.1 Add an end-to-end sandbox test: sign up, buy, access, renew, refund and verify access ends
- [ ] 12.2 Document the deploy (web, API, Postgres, shared parent domain, env vars, webhooks) and verify a clean staging deploy

## 13. Asaas follow-ups (from the 7.1 spike)

- [ ] 13.1 Confirm the webhook payload against the sandbox (event names, event id, `payment.netValue` used for "received after provider costs") and adjust `AsaasPaymentProvider.parseWebhook` if it differs
- [ ] 13.2 Confirm sub-account creation fields and the `/myAccount/status` `general: APPROVED` payout-enabled signal, once sub-accounts are enabled on the account
- [ ] 13.3 Handle boleto, which the Asaas API cannot refund: block boleto at checkout or document a manual refund flow, and update the refunds spec to match

## 14. Gaps found after implementation

- [x] 14.1 Expire unpaid charges past `dueAt` (status `expired`) so a new renewal cycle can start, still honoring a late payment, and verify with tests for reuse, the renewal job and late confirmation
- [ ] 14.2 Let a creator update or resubmit payout details after onboarding (continue/update per the creator-dashboard spec) and verify a rejected account can be corrected
- [ ] 14.3 Add the admin web screens for courses, creators and unpublish (the API endpoints exist) and verify manually
- [ ] 14.4 Decide whether publishing requires payouts enabled (creator-dashboard "Publish" scenario) and enforce or reword the spec
- [ ] 14.5 Harden payments: encrypt the stored sub-account API key, compare the webhook token in constant time, rate-limit purchase and renew
- [ ] 14.6 Add tests for the new web screens (checkout, panel, subscriptions) beyond type-check and build
