**Module: Authorization Model (RBAC \+ ABAC)**

This section summarizes and formalizes the access control rules based on Roles (RBAC) and Attributes (ABAC \- primarily company_id, team_id, is_owner, is_member, task_assignment, resource_sensitivity).

**REQ-AUTHZ-001**

- **Requirement Type:** Security, Architecture
- **Description:** The system's authorization model MUST implement Role-Based Access Control (RBAC) based on the defined user roles (CLIENT, VENDOR_EMPLOYEE, VENDOR_MANAGER, VENDOR_ADMIN, NN_EMPLOYEE, NN_MANAGER, NN_ADMIN). It MUST also incorporate Attribute-Based Access Control (ABAC) elements to enforce context-specific permissions (e.g., access restricted to own company, own team, assigned tasks, specific resource attributes like 'LEGAL' category or 'Lawyer Required' task).
- **Rationale:** Provides a flexible and fine-grained authorization mechanism suitable for the complex relationships between users, companies, teams, petitions, and tasks.
- **Acceptance Criteria:**
  - Authorization logic checks both the user's role and relevant attributes (company affiliation, team ownership/membership, task assignment) before granting access to resources or actions.
  - Access control rules are consistently applied across all relevant API endpoints.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC NIST Model, ABAC NIST Guide SP 800-162

**REQ-AUTHZ-002**

- **Requirement Type:** Security, Access Control
- **Description:** Define specific permissions and map them to roles and attributes:
  - **(User, Company, Team Management permissions as previously defined in the file \- review these for completeness based on final APIs)**
  - **Petition Template Management:**
    - MANAGE_PETITION_TEMPLATES (CRUD, Publish, Archive, Manage all sub-components like Tabs, Criteria, Plans, Document-TaskModel associations): NN_ADMIN only.
  -
  - **Data Point Management:**
    - MANAGE_DATAPOINTS: DEVELOPER or designated ADMIN (based on DataPoints.managed_by).
  -
  - **Document Type & Preset Management:**
    - MANAGE_DOCTYPES_PRESETS: DEVELOPER (based on managed_by).
  -
  - **Task Model Management:**
    - MANAGE_TASKMODELS: DEVELOPER or ADMIN (based on TaskModels.managed_by).
  -
  - **Benefit Management:**
    - MANAGE_BENEFITS: DEVELOPER or ADMIN (based on Benefits.managed_by).
  -
  - **Petition Instance & Task Instance Management:**
    - CREATE_PETITION_INSTANCE: CLIENT (attribute: own user, app flavor context).
    - READ_OWN_PETITION_INSTANCE: CLIENT (attribute: PetitionInstances.client_user_id \== self).
    - READ_COMPANY_PETITION_INSTANCES: VENDOR_ADMIN, VENDOR_MANAGER, NN_ADMIN (attribute: PetitionInstances.company_id scope). VENDOR_EMPLOYEE, NN_EMPLOYEE if assigned to a task within.
    - SUBMIT_ROOT_FORM_TASK: CLIENT (attribute: task assigned to self, part of own petition).
    - READ_TASK_INSTANCE_DETAILS:
      - CLIENT: If task is part of their petition.
      - NN/VENDOR_EMPLOYEE/MANAGER: If task is assigned to them, or to their team, or part of a petition in their company/team scope.
      - NN_ADMIN: Any task.
    -
    - SUBMIT_TASK_INPUT: CLIENT (if current step assigned to client), NN/VENDOR_EMPLOYEE/MANAGER (if current step assigned to them/team).
    - REVIEW_TASK_SUBMISSION (Approve/Reject): NN/VENDOR_EMPLOYEE/MANAGER (if review step assigned to them/team, respecting is_lawyer for lawyer-only steps).
    - ADD_TASK_COMMENT: CLIENT (on own petition's tasks), NN/VENDOR_EMPLOYEE/MANAGER (on tasks they can access).
    - REASSIGN_TASK_INSTANCE: NN_MANAGER, VENDOR_MANAGER (within own team/company), NN_ADMIN (any task).
    - UPGRADE_TASK_INSTANCE: CLIENT (for own tasks), potentially NN/VENDOR_MANAGER/ADMIN (if business rule allows).
    - PURCHASE_ADDON: CLIENT (for own petitions).
    - DOWNLOAD_COMPILED_PETITION: CLIENT (own petition), NN/VENDOR_EMPLOYEE/MANAGER/ADMIN (scoped to company/assignment).
    - UPDATE_FILING_PROGRESS: NN/VENDOR_EMPLOYEE/MANAGER (assigned to filing).
    - ADD_PETITION_UPDATE: CLIENT (own petition), NN/VENDOR_EMPLOYEE/MANAGER/ADMIN (scoped).
  -
-
- **Rationale:** Explicitly documents the permissions for all new functionalities. Forms the basis for implementation and testing of the authorization layer.
- **Acceptance Criteria:**
  - Authorization middleware/logic accurately implements these permission checks for corresponding API endpoints.
  - Unit and integration tests verify that users with different roles and attributes can/cannot perform specific actions according to this matrix.
  - Attempts to perform unauthorized actions result in HTTP 403 Forbidden responses.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, ABAC, OWASP A01:2021-Broken Access Control

**REQ-AUTHZ-003**

- **Requirement Type:** Security, Access Control
- **Description:** Authorization checks MUST be performed on the server-side within the API layer. The client application MUST NOT be relied upon to enforce authorization rules, only to potentially hide UI elements based on user role/permissions provided by the backend.
- **Rationale:** Prevents malicious users from bypassing client-side UI restrictions and directly calling APIs they shouldn't have access to. Security enforcement must happen at the resource server.
- **Acceptance Criteria:**
  - All API endpoints implementing actions or accessing sensitive data have server-side authorization checks.
  - Security testing confirms that API calls are rejected based on server-side rules, even if crafted manually (e.g., using tools like Postman or curl).
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A01:2021-Broken Access Control, Secure Design Principles
