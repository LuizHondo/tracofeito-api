## Purpose

Gives creators one panel to manage their courses and see income, subscribers, progress, coupons and payout settings.

## ADDED Requirements

### Requirement: Course management
The dashboard SHALL list the creator's courses and link to editing each course's selling page, members-area pages, plans and publishing state.

#### Scenario: Publish
- **WHEN** a payout-enabled creator publishes a course
- **THEN** it becomes visible in the catalog

### Requirement: Income
The dashboard SHALL show the creator's sales, amounts received after payment-provider costs, and refunds, filterable by course and period.

#### Scenario: Refund appears
- **WHEN** a charge is refunded
- **THEN** the income view shows the refund against that sale

### Requirement: Subscribers list
The dashboard SHALL list the users who bought the creator's courses, with their username, email, plan and expiry date. It SHALL NOT show users of other creators' courses.

#### Scenario: Other creator's buyer
- **WHEN** a creator looks for a user who only bought another creator's course
- **THEN** that user does not appear

### Requirement: Subscriber progress
The dashboard SHALL show each subscriber's per-page progress and completion percentage for the creator's own courses.

#### Scenario: Open a subscriber
- **WHEN** a creator opens a subscriber
- **THEN** the pages that subscriber completed are shown

### Requirement: Coupons panel
The dashboard SHALL let the creator create, list and cancel coupons per course.

#### Scenario: Cancel from panel
- **WHEN** a creator cancels a coupon in the panel
- **THEN** it stops applying immediately

### Requirement: Payment settings
The dashboard SHALL show the creator's payout onboarding status and let them continue or update it.

#### Scenario: Onboarding pending
- **WHEN** onboarding is incomplete
- **THEN** the panel says so and links to finish it
