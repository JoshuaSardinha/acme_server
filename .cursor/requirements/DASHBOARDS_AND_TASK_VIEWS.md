**Module: Dashboards & Task Views**

**REQ-DASH-001 (Client Dashboard)**

- **Requirement Type:** Functional, API
- **Description:** Logged-in Clients (CLIENT role) MUST see a dashboard displaying:
  - A list of their active PetitionInstances (status 'IN_PROGRESS').
  - For each petition, a summary of currently 'OPEN' or IN_PROGRESS_CLIENT tasks assigned to them, or tasks RETURNED_TO_CLIENT.
  - A clear call to action to start a new petition if no active ones exist.
-
- **Rationale:** Provides clients with an overview of their ongoing applications and pending actions.
- **Acceptance Criteria:**
  - API endpoint (GET /v1/client/dashboard or similar) provides the necessary data.
  - Client UI renders the dashboard as described.
  - Data is filtered to the current client's petitions and tasks.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-DASH-002 (Employee/Manager Dashboard)**

- **Requirement Type:** Functional, API
- **Description:** Logged-in Employees/Managers (NN or Vendor) MUST see a dashboard displaying tasks relevant to them:
  - NN_EMPLOYEE/VENDOR_EMPLOYEE: Tasks directly assigned to them (TaskInstances.assigned_user_id \= currentUser.id) that are 'OPEN' or 'IN_PROGRESS_TEAM' or PENDING_REVIEW.
  - NN_MANAGER/VENDOR_MANAGER:
    - Their own assigned tasks (as above).
    - Tasks assigned to members of teams they own (TaskInstances.assigned_team_id in their owned teams AND TaskInstance.status is 'OPEN', 'IN_PROGRESS_TEAM', or PENDING_REVIEW).
    - Ability to filter tasks by team member, due date, status.
  -
-
- **Rationale:** Provides internal users with a view of their workload and, for managers, their team's workload.
- **Acceptance Criteria:**
  - API endpoint (GET /v1/team/dashboard or similar) provides task data based on user role, assignments, and team ownership.
  - Dashboard UI renders tasks according to role-specific views.
  - Filtering capabilities are implemented.
  - Authorization ensures users only see tasks they are permitted to see based on REQ-AUTHZ-002.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-DASH-003 (Admin Dashboard)**

- **Requirement Type:** Functional, API
- **Description:** Logged-in Admins (NN or Vendor) MUST see a dashboard with broader task visibility:
  - VENDOR_ADMIN: All tasks within their company, filterable by status, employee, manager, team, due date.
  - NN_ADMIN: All tasks across all companies, filterable by company, status, employee, manager, team, due date.
-
- **Rationale:** Provides admins with oversight capabilities.
- **Acceptance Criteria:**
  - API endpoint (GET /v1/admin/dashboard/tasks or similar) provides comprehensive task data based on admin role and company scope.
  - Dashboard UI allows extensive filtering.
  - Authorization enforced.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-DASH-004 (Task Assignment/Reassignment)**

- **Requirement Type:** Functional, API
- **Description:**
  - Tasks are initially auto-assigned to a team (or client) based on TaskModelStep.assigned_role. For team-assigned steps, a specific user assignment within the team might be round-robin, least-loaded, or unassigned initially.
  - Managers (NN_MANAGER, VENDOR_MANAGER) MUST be able to reassign tasks (change TaskInstances.assigned_user_id) that are currently assigned to their team or a member of their team, to another member of their team (respecting requires_lawyer_assignment on the Task Model).
  - Admins (NN_ADMIN, VENDOR_ADMIN) MUST be able to reassign tasks within their scope similarly.
-
- **Rationale:** Allows for load balancing and management of task distribution within teams.
- **Acceptance Criteria:**
  - API endpoint (PATCH /v1/tasks/{taskInstanceId}/assign) allows updating assigned_user_id.
  - Authorization restricts reassignment based on manager/admin role and team/company scope.
  - Validation ensures new assignee is eligible (e.g., lawyer status if required).
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, ABAC

**REQ-DASH-005**

- **Requirement Type:** Functional, UI
- **Description:** When a client views the list of tasks for a specific petition (as in "Task List for a Petition Screen" mockup), in addition to tasks grouped by "Your Turn," "In Review," and "Completed," the UI SHOULD also display tasks that are currently 'LOCKED'.
  - Locked tasks should be visually distinct (e.g., greyed out, lock icon) and clearly indicate they are not yet actionable.
  - Displaying locked tasks provides the client with a full overview of the petition's scope and upcoming work.
-
- **Rationale:** Improves transparency for the client by showing the entire remaining workflow, not just immediately actionable items.
- **Acceptance Criteria:**
  - The API providing tasks for the petition task list includes 'LOCKED' tasks.
  - The client UI displays a section for "Upcoming" or "Locked" tasks, visually differentiated from actionable tasks.
  - Locked tasks are not interactive for input submission but might allow viewing their description.
-
- **Priority:** Should Have
- **Standard/Reference:** User Experience, Transparency
