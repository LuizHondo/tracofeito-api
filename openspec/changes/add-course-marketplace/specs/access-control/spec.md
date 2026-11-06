## Purpose

Defines the admin, creator and user roles and the ownership rules that decide who may read or change courses, creators and users.

## ADDED Requirements

### Requirement: Roles
The system SHALL assign every account the role user, creator or admin. A creator SHALL also be able to buy and consume courses as a user.

#### Scenario: Creator buys another creator's course
- **WHEN** a creator purchases a course owned by someone else
- **THEN** the purchase succeeds and the creator gets members-area access like any user

### Requirement: Creator owns their courses
The system SHALL allow a creator to read and change only courses they own.

#### Scenario: Creator edits another creator's course
- **WHEN** a creator requests to edit, price or delete a course they do not own
- **THEN** the system rejects the request and changes nothing

### Requirement: User owns their data
The system SHALL allow a user to read and change only their own account, subscriptions and progress. A creator MAY read progress and buyer details for their own courses' subscribers only.

#### Scenario: User reads another user's subscription
- **WHEN** a user requests another user's subscription or progress
- **THEN** the system rejects the request

#### Scenario: Creator reads own subscriber
- **WHEN** a creator requests a subscriber of their own course
- **THEN** the system returns it

### Requirement: Admin manages everything
The system SHALL allow an admin to read and change all courses, creators and users.

#### Scenario: Admin edits any course
- **WHEN** an admin edits a course owned by any creator
- **THEN** the change is saved

### Requirement: Unauthenticated access
The system SHALL require authentication for every action except viewing published selling pages.

#### Scenario: Anonymous visitor opens members area
- **WHEN** an unauthenticated visitor requests a members-area page
- **THEN** the system redirects to sign-in
