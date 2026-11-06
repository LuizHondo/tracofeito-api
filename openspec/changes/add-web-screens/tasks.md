## 1. Foundation

- [x] 1.1 Add theme tokens (dark default, light via `prefers-color-scheme`), Bricolage Grotesque and Geist via `next/font`, and verify `next build` passes and a test page renders both themes
- [x] 1.2 Build shared components (Button, Badge, Field with linked error, Toast, ProgressBar, Medallion with id-derived ornament) and verify a component showcase route matches the identity board at 1440 and 390 px
- [x] 1.3 Build the shared Header with auth state, account menu (profile edit, sign out, Estúdio/Admin links by role) and verify visitor, user, creator and admin variants
- [x] 1.4 Extend `lib/api.ts` with typed calls and pt-BR error messages for catalog, content, courses, plans, coupons, pages, blocks, videos, progress, admin; verify with `tsc`
- [x] 1.5 Add a `next` redirect on sign-in (relative paths only) and a route guard helper; verify an external `next` URL is ignored
- [x] 1.6 Restyle the existing auth screens to the identity and verify the sign-in error message and the expired-link copy

## 2. API additions

- [x] 2.1 Add plan, lesson and selling-block counts to `GET /courses/mine` and verify with an API test that counts match and other creators' courses are excluded
- [x] 2.2 Add optional `label` to the shared zoom block schema and verify shared tests accept it and still accept old configs

## 3. Learner screens

- [x] 3.1 Build the catalog `/` (featured, all courses, podcast section, empty state, phone layout) and verify against seeded data and the board
- [x] 3.2 Build the sales page `/cursos/[id]` with blocks, creator bio and plan picker (per-month equivalent, discount badge, total) and verify not-found for unpublished courses
- [x] 3.3 Add viewer-state CTA (visitor, no access, has access) using `/auth/me` and `/content/:id/pages`, and verify all three states manually
- [x] 3.4 Add `react-markdown` rendering with safe links and block renderers for title, text, image, link and voice channel; verify a script/HTML payload renders as text
- [x] 3.5 Build the lesson page shell: sidebar tree (collapsible, done markers), progress bar, prev/next, and verify navigation and the 403 redirect to the sales page
- [x] 3.6 Add mark complete/undo with immediate sidebar and percentage update and the toast; verify progress persists after reload
- [x] 3.7 Add the video block (gated playback URL, processing state) and the Zoom block (viewer time zone, countdown, copy passcode); verify with a ready and a processing video
- [x] 3.8 Verify catalog, sales page and lesson at 390 px with no horizontal scroll

## 4. Studio screens

- [x] 4.1 Build `/estudio` list (counts, status badges, readiness "n de 7", empty state, unverified banner with resend) and verify each state
- [x] 4.2 Build the new-course form and course settings section and verify create, edit, publish and invalid-price errors
- [x] 4.3 Build the course editor layout with section tabs and ownership not-found handling; verify another creator's URL shows not-found
- [x] 4.4 Build the plans section with live total preview and delete, and verify duplicate length and out-of-range errors display
- [x] 4.5 Build the coupons section (create, cancel, list with expiry) and verify duplicate-code and expired states
- [x] 4.6 Build the sales-page block editor and the lessons tree (create, rename, nest, reorder, delete) and verify order persists in the members area
- [x] 4.7 Build the block editor `/estudio/[id]/aulas/[pageId]` with add/move/delete and per-type forms (title, text with Edit/Preview and counter, image, link, voice channel, Zoom) and verify invalid configs show API errors
- [x] 4.8 Build video upload with progress, processing polling, ready/failed states and retry; verify against Bunny config or a mocked host
- [x] 4.9 Verify the block editor at 390 px and a full creator walkthrough: create course, plan, lessons, publish, appears in catalog

## 5. Admin users

- [x] 5.1 Build `/admin/usuarios` with debounced search, role filter, 100-row notice and non-admin handling; verify the filter and the denied state
- [x] 5.2 Add role change, suspend confirmation dialog and restore, with self-row disabled; verify suspend ends the user's session and restore re-enables sign-in

## 6. Wrap-up

- [x] 6.1 Run `npx biome check`, `tsc` and `next build`, and walk visitor, learner, creator and admin flows against the boards in both themes
