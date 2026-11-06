## Purpose

Lets creators build a public selling page and a gated, multi-page members area from ordered typed blocks, presented in a curso.dev-style reading layout.

## ADDED Requirements

### Requirement: Selling page
The system SHALL give each course one public selling page made of ordered blocks, which also shows the course's plans and lets visitors start a purchase.

#### Scenario: Visitor views selling page
- **WHEN** anyone opens a published course's selling page
- **THEN** the blocks render in order together with the available plans

### Requirement: Members-area page tree
The system SHALL let the creator build a members area as a tree of pages, each with a title, a slug and a position, optionally nested under another page.

#### Scenario: Creator nests and reorders pages
- **WHEN** the creator moves a page under another page or changes its position
- **THEN** the sidebar tree shows the new structure

#### Scenario: Slug uniqueness
- **WHEN** the creator saves a page whose slug duplicates a sibling's slug
- **THEN** the system rejects it with a message

### Requirement: Typed blocks
The system SHALL compose every page from ordered blocks of a fixed set of types: title, text, image, video, URL, voice channel link, Zoom call. Each block SHALL be validated against its type before saving.

#### Scenario: Invalid block rejected
- **WHEN** the creator saves a URL block with a malformed URL
- **THEN** the system rejects it and keeps the previous content

#### Scenario: Reorder blocks
- **WHEN** the creator reorders blocks on a page
- **THEN** the page renders them in the new order

### Requirement: Members area is gated
The system SHALL show members-area pages only to users with active access to the course, to the course's creator, and to admins.

#### Scenario: Expired user opens a page
- **WHEN** a user whose access expired requests a members-area page
- **THEN** the system denies it and shows the expiry notice with a renew action

### Requirement: Navigation layout
The members area SHALL present a sidebar with the page tree, a content column, and previous/next navigation between pages.

#### Scenario: Next page
- **WHEN** the user activates "next" on a page
- **THEN** the system opens the following page in tree order
