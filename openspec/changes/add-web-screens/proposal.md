## Why

The API for auth, courses, plans, coupons, pages, blocks, videos, progress, catalog and admin exists (add-course-marketplace tasks 1-6, 9, 10.1, 10.3, 11.1), but the web app only has auth forms and an empty home. The approved design "Traço Feito — Telas-chave" (11 boards: identity, catalog, sales page, lesson, studio, block editor, admin users, plus four mobile variants) can now be built against those endpoints.

## What Changes

- Add the Traço Feito visual identity to the web app: dark-default and light themes (graphite, silver, bronze), Bricolage Grotesque + Geist, shared components (buttons, badges, inputs, toast, medallion cover for courses without a cover).
- Build learner screens: catalog `/`, sales page `/cursos/[id]`, lesson `/aprender/[id]/[pageId]` with sidebar tree, progress, prev/next, mark complete, video, Zoom and voice-channel blocks.
- Build creator screens: `/estudio` course list, and a course editor (settings, plans, coupons, sales page blocks, lessons tree and block editor with video upload status).
- Build admin users screen `/admin/usuarios` with search, role filter, role change, suspend/restore.
- Restyle the existing auth screens to the identity and add a shared header with account menu (sign out, profile edit).
- Small API additions where the design needs data the API does not return (studio list counts; see design.md).
- Checkout stays disabled ("Assinar — em breve", "Pagamentos ainda não disponíveis") because payments (tasks 7.x) are not built.

## Capabilities

### New Capabilities
- `web-design-system`: themes, typography, shared components, responsive behavior, voice/error copy.
- `web-learner-screens`: catalog, sales page and members-area lesson screens.
- `web-studio-screens`: creator studio course list and course editor (settings, plans, coupons, sales page, lessons, blocks, video upload).
- `web-admin-users`: admin users management screen.

### Modified Capabilities
<!-- None: openspec/specs is empty (add-course-marketplace is not archived); existing behavior is unchanged. -->

## Impact

- `apps/web`: new routes, components, Tailwind theme tokens, fonts; `lib/api.ts` extended with typed calls.
- `apps/api`: `GET /courses/mine` gains plan/page counts; no other contract changes expected.
- Non-goals: checkout/payments, renewals, refunds, creator income dashboard, subscriber list, account subscriptions area, admin courses screen (none are in the design or backend yet).
