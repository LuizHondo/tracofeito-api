## Purpose

Lets creators upload videos to a managed host and plays them only to users with access, through expiring signed links.

## ADDED Requirements

### Requirement: Video upload
The system SHALL let a creator upload a video for a video block and show its processing status until it is ready.

#### Scenario: Upload completes
- **WHEN** the host reports the video ready
- **THEN** the video block becomes playable

### Requirement: Gated playback
The system SHALL issue a signed, expiring playback link only after confirming the requester has access to the course.

#### Scenario: Expired user
- **WHEN** a user without active access requests playback
- **THEN** no playback link is issued

#### Scenario: Link expires
- **WHEN** a playback link passes its expiry
- **THEN** it no longer plays

### Requirement: Host abstraction
Video host interactions SHALL be isolated so the host can be replaced.

#### Scenario: Host swap
- **WHEN** the host implementation is replaced
- **THEN** page and access behavior is unchanged
