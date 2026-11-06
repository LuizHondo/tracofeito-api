## Purpose

Defines the shared look, components and responsive behavior of every Traço Feito web screen so they match the approved design.

## ADDED Requirements

### Requirement: Themes
The web app SHALL render a dark theme by default and a light theme when the visitor's system prefers light, using the design palette (background, card, border, foreground, bronze primary, silver, success, destructive).

#### Scenario: Default theme
- **WHEN** a visitor with no light preference opens any page
- **THEN** the page uses the dark palette

#### Scenario: Light preference
- **WHEN** the visitor's system prefers a light color scheme
- **THEN** the page uses the light palette with the same layout

### Requirement: Typography
The web app SHALL use Bricolage Grotesque (weight 800) for display headings and Geist for body text, with 17 px body text on catalog and lesson pages and 14 px in the studio and admin.

#### Scenario: Heading font
- **WHEN** a page renders its main heading
- **THEN** it uses Bricolage Grotesque

### Requirement: Course cover fallback
The web app SHALL show a 16:9 cover for every course card; a course without a cover SHALL show a medallion with the course initials whose border ornament is derived from the course id.

#### Scenario: Course without cover
- **WHEN** a course has no `coverUrl`
- **THEN** its card shows the medallion with its initials, and the same course always shows the same ornament

### Requirement: Responsive layout
Every designed screen SHALL work from 390 px to 1440 px wide with no horizontal page scroll.

#### Scenario: Phone width
- **WHEN** the catalog, sales page, lesson or block editor opens at 390 px wide
- **THEN** content reflows to a single column and all actions stay reachable

### Requirement: Accessible interaction
Interactive elements SHALL show a visible focus ring, form errors SHALL be linked to their field, status changes (toast, upload state) SHALL be announced politely, and progress bars SHALL expose their value.

#### Scenario: Wrong password
- **WHEN** sign-in fails
- **THEN** the field shows "Login ou senha incorretos" linked to the input and marked invalid

### Requirement: Voice
User-facing copy SHALL be Portuguese (pt-BR), address the person as "você", and describe what to do without blaming them.

#### Scenario: Expired link
- **WHEN** a verification or reset link has expired
- **THEN** the page says the link expired and offers a way to request another

### Requirement: Account menu
Authenticated screens SHALL show an account menu with the user's initials that lets them edit profile (username, bio, password) and sign out, and shows Estúdio for creators and admins and Admin for admins.

#### Scenario: Sign out
- **WHEN** the user chooses sign out
- **THEN** the session ends and the user lands on the catalog as a visitor
