## Why

Traço Feito has no product yet. The goal is a course marketplace for a mostly Brazilian audience: creators sell courses with their own pricing, buyers subscribe and consume gated content, and the platform operator oversees everything. Creators must be paid automatically at the moment of sale so the platform never handles manual payouts.

## What Changes

- Three roles: **admin** (manages all courses, creators and users), **creator** (manages own courses: pages, plans, prices, discounts), **user** (buys and manages own subscriptions). A creator is also a user who can buy.
- Each course has a **selling page** and a **members area**, both built from ordered, typed **blocks** (no free-form editor):
  - **Selling page** (public): single page with marketing content and the plan picker.
  - **Members area** (gated): a tree of **several pages** (curso.dev style), each with its own slug, title and position, optionally nested. The creator composes each page from blocks: title, text, image, video, URL, voice channel link, Zoom call, and similar.
- Members area UI is **styled after curso.dev**: minimal, reading-focused, sidebar page tree plus content column, with next/previous navigation.
- **Progress tracking** per user per members page (marked complete), with a course completion percentage.
- Each course offers **plans** chosen by the creator: recurring plans whose length is any whole number of months from 1 to 12, entered by the creator, and a **lifetime** plan billed once, which grants permanent access that never expires. A course may offer any combination, including only the one-time plan (no recurring). There is no dedicated video-series block: the curso.dev-style page tree with per-page progress covers it. The creator sets a base monthly price and a **discount percentage per plan length** (defaults to 0; a longer plan has a discount only if the creator sets one, and the platform does not enforce that longer plans are cheaper). Total = base price x months x (1 - discount). Lifetime has its own fixed price.
- **Renewals are priced at the plan's current price**, like a new buyer: no price lock and no loyalty discount. The platform computes the price (and any coupon) each time it creates a charge.
- **Coupons** are created and managed by the creator per course (code, value, expiration, and a cancel action). The value is a single input: `30%` is a percentage, `30` is a fixed amount in reais; it is parsed on save and stored as type plus value, and invalid entries (percentage not in 1-100, malformed text) are rejected. A code must be unique per course among active coupons only (not canceled, not expired). Coupons do not stack: one per purchase or renewal. They apply at **first purchase and renewal**, with no restriction to subscribers. The creator shares codes however they like, for example in a text block on a members page. The platform only stores, validates and applies coupons; it sends no notifications and does no targeting.
- **The platform owns subscription state.** A subscription (user, course, plan) has an `expiresAt` date; lifetime has none. Members-area access requires `expiresAt` in the future (or lifetime). There is **no grace period**: access ends at `expiresAt`, and the user is warned in-app when access is expiring or expired.
- **Renewals** are one-off charges, started either by the user (a renew action) or by the platform (a charge created a few days before `expiresAt`, with the Pix/boleto link emailed to the user). Only one pending renewal charge exists per cycle. When payment is confirmed: if `now < expiresAt`, `expiresAt` extends by the plan's months (paying early loses nothing); otherwise it becomes `now` plus the plan's months. Unpaid charges expire and extend nothing.
- **Payments via Asaas handle payments only**: one-off charges (Pix, boleto, card) and payment webhooks. Asaas subscriptions are not used. Split happens at sale, and a creator sub-account is started when the creator creates a course. The course can be drafted but not sold until payouts are enabled.
- **Video hosting via Bunny Stream**: creators upload, the platform plays through signed, expiring URLs after an access check.
- **Accounts** have email, username, bio and password, with email verification and password reset. A public **catalog** shows published courses; only admins set the featured flag. Creators get a **dashboard** (courses, income, subscribers and their progress, coupons, payment settings). **Refunds** by creators (own sales) or admins roll back the access the charge granted.
- **Architecture**: Next.js web app plus an Express API with all business logic, Prisma on PostgreSQL, and a shared Zod package, in a monorepo.
- Payment and video providers sit behind one thin interface each so they can be swapped.

## Capabilities

### New Capabilities
- `access-control`: roles (admin, creator, user), ownership rules, and who may do what on courses, creators and users.
- `course-pages`: selling page, and the members-area page tree, with typed blocks on each page.
- `members-progress`: per-user page completion and course percentage.
- `course-plans-pricing`: recurring plans of 1-12 months and lifetime plan per course, with per-plan-length discounts.
- `coupons`: creator-managed coupon codes applied at first purchase and renewal.
- `subscriptions`: purchase, `expiresAt`-based access gating with no grace period, expiry warnings, cancellation and user self-service.
- `renewals`: user-initiated and platform-initiated renewal charges, and how a confirmed payment extends `expiresAt`.
- `creator-payouts`: Asaas sub-account onboarding, split on each charge, and the sellable-only-when-payouts-enabled rule.
- `video-hosting`: Bunny Stream upload, signed playback, and the video block.
- `admin-management`: admin oversight of all courses, creators and users, and the featured flag.
- `authentication`: sign-up (email, username, bio, password), verification, sign-in, password reset.
- `course-catalog`: public gallery of published courses with an admin-set featured section.
- `creator-dashboard`: panel for courses, income, subscribers and their progress, coupons and payment settings.
- `refunds`: creators refund own sales, admins any; a refund rolls back `expiresAt`.

### Modified Capabilities
<!-- None: no specs exist yet. -->

## Impact

- New codebase: nothing exists in the repo beyond metadata. Likely stack from `package.json` keywords: Next.js, Node, Prisma, Postgres, Biome. App layout (single Next.js app vs web plus API) is undecided and belongs in design.
- External dependencies: Asaas (one-off charges, webhooks, KYC onboarding), Bunny Stream (upload, signed playback), an email service for renewal and expiry notices, and a scheduled job for creating renewal charges.
- Open items for design:
  - Quick Asaas sandbox check that split works on one-off charges (expected to be standard).
  - Minimum charge Asaas accepts, for fixed-value coupons larger than the price.
  - Cap on the number of plans per course.
- Legal and tax: the creator is the seller and the platform a marketplace with no platform fee (creators receive full proceeds minus provider costs); this warrants an accountant's review before launch.
