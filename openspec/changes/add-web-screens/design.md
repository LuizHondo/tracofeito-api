## Context

`apps/web` is Next.js 16 / React 19 / Tailwind 4 with a typed `api()` fetch helper over a same-origin `/api` rewrite (session cookie), plus auth pages and `AuthForm`. The API already exposes: `/catalog`, `/content/:id/selling|pages|pages/:pageId|progress|pages/:pageId/complete|videos/:vid/playback`, `/courses` (`mine`, CRUD, `/plans`, `/coupons`, `/pages`, `/blocks`, `/videos`), `/admin/users|courses`, `/auth/*`. The design (11 boards in "Traço Feito — Telas-chave.html") covers catalog, sales page, lesson, studio list, block editor, admin users and four mobile variants. The design file is a throwaway prototype (inline styles); we reproduce its tokens and layout, not its markup.

Gaps found between design and API:
- `GET /courses/mine` has no plan/lesson counts (the list shows "4 planos · 12 aulas").
- Zoom block config has `url`, `startsAt`, `passcode` but the design has a "Rótulo" field.
- No endpoint says "does this user have access?" for the sales page CTA.
- No upload progress source: Bunny's upload is done by the browser directly.

## Goals / Non-Goals

**Goals:**
- Every designed screen, desktop and phone, working against the existing API.
- Visual tokens defined once and shared.

**Non-Goals:**
- Checkout, renewals, refunds, income dashboard, subscriber list, subscriptions area (payments tasks 7.x, 8.x, 10.2, 11.2-11.5 remainder).
- Admin courses screen (linked in the admin nav but not designed; the API exists, left for a follow-up).
- Drag-and-drop reordering (design shows a handle, but up/down buttons are the accessible baseline; handle is a later nicety).
- Image upload (image blocks take a URL, as the API does).

## Decisions

**Theme tokens in CSS.** Define the palette as CSS variables in `globals.css` (`@theme` for Tailwind 4), dark on `:root`, light under `@media (prefers-color-scheme: light)`. oklch values copied from the identity board. No theme toggle (not designed).

**Fonts via `next/font`.** Bricolage Grotesque and Geist from `next/font/google`, exposed as `--font-display` / `--font-sans`.

**Data fetching.** Public pages (catalog, sales) are server components fetching the API at `API_URL` directly (SEO, no flash). Authenticated pages are client components using `api()` since the session cookie is only forwarded by the browser proxy. Alternative (forward cookies in server components) rejected as more plumbing for no UX gain here.

**Viewer state on the sales page without a new endpoint.** Client island calls `GET /auth/me`, then `GET /content/:id/pages`; 200 = has access, 403 `no_access` = no access, 401 = visitor. Avoids a new API surface.

**Studio list counts.** Extend `GET /courses/mine` with Prisma `_count` of plans and pages (additive, non-breaking). The readiness checklist "n de 7" is computed on the client from fields already returned: title, description, cover, base price > 0, ≥1 plan, ≥1 selling block, ≥1 lesson. Counting selling blocks needs one more `_count` (blocks with null page): add it to the same query.

**Zoom label.** Add optional `label` (max 200) to the shared zoom schema; additive, existing blocks stay valid.

**Course editor structure.** One route `/estudio/[id]` with section routes: `configuracoes`, `planos`, `cupons`, `vendas`, `aulas`, and `/estudio/[id]/aulas/[pageId]` for the block editor, sharing a layout with the tab nav from the design. New course form lives at `/estudio/novo`.

**Block editor saves per block.** Each block saves independently (explicit "Salvar bloco" for text, blur/save for others) via the existing block PATCH, validated by `@tf/shared` schemas on the client for instant errors and by the API as authority. Move up/down calls PATCH with the new position.

**Video upload.** `POST /courses/:id/videos` returns `{videoId, upload}`; the browser PUTs the file with `XMLHttpRequest` (progress events) per the host's upload info, then the block stores `videoId` and the editor polls `GET /courses/:id/videos/:videoId` every few seconds until `ready` or `failed`. The exact upload shape depends on the Bunny implementation in `providers/video.ts` and is confirmed in the first video task.

**Markdown.** Render with `react-markdown` (no raw HTML, external links `target="_blank" rel="noopener noreferrer"`). One small dependency instead of hand-rolling a sanitizer; this is user content shown to other users, so safe rendering is required.

**Time zones.** Zoom `startsAt` is stored as ISO UTC; the editor uses `datetime-local` and converts, the viewer formats with `Intl.DateTimeFormat` in their zone.

**Auth redirects.** Signed-out access to `/aprender/*` or `/estudio/*` redirects to `/sign-in?next=<path>`; sign-in honors `next` (same-origin relative paths only, to avoid open redirects).

**Admin users.** Client page calling `/admin/users?q=&role=` with debounced search, `PUT /admin/users/:id/role`, `POST .../suspend|restore`, confirmation as an accessible `alertdialog`.

**Existing auth screens** are restyled with the shared components and keep their behavior.

## Risks / Trade-offs

- Design is inline-style prototype → risk of drift; mitigate by tokens + small shared components, checking each screen against the board at 1440 and 390.
- Client-side access probe on the sales page adds a request and a brief CTA loading state → show the visitor CTA skeleton; acceptable until payments add a proper endpoint.
- Video host upload contract unverified in a browser → first task spikes it with the mocked/real Bunny config before building the full UI.
- Podcast section content (YouTube) is not in the API → rendered from a static config constant; replace when the channel URL is final.
- Studio checklist rule is my interpretation of "n de 7" (not specified in the design) → confirm with the author before shipping.
