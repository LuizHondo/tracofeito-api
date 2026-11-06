## Purpose

Defines who can refund a charge and how a refund rolls back the access the charge granted.

## ADDED Requirements

### Requirement: Who can refund
The system SHALL let a creator refund charges for their own courses and an admin refund any charge.

#### Scenario: Creator refunds another creator's sale
- **WHEN** a creator attempts to refund a charge for a course they do not own
- **THEN** the system rejects it

### Requirement: Refund rolls back access
The system SHALL, when a refund is confirmed, subtract from `expiresAt` the months that charge granted. If the result is not in the future, access SHALL end immediately.

#### Scenario: Refund of the latest renewal
- **WHEN** a 3-month renewal charge is refunded and the new date is still in the future
- **THEN** `expiresAt` moves back 3 months and access continues until then

#### Scenario: Refund of first purchase
- **WHEN** the only charge of a subscription is refunded
- **THEN** access ends immediately

#### Scenario: Refunded lifetime
- **WHEN** a lifetime charge is refunded
- **THEN** the subscription is removed and access ends

### Requirement: Refund reverses the payout
The system SHALL reverse the creator's received amount for the refunded amount.

#### Scenario: Creator income after refund
- **WHEN** a charge is refunded
- **THEN** the creator's income reflects the reversal

### Requirement: Idempotent refunds
The system SHALL apply each refund confirmation at most once and SHALL keep the user's progress.

#### Scenario: Duplicate refund event
- **WHEN** the provider delivers the same refund event twice
- **THEN** `expiresAt` is rolled back only once
