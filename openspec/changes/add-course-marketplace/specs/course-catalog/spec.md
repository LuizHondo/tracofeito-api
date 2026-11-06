## Purpose

Gives visitors a public, gallery-style catalog of published courses, with a featured section curated by admins.

## ADDED Requirements

### Requirement: Catalog gallery
The system SHALL show a public gallery of published courses with each course's cover, title, creator and starting price.

#### Scenario: Visitor browses
- **WHEN** anyone opens the catalog
- **THEN** all published, sellable courses appear as cards that link to their selling pages

#### Scenario: Unpublished course hidden
- **WHEN** a course is unpublished or a draft
- **THEN** it does not appear in the catalog

### Requirement: Featured courses
The system SHALL show courses flagged featured in a highlighted section. Only an admin SHALL be able to set or clear the featured flag.

#### Scenario: Admin features a course
- **WHEN** an admin flags a course as featured
- **THEN** it appears in the featured section

#### Scenario: Creator tries to feature
- **WHEN** a creator attempts to set the featured flag on their own course
- **THEN** the system rejects it

### Requirement: Starting price
The catalog SHALL show the lowest per-month or lifetime price among the course's plans.

#### Scenario: Plan list
- **WHEN** a course has plans at R$100, R$570 and a lifetime R$900
- **THEN** the card shows the lowest price among them
