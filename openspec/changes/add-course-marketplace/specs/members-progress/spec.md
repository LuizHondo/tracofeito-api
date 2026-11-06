## Purpose

Tracks each user's completion of members-area pages and shows a course completion percentage.

## ADDED Requirements

### Requirement: Mark page complete
The system SHALL let a user with active access mark a members-area page complete or incomplete.

#### Scenario: Mark complete
- **WHEN** a user marks a page complete
- **THEN** the sidebar shows it as done and the course percentage updates

### Requirement: Course percentage
The system SHALL compute a user's course progress as completed pages divided by total pages.

#### Scenario: Pages added later
- **WHEN** the creator adds a page after a user completed all existing pages
- **THEN** the user's percentage drops below 100% accordingly

### Requirement: Progress visibility
The system SHALL show a user's progress to that user, to the creator of that course, and to admins. A creator SHALL NOT see progress for courses they do not own.

#### Scenario: Creator views own subscriber
- **WHEN** a creator opens the progress of a subscriber of their course
- **THEN** the system shows it

#### Scenario: Creator views another creator's course
- **WHEN** a creator requests progress for a course they do not own
- **THEN** the system rejects it

### Requirement: Progress survives expiry
The system SHALL keep a user's progress when access expires or is refunded and restore it on renewal.

#### Scenario: Renew after lapse
- **WHEN** a user renews after access expired
- **THEN** previously completed pages are still marked complete
