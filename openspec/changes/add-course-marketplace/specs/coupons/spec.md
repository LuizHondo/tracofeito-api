## Purpose

Lets creators manage per-course coupon codes that discount a purchase or renewal.

## ADDED Requirements

### Requirement: Create coupon
The system SHALL let a creator create a coupon for their course with a code, a value and an expiration. A value ending in `%` SHALL be a percentage and any other number SHALL be a fixed amount in reais. The system SHALL store the type and the numeric value.

#### Scenario: Percentage coupon
- **WHEN** the creator enters `30%`
- **THEN** the coupon is stored as a 30 percent discount

#### Scenario: Fixed coupon
- **WHEN** the creator enters `30`
- **THEN** the coupon is stored as a R$30 discount

#### Scenario: Invalid value
- **WHEN** the creator enters `0%`, `150%`, a negative number or non-numeric text
- **THEN** the system rejects it with a message

### Requirement: Code uniqueness
The system SHALL reject a coupon whose code matches another active coupon of the same course. Canceled and expired coupons SHALL NOT count.

#### Scenario: Duplicate active code
- **WHEN** an active coupon `PROMO` exists and the creator creates another `PROMO` in that course
- **THEN** the system rejects it

#### Scenario: Reuse after cancel
- **WHEN** coupon `PROMO` was canceled and the creator creates `PROMO` again
- **THEN** the new coupon is created

### Requirement: Cancel coupon
The system SHALL let the creator cancel a coupon, after which it SHALL no longer apply.

#### Scenario: Canceled coupon at checkout
- **WHEN** a buyer enters a canceled coupon's code
- **THEN** the system rejects it

### Requirement: Applying a coupon
The system SHALL accept a coupon at first purchase and at renewal, apply at most one coupon per charge, and reject expired or unknown codes. The charge SHALL never go below the minimum amount the payment provider accepts.

#### Scenario: Two coupons
- **WHEN** a buyer tries to add a second coupon to a charge
- **THEN** the system keeps only one

#### Scenario: Expired code
- **WHEN** a buyer enters a coupon past its expiration
- **THEN** the system rejects it and the price is unchanged

#### Scenario: Fixed coupon larger than price
- **WHEN** a fixed coupon exceeds the plan price
- **THEN** the charge equals the minimum accepted amount
