## Purpose

Defines user-initiated and platform-initiated renewal charges and how a confirmed payment extends access.

## ADDED Requirements

### Requirement: User-initiated renewal
The system SHALL let a user with a recurring subscription create a renewal charge at any time, priced at the plan's current price and any coupon entered.

#### Scenario: Renew early
- **WHEN** a user clicks renew before `expiresAt`
- **THEN** a charge is created with the current plan price

### Requirement: Platform-initiated renewal
The system SHALL create a renewal charge 7 days before `expiresAt` for each non-canceled recurring subscription and email the user the Pix or boleto link.

#### Scenario: Charge created ahead of expiry
- **WHEN** the subscription reaches the renewal window
- **THEN** a charge is created and the user is emailed

### Requirement: One pending charge per cycle
The system SHALL keep at most one pending renewal charge per subscription cycle.

#### Scenario: User renews after platform charge
- **WHEN** the platform already created a pending charge and the user clicks renew
- **THEN** the existing charge is reused or replaced, never duplicated

### Requirement: Extending access
The system SHALL, on confirmed payment, set `expiresAt` to the old `expiresAt` plus the plan's months when it is still in the future, and to now plus the plan's months otherwise.

#### Scenario: Paid early
- **WHEN** payment is confirmed 3 days before `expiresAt`
- **THEN** the new date is the old date plus the plan's months

#### Scenario: Paid after expiry
- **WHEN** payment is confirmed after `expiresAt`
- **THEN** the new date is now plus the plan's months

### Requirement: Unpaid charges
The system SHALL let an unpaid renewal charge expire without extending access.

#### Scenario: Boleto never paid
- **WHEN** a renewal boleto passes its due date unpaid
- **THEN** `expiresAt` is unchanged and access ends at that date
