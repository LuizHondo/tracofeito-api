## Purpose

Defines the public catalog, course sales page and members-area lesson screens, backed by the existing catalog, content and progress endpoints.

## ADDED Requirements

### Requirement: Catalog
The catalog at `/` SHALL show featured courses and all published courses that have a plan, each with title, creator and "a partir de" price, and link to the course's sales page. It SHALL include the podcast section and header navigation (Cursos, Podcast, Seja criador, Entrar or account menu).

#### Scenario: Browse
- **WHEN** a visitor opens `/`
- **THEN** featured and all courses from the catalog endpoint are listed with starting prices

#### Scenario: Empty catalog
- **WHEN** no course is published with a plan
- **THEN** the page shows a friendly empty message instead of an empty grid

### Requirement: Sales page
The sales page at `/cursos/[id]` SHALL show the course title, creator, description, the creator's sales blocks, the creator bio card and a plan picker listing each plan with name, per-month equivalent, discount badge and total price, pre-selecting the longest recurring plan.

#### Scenario: Plan choice
- **WHEN** the visitor selects a plan
- **THEN** that plan is marked selected and its total is shown

#### Scenario: Unknown or unpublished course
- **WHEN** the course does not exist or is not published
- **THEN** the page shows a not-found message with a link to the catalog

### Requirement: Purchase call to action by viewer state
The sales page SHALL adapt its call to action to the viewer: visitors see "Assinar" leading to sign-in with a note, signed-in users without access see a disabled "Assinar — em breve" with "Pagamentos ainda não disponíveis", and users with access see "Acessar curso" leading to the lesson area.

#### Scenario: Visitor
- **WHEN** a signed-out visitor views the sales page
- **THEN** "Assinar" sends them to sign-in and returns them to the course afterwards

#### Scenario: Subscriber
- **WHEN** a user with active access views the sales page
- **THEN** "Acessar curso" opens the first lesson (or the one after their last completed)

#### Scenario: No access
- **WHEN** a signed-in user without access views the sales page
- **THEN** the call to action is disabled with the payments-unavailable hint

### Requirement: Lesson page
The lesson page at `/aprender/[id]/[pageId]` SHALL require sign-in and access, and SHALL show a collapsible sidebar tree of sections and lessons (done marker, current highlighted), the course progress bar with "n de total aulas", the lesson's blocks rendered in order, and previous/next navigation.

#### Scenario: Navigate
- **WHEN** the user selects the next lesson
- **THEN** that lesson opens with the sidebar highlighting it

#### Scenario: No access
- **WHEN** a user without access opens a lesson URL
- **THEN** they are sent to the course sales page with a message that they need a plan

#### Scenario: Signed out
- **WHEN** a visitor opens a lesson URL
- **THEN** they are sent to sign-in and returned afterwards

### Requirement: Mark lesson complete
The lesson page SHALL let the user toggle completion of the current lesson, update the sidebar and percentage immediately, and show a "Mandou bem! Aula concluída" toast when marking complete.

#### Scenario: Complete
- **WHEN** the user marks a lesson complete
- **THEN** the button reads "Concluída", the sidebar shows it done, the percentage updates and the toast appears

#### Scenario: Undo
- **WHEN** the user toggles a completed lesson back
- **THEN** it returns to incomplete and the percentage decreases

### Requirement: Block rendering
The web app SHALL render title, text (Markdown, external links open in a new tab), image, video (gated player), link, voice channel and Zoom blocks. A Zoom block SHALL show the meeting time in the viewer's time zone, a countdown while upcoming, the optional password with a copy button, and a join link. A video not yet ready SHALL show a processing state instead of a player.

#### Scenario: Zoom in viewer's time zone
- **WHEN** a Zoom block has a stored date and time
- **THEN** each viewer sees it in their own time zone

#### Scenario: Video processing
- **WHEN** a video block's video is not ready
- **THEN** the lesson shows that the video is still processing and no playback request fails visibly
