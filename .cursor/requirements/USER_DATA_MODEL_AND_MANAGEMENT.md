**Module: User Data Model & Management (Refactored Paths)**

**REQ-USER-001** (Data Model \- No change)

- **Requirement Type:** Data
- **Description:** The system MUST persist user data in a dedicated Users table (or equivalent structure). Each user record MUST include:
  - id (Primary Key, UUID recommended)
  - auth0_user_id (Unique identifier from Auth0 JWT sub claim, Indexed)
  - email (Unique, Indexed, PII)
  - first_name (PII)
  - last_name (PII)
  - role (Enum: 'CLIENT', 'VENDOR_EMPLOYEE', 'VENDOR_MANAGER', 'VENDOR_ADMIN', 'NN_EMPLOYEE', 'NN_MANAGER', 'NN_ADMIN')
  - is_lawyer (Boolean, default: false)
  - company*id (Foreign Key referencing Companies table, nullable for Clients initially?) \- \_Self-correction: Clients need association later* \-\> company_id (FK to Companies, NULL only if a client hasn't started a petition with a specific vendor yet, otherwise linked to the Vendor/NN).
  - created_at (Timestamp)
  - updated_at (Timestamp)
  - is_active (Boolean, default: true)

**REQ-USER-002**

- **Requirement Type:** Functional, API
- **Description:** Currently, in the recently implemented system, the user has two options: a sign-up (POST /v1/auth/signup) and a login (POST /v1/auth/login). Login is not available to users who have not signed up. They are requested to provide their first name, last name, email, and password to sign up. Upon the first successful login/token validation _after_ Auth0 signup, the backend MUST ensure a corresponding user record exists in the Users table. If not, it MUST be created using information from the Auth0 ID token (e.g., sub, email, given_name, family_name). The initial role MUST be 'CLIENT'. The company_id can be determined based on the client application flavor (see REQ-APP-001).
- **Rationale:** Ensures seamless user onboarding. Establishes default role and links client based on app flavor.
- **Acceptance Criteria:**
  - Backend logic (e.g., middleware or dedicated service) checks for user existence on first authenticated request using auth0_user_id.
  - User record is created if it doesn't exist, populated from token claims.
  - Initial role is 'CLIENT'.
  - company_id is set based on app flavor context.
  - Relevant Auth endpoints (/v1/auth/signup, /v1/auth/login \- likely handled mostly by Auth0 redirects/callbacks, but backend sync is key) are conceptually understood and user creation logic is tied to successful authentication.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-USER-003**

- **Requirement Type:** Functional, API, Security
- **Description:** An API endpoint MUST exist for National Niner Admins (NN_ADMIN) to create new National Niner users (NN_EMPLOYEE, NN_MANAGER, NN_ADMIN). The endpoint (POST /users/nn-invite) MUST allow specifying email, first_name, last_name, role, and is_lawyer status. The newly created user record should be linked to the National Niner company record. An invitation mechanism (e.g., email invite handled via Auth0) should be triggered.
- **Rationale:** Allows NN Admins to provision internal user accounts securely.
- **Acceptance Criteria:**
  - POST /users/nn-invite endpoint exists.
  - Only NN Admins can call this endpoint.
  - Accepts required user details.
  - New User record created correctly.
  - Invitation sent via Auth0.
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, OWASP A01:2021-Broken Access Control, OAS 3.x

**REQ-USER-004**

- **Requirement Type:** Functional, API, Security
- **Description:** An API endpoint MUST exist for Vendor Admins (VENDOR*ADMIN) to create new users (VENDOR_EMPLOYEE, VENDOR_MANAGER) within their \_own* company. The endpoint (POST /users/vendor-invite) MUST allow specifying email, first_name, last_name, role, and is_lawyer status. The API MUST enforce that the admin can only create users for their assigned company_id. An invitation mechanism should be triggered.
- **Rationale:** Allows Vendor Admins self-service user management.
- **Acceptance Criteria:**
  - POST /users/vendor-invite endpoint exists.
  - Only Vendor Admins can call this endpoint.
  - Authorization enforces company boundary.
  - New User record created correctly.
  - Invitation sent via Auth0.
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, OWASP A01:2021-Broken Access Control, OAS 3.x

**REQ-USER-005 (Revised for Deactivation/Deletion Logic)**

- **Requirement Type:** Functional, API, Security
- **Description:** An API endpoint (PATCH /v1/admin/users/{userId}) MUST exist for authorized administrators (NN Admins for any user; Vendor Admins for users within their own company) to modify user details. Allowed modifications:
  - Update user's role (within permitted role transitions, e.g., VENDOR_EMPLOYEE to VENDOR_MANAGER within the same company type).
  - Update user's is_lawyer status.
  - Update user's is_active status (activate/deactivate).
  - **Deactivation/Deletion Handling:**
    - When deactivating (is_active=false) a user:
      - If the user is an owner of any active teams (Teams.owner_user_id), the deactivation operation MUST be blocked with an error message, requiring team ownership to be reassigned first (via REQ-TEAM-005).
      - Active tasks (TaskInstances) assigned to the user (TaskInstances.assigned_user_id) MUST have their assigned_user_id set to NULL. The system SHOULD notify the relevant team manager(s) or company admin(s) about these unassigned tasks requiring reassignment.
    -
    - True deletion of user records is NOT supported in the initial version due to audit and data integrity complexities with PII and legal case data. Deactivation (is_active=false) is the standard method for removing user access.
  -
-
- **Rationale:** Provides administrative controls over user accounts. Ensures system integrity and task continuity when users are deactivated. Addresses policy for deletion vs. deactivation.
- **Acceptance Criteria:**
  - PATCH /v1/admin/users/{userId} endpoint exists.
  - Authorization rules strictly enforce who can modify which users and which fields (NN_ADMIN has broader scope than VENDOR_ADMIN). Role transitions are validated.
  - Endpoint allows updating role, is_lawyer, is_active.
  - Changes are reflected in the database and audited (REQ-SEC-AUDIT-001).
  - Validation correctly blocks deactivation of team owners until reassignment.
  - Tasks of a deactivated user are correctly unassigned, and notifications for reassignment are triggered (mechanism TBD, could be in-app or email).
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, OWASP A01:2021-Broken Access Control, Data Integrity, OAS 3.x

**REQ-USER-006**

- **Requirement Type:** Data, Security
- **Description:** All Personally Identifiable Information (PII) fields within the Users table (e.g., email, first_name) MUST be encrypted at rest in the database using a strong, standard algorithm (e.g., AES-256). Key management procedures MUST be defined and followed.
- **Rationale:** Protects sensitive user data from unauthorized access even if the database is compromised. Required by privacy regulations.
- **Acceptance Criteria:**
  - Specified PII fields are stored encrypted in the database.
  - Data can be decrypted by the application for authorized use.
  - Key management strategy is documented.
-
- **Priority:** Must Have
- **Standard/Reference:** GDPR Art. 32, CCPA, Data Encryption Standards (AES-256)

**REQ-USER-007**

- **Requirement Type:** Functional, API
- **Description:** An API endpoint MUST exist for users to retrieve their own profile information (GET /users/me). The returned data MUST only include non-sensitive fields necessary for the user interface (e.g., name, email, role, company name, lawyer status).
- **Rationale:** Allows users to view their own basic profile details.
- **Acceptance Criteria:**
  - GET /users/me endpoint exists.
  - Returns profile information for the authenticated user.
  - Does not expose sensitive internal IDs or unnecessary PII.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** OAS 3.x
