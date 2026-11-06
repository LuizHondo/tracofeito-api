## Purpose

Lets people create an account and sign in with email, username and password, and recover access.

## ADDED Requirements

### Requirement: Sign up
The system SHALL let a visitor create an account with an email, a unique username, a bio (optional) and a password. Email and username SHALL each be unique.

#### Scenario: Successful sign-up
- **WHEN** a visitor submits a new email, a free username and a valid password
- **THEN** an account with role user is created and a verification email is sent

#### Scenario: Duplicate email or username
- **WHEN** a visitor submits an email or username already in use
- **THEN** the system rejects it with a message

### Requirement: Email verification
The system SHALL require a verified email before a user can purchase a course or create one.

#### Scenario: Unverified purchase
- **WHEN** a user with an unverified email tries to purchase
- **THEN** the system blocks it and offers to resend the verification email

### Requirement: Sign in and out
The system SHALL let a user sign in with email or username plus password, and sign out.

#### Scenario: Wrong password
- **WHEN** a user submits a wrong password
- **THEN** the system rejects it without revealing which field was wrong

### Requirement: Password reset
The system SHALL let a user reset their password through a time-limited link sent to their verified email.

#### Scenario: Expired link
- **WHEN** a user opens a reset link past its expiry
- **THEN** the system rejects it and offers a new one

### Requirement: Profile
The system SHALL let a user edit their username, bio and password. A creator's username and bio SHALL appear on their course pages and catalog cards.

#### Scenario: Edit bio
- **WHEN** a creator updates their bio
- **THEN** their course pages show the new bio

### Requirement: Password storage
The system SHALL store passwords only as salted, slow hashes and SHALL rate-limit sign-in attempts.

#### Scenario: Repeated failures
- **WHEN** many failed sign-ins come from one source in a short time
- **THEN** further attempts are temporarily blocked
