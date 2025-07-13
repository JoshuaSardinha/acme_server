**Module: Team Data Model & Management**

**REQ-TEAM-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist team data in a dedicated Teams table (or equivalent). Each record MUST include:
  - team_id (Primary Key, UUID recommended)
  - company_id (Foreign Key referencing Companies table, NOT NULL, Indexed)
  - name (Team name, MUST be unique within a company)
  - description (Optional text description)
  - category (Enum: 'LEGAL', 'CONVENTIONAL', default: 'CONVENTIONAL')
  - owner_user_id (Foreign Key referencing Users table, NOT NULL, referencing a user who MUST be a Manager or Admin within the same company)
  - created_at (Timestamp)
  - updated_at (Timestamp)
  - is_active (Boolean, default: true)
-
- **Rationale:** Defines the core structure for teams, linking them explicitly to a company and an owner, and categorizing them for assignment rules (e.g., legal petitions).
- **Acceptance Criteria:**
  - Database schema includes the Teams table with specified fields, constraints (FKs, uniqueness), and data types.
  - company_id ensures a team belongs to exactly one company.
  - Validation ensures owner*user_id references a user with role \*\_MANAGER or \*\_ADMIN from the \_same* company_id.
  - Enum values for category are defined.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-TEAM-002**

- **Requirement Type:** Data
- **Description:** The system MUST persist team membership data in a dedicated TeamMembers table (or equivalent association table). Each record MUST link a User to a Team and include:
  - team_member_id (Primary Key, UUID recommended)
  - team_id (Foreign Key referencing Teams table, NOT NULL, Indexed)
  - user_id (Foreign Key referencing Users table, NOT NULL, Indexed)
  - added_at (Timestamp)
  - added_by_user_id (Foreign Key referencing Users table, tracking who added the member)
-
- **Rationale:** Establishes the many-to-many relationship between Users and Teams. Tracks membership attribution.
- **Acceptance Criteria:**
  - Database schema includes the TeamMembers table with specified fields and constraints.
  - A composite unique key MUST exist on (team_id, user_id) to prevent duplicate memberships.
  - Validation MUST ensure the user*id being added belongs to the \_same* company_id as the team_id.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-TEAM-003**

- **Requirement Type:** Functional, API, Security
- **Description:** An API endpoint (POST /v1/teams) MUST exist for creating new teams.
  - NN Admins MUST be able to create teams for _any_ company.
  - Vendor Admins MUST be able to create teams _only_ for their own company.
  - The request MUST include name, company_id (for NN Admins), owner_user_id, and optionally description and category.
  - The system MUST validate that the specified owner_user_id is a Manager or Admin within the target company.
-
- **Rationale:** Allows authorized administrators to establish new teams within the correct company structure.
- **Acceptance Criteria:**
  - POST /v1/teams endpoint exists.
  - Authorization logic correctly restricts creation based on user role and target company_id.
  - Endpoint accepts required fields and validates owner eligibility.
  - A new Team record is created upon successful validation.
  - The creating user is recorded implicitly (e.g., in audit logs).
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, ABAC (company context), OWASP A01:2021-Broken Access Control, OAS 3.x

**REQ-TEAM-004**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for listing and retrieving team information:
  - GET /v1/teams: List teams. Should support filtering by company_id.
    - NN Admins can list teams for any company.
    - Vendor Admins/Managers can list teams _only_ for their own company.
    - Vendor/NN Employees can list teams they are members of within their company.
  -
  - GET /v1/teams/{teamId}: Retrieve details for a specific team.
    - NN Admins can retrieve any team.
    - Vendor Admins/Managers can retrieve any team within their own company.
    - Vendor/NN Employees can retrieve details _only_ if they are a member of that team.
  -
-
- **Rationale:** Provides necessary read access to team information based on user roles and company/team affiliation.
- **Acceptance Criteria:**
  - Specified endpoints exist and function as described.
  - Authorization logic correctly filters and restricts access based on user role, company, and team membership.
  - Endpoints return appropriate team data (potentially excluding sensitive details based on role).
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, ABAC, OWASP A01:2021-Broken Access Control, OAS 3.x

**REQ-TEAM-005**

- **Requirement Type:** Functional, API, Security
- **Description:** An API endpoint (PATCH /v1/teams/{teamId}) MUST exist for updating team details (e.g., name, description, owner_user_id).
  - NN Admins can update any team.
  - Vendor Admins can update any team within their own company.
  - Team Owners (Managers/Admins designated in owner*user_id) can update their \_own* team's details (name, description), but potentially not the owner field itself (only Admins can change owners).
  - The system MUST re-validate owner eligibility if owner_user_id is changed.
-
- **Rationale:** Allows authorized users to modify existing team configurations.
- **Acceptance Criteria:**
  - PATCH /v1/teams/{teamId} endpoint exists.
  - Authorization logic correctly restricts updates based on user role, company, and team ownership.
  - Endpoint accepts fields to be updated in the request body.
  - Validations (e.g., owner eligibility) are performed.
  - Team record is updated.
  - Audit logs capture team modification events (REQ-AUDIT-001).
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, ABAC, OWASP A01:2021-Broken Access Control, OAS 3.x

**REQ-TEAM-006**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for managing team membership:
  - POST /v1/teams/{teamId}/members: Add a user to a team. Request body MUST include user_id.
    - Authorization: NN Admins can add any user (from the team's company) to any team. Vendor Admins can add any user from their company to their company's teams. Team Owners can add users from their company to their _own_ team.
    - Validation: MUST ensure the user being added belongs to the same company_id as the team and is is_active=true. If the team category is 'LEGAL', this operation is allowed even if it doesn't immediately satisfy REQ-TEAM-007, but the team might become non-compliant if the last lawyer is removed later.
  -
  - DELETE /v1/teams/{teamId}/members/{userId}: Remove a user from a team.
    - Authorization: Similar to adding members (NN Admin \> Vendor Admin \> Team Owner for own team).
    - Validation:
      - MUST prevent removing the Teams.owner_user_id via this endpoint (owner must be changed first via REQ-TEAM-005).
      - MUST prevent removing the last lawyer from a 'LEGAL' team if this action would violate REQ-TEAM-007.
      - If the userId being removed has active TaskInstances currently assigned to them (TaskInstances.assigned*user_id) \_and* also associated with this teamId (TaskInstances.assigned_team_id), the removal MUST be blocked, or tasks must be unassigned first. The API should return an error indicating tasks need reassignment by a manager. (Alternative: automatically unassign, but this is less explicit). **Decision:** Block and require manager to reassign.
    -
  -
  - GET /v1/teams/{teamId}/members: List members of a specific team (covered by REQ-TEAM-004 detail retrieval).
-
- **Rationale:** Enables management of user assignments to teams according to defined permissions, with safeguards for team ownership, legal compliance, and task continuity.
- **Acceptance Criteria:**
  - POST /v1/teams/{teamId}/members and DELETE /v1/teams/{teamId}/members/{userId} endpoints exist.
  - Authorization logic correctly restricts membership changes.
  - Validations for company consistency, active user status, owner removal, last lawyer removal, and active task assignments are implemented and block operations with appropriate error messages if violated.
  - TeamMembers records are created/deleted accordingly.
  - Changes are audited (REQ-SEC-AUDIT-001).
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, ABAC, OWASP A01:2021-Broken Access Control, Data Integrity, OAS 3.x

**REQ-TEAM-007**

- **Requirement Type:** Functional, Constraint
- **Description:** When creating or updating a team's category to 'LEGAL', the system MUST verify that at least one member (including the owner) of the team has the is_lawyer flag set to true. If changing category or removing the last lawyer from a 'LEGAL' team would violate this constraint, the operation MUST be rejected.
- **Rationale:** Enforces the business rule that teams handling legal matters must have lawyer supervision.
- **Acceptance Criteria:**
  - Validation logic is implemented during team creation (POST /v1/teams).
  - Validation logic is implemented during team update (PATCH /v1/teams/{teamId}), specifically when changing category or owner_user_id.
  - Validation logic is implemented when removing a member (DELETE /v1/teams/{teamId}/members/{userId}) if the team is 'LEGAL' and the user being removed is the last lawyer.
  - Validation logic is implemented when updating a user's is_lawyer status (PATCH /users/{userId}) if that user is the last lawyer on any 'LEGAL' teams they belong to.
  - Operations violating the constraint return an appropriate error response (e.g., HTTP 409 Conflict or 422 Unprocessable Entity).
-
- **Priority:** Must Have
- **Standard/Reference:** Business Logic Constraint
