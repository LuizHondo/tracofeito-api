## Purpose

Ensures creators are paid automatically on each sale through a payment-provider sub-account, and that a course cannot sell until payouts are possible.

## ADDED Requirements

### Requirement: Payout onboarding
The system SHALL start payout onboarding for a creator when they create their first course, and show the onboarding status.

#### Scenario: First course
- **WHEN** a creator creates a course without a payout account
- **THEN** onboarding starts and the status is shown

### Requirement: Sellable only with payouts enabled
The system SHALL let a creator draft a course before payouts are enabled but SHALL NOT allow purchases until the provider reports payouts enabled.

#### Scenario: Purchase before enablement
- **WHEN** a buyer tries to purchase a course whose creator is not payout-enabled
- **THEN** the purchase is blocked

### Requirement: Split on each charge
The system SHALL route the full proceeds of each paid charge to the creator's account. The platform SHALL take no fee.

#### Scenario: Paid charge
- **WHEN** a charge is paid
- **THEN** the creator receives the price, minus only the payment provider's own costs, automatically

### Requirement: Provider abstraction
Payment provider interactions SHALL be isolated so the provider can be replaced without changing subscription behavior.

#### Scenario: Provider swap
- **WHEN** the provider implementation is replaced
- **THEN** subscription and renewal specs still hold
