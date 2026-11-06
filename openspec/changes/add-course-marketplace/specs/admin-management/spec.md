## Purpose

Gives admins oversight of every course, creator and user on the platform.

## ADDED Requirements

### Requirement: Manage courses
The system SHALL let an admin list, edit, unpublish and delete any course.

#### Scenario: Unpublish
- **WHEN** an admin unpublishes a course
- **THEN** its selling page is hidden and new purchases are blocked

### Requirement: Manage creators and users
The system SHALL let an admin list, search, suspend and restore creators and users, and change a user's role.

#### Scenario: Suspend user
- **WHEN** an admin suspends a user
- **THEN** the user can no longer sign in

#### Scenario: Promote to creator
- **WHEN** an admin changes a user's role to creator
- **THEN** the user can create courses

### Requirement: Featured flag
The system SHALL let only an admin set or clear a course's featured flag.

#### Scenario: Admin clears featured
- **WHEN** an admin clears the flag
- **THEN** the course leaves the featured section

### Requirement: Admin refunds
The system SHALL let an admin refund any charge.

#### Scenario: Admin refund
- **WHEN** an admin refunds a charge
- **THEN** the refund rules apply

### Requirement: Existing buyers keep access
The system SHALL NOT remove paid access when a course is unpublished, unless an admin deletes the course.

#### Scenario: Unpublished with subscribers
- **WHEN** a course is unpublished
- **THEN** current subscribers keep access until `expiresAt`
