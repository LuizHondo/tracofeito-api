## Purpose

Defines how a creator prices a course through recurring plans of 1 to 12 months and a lifetime plan, with creator-set per-plan discounts.

## ADDED Requirements

### Requirement: Recurring plan length
The system SHALL let the creator offer recurring plans whose length is a whole number of months from 1 to 12.

#### Scenario: Valid length
- **WHEN** the creator saves a plan of 5 months
- **THEN** the plan is saved

#### Scenario: Invalid length
- **WHEN** the creator saves a plan of 0, 13 or 2.5 months
- **THEN** the system rejects it

### Requirement: Lifetime plan
The system SHALL let the creator offer a lifetime plan with its own fixed price, charged once, granting access that never expires.

#### Scenario: Only lifetime
- **WHEN** a course offers only the lifetime plan
- **THEN** the course can be sold and buyers pay once

### Requirement: Plan price and discount
The system SHALL compute a recurring plan's price as the course's base monthly price times the plan's months times (1 minus the plan's discount percentage). The discount SHALL default to 0 and be set only by the creator.

#### Scenario: Discounted plan
- **WHEN** the base price is R$100 and a 12-month plan has a 20% discount
- **THEN** the plan price is R$960

#### Scenario: No discount set
- **WHEN** the creator sets no discount on a 6-month plan
- **THEN** the price is R$600 at a R$100 base

### Requirement: Cap on plans
The system SHALL allow at most one plan per distinct length per course.

#### Scenario: Duplicate length
- **WHEN** the creator adds a second 3-month plan to the same course
- **THEN** the system rejects it

### Requirement: Price changes
The system SHALL apply a changed price or discount to new purchases and renewals only.

#### Scenario: Price change mid-subscription
- **WHEN** the creator raises a plan's price
- **THEN** current access is unaffected and the next renewal uses the new price
