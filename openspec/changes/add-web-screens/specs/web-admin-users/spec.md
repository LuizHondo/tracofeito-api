## Purpose

Defines the admin users screen for finding users, changing roles and suspending accounts.

## ADDED Requirements

### Requirement: User search and filter
`/admin/usuarios` SHALL be available only to admins and SHALL list users with email, username, role, status and creation date, filterable by search text (email or username) and role, and SHALL tell the admin when results are capped ("Mostrando os 100 primeiros resultados. Refine a busca.").

#### Scenario: Search
- **WHEN** the admin types "marina"
- **THEN** only matching users are listed

#### Scenario: Non-admin
- **WHEN** a non-admin opens the page
- **THEN** they see a not-found or no-permission message and no user data

### Requirement: Role change
The screen SHALL let an admin change another user's role between Aluno, Criador and Admin, and SHALL disable role change and suspension on the admin's own row with the note "Você não pode alterar a própria conta".

#### Scenario: Promote to creator
- **WHEN** the admin sets a learner to Criador
- **THEN** the change is saved and shown on the row

### Requirement: Suspend and restore
The screen SHALL ask for confirmation before suspending ("Suspender {usuário}?", explaining sessions end and sign-in is blocked), and SHALL let an admin restore a suspended user.

#### Scenario: Suspend
- **WHEN** the admin confirms suspension
- **THEN** the row shows "Suspenso" with a Restore action

#### Scenario: Cancel
- **WHEN** the admin cancels the dialog
- **THEN** nothing changes
