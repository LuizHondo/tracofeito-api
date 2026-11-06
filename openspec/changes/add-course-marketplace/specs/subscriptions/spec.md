## Purpose

Defines how a purchase becomes time-limited or permanent access to a course, and how users view and manage their own subscriptions.

## ADDED Requirements

### Requirement: Access from expiration date
The system SHALL grant members-area access to a user for a course while the subscription's `expiresAt` is in the future, or permanently when the plan is lifetime.

#### Scenario: Active recurring subscription
- **WHEN** `expiresAt` is in the future
- **THEN** the user can open the course's members area

#### Scenario: Expired subscription
- **WHEN** `expiresAt` has passed
- **THEN** access is denied immediately, with no grace period

#### Scenario: Lifetime
- **WHEN** the user bought a lifetime plan
- **THEN** access never expires

### Requirement: Purchase
The system SHALL create a subscription only after the payment provider confirms payment of the charge.

#### Scenario: Unpaid charge
- **WHEN** a charge is created but not paid
- **THEN** no access is granted

#### Scenario: First payment confirmed
- **WHEN** payment of a first-purchase charge is confirmed
- **THEN** the subscription is created with `expiresAt` equal to now plus the plan's months

### Requirement: Expiry warning
The system SHALL warn a user in-app when access is about to expire or has expired, with a renew action.

#### Scenario: Warning on sign-in
- **WHEN** a user with an expiring or expired subscription signs in
- **THEN** a warning with a renew action is shown

### Requirement: User self-service
The system SHALL let a user list their subscriptions, see each expiry date and payment history, and cancel renewals.

#### Scenario: Cancel
- **WHEN** a user cancels a subscription
- **THEN** access continues until `expiresAt` and no further renewal charges are created

### Requirement: Idempotent payment events
The system SHALL process each payment confirmation at most once.

#### Scenario: Duplicate webhook
- **WHEN** the provider delivers the same confirmation twice
- **THEN** `expiresAt` is extended only once
