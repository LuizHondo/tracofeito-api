## Purpose

Defines the creator studio: listing a creator's courses and editing a course's settings, plans, coupons, sales page and lessons with blocks and video upload.

## ADDED Requirements

### Requirement: Studio access
The studio under `/estudio` SHALL be available only to signed-in creators and admins; others SHALL see a message explaining how to become a creator.

#### Scenario: Learner opens studio
- **WHEN** a user with role user opens `/estudio`
- **THEN** they see "Seja criador" guidance and no course data

### Requirement: Course list
`/estudio` SHALL list the creator's courses with cover or medallion, title, plan and lesson counts, base monthly price, status (Publicado, Rascunho, Em destaque) and a readiness indicator of completed setup steps, and SHALL show a three-step empty state when there are none.

#### Scenario: Course without plan
- **WHEN** a published course has no plan
- **THEN** the row says it is outside the catalog and the page explains that a published course without a plan does not appear

#### Scenario: First visit
- **WHEN** the creator has no courses
- **THEN** the page shows "Ainda não tem nada aqui" with the three steps (create course, define plans, build lessons)

### Requirement: Email verification gate
The studio SHALL show a banner with "Reenviar email" while the creator's email is unverified, and SHALL disable "Novo curso".

#### Scenario: Unverified creator
- **WHEN** an unverified creator opens the studio
- **THEN** "Novo curso" is disabled and the banner can resend the verification email

### Requirement: Course settings
The editor SHALL let the owner (or an admin) create and edit title, description, cover URL, base monthly price and published state.

#### Scenario: Create course
- **WHEN** a verified creator submits a title and base price
- **THEN** the course is created as a draft and its editor opens

#### Scenario: Invalid price
- **WHEN** the base price is negative or not a number
- **THEN** the field shows an error and nothing is saved

### Requirement: Plans and coupons management
The editor SHALL let the owner create, edit and delete plans (1-12 months or lifetime, discount percent, lifetime price) with the computed total shown, and create and cancel coupons (code, `30%` or `30` value, expiry), surfacing API validation errors in plain language.

#### Scenario: Plan total preview
- **WHEN** the creator sets a 12-month plan with 20% discount on a R$ 100,00 base
- **THEN** the form shows the total R$ 960,00

#### Scenario: Duplicate coupon code
- **WHEN** the creator reuses an active coupon code in the course
- **THEN** the form says the code is already in use

### Requirement: Sales page and lessons tree
The editor SHALL let the owner edit the sales page blocks and manage the lessons tree (create, rename, nest, reorder, delete), opening any lesson in the block editor.

#### Scenario: Reorder lessons
- **WHEN** the creator moves a lesson up
- **THEN** the order persists and the members area shows it

### Requirement: Block editor
The block editor at `/estudio/[id]/aulas/[pageId]` SHALL list a lesson's blocks with move up/down (first up and last down disabled), delete and add-below actions for title, text, image, video, link, voice channel and Zoom; texts SHALL have Edit/Preview tabs with a character counter (max 20000) and explicit save; invalid configs SHALL show the API's validation error.

#### Scenario: Add block
- **WHEN** the creator adds a Zoom block below the selected block
- **THEN** it appears directly below with fields for label, date and time, meeting link and optional password

#### Scenario: Preview markdown
- **WHEN** the creator opens the Preview tab of a text block
- **THEN** the rendered Markdown is shown as students will see it

### Requirement: Video upload
A video block SHALL upload the file directly to the video host using the API-issued upload, show progress ("Enviando n%"), then processing, ready or failed states (updated by polling the video status), and offer "Enviar de novo" on failure.

#### Scenario: Upload completes
- **WHEN** the file finishes uploading and the host reports ready
- **THEN** the block shows "Pronto" and the video is visible to students

#### Scenario: Upload fails
- **WHEN** the host reports failure
- **THEN** the block shows the failure hint and "Enviar de novo"

### Requirement: Ownership isolation
Studio screens SHALL NOT show or edit another creator's course; the API's 403/404 SHALL render as a not-found message.

#### Scenario: Other creator's course
- **WHEN** a creator opens another creator's course editor URL
- **THEN** they see a not-found message
