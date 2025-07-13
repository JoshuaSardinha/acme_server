**Module: Task Instance Lifecycle, Statuses & Steps**

**REQ-TASKINST-LIFE-001**

- **Requirement Type:** Functional
- **Description:** Task Instances MUST progress through a defined set of statuses. The primary statuses are:
  - LOCKED: The task cannot be started yet as its prerequisite tasks/steps are not complete.
  - OPEN: All prerequisites are met, and the task is ready for input/action by the assigned party (Client or Team member).
  - IN_PROGRESS_CLIENT: The Client has started providing input or working on the task.
  - IN_PROGRESS_TEAM: An internal (NN/Vendor) team member has started working on the task (e.g., review, drafting).
  - PENDING_REVIEW: The Client has submitted their input, and it's awaiting review by the assigned team member. (Replaces 'IN_REVIEW' for clarity of whose court the ball is in).
  - COMPLETED: All steps for the task are finished, and the final output (if any) is stored. This makes its output DataPoints available for dependent tasks.
  - RETURNED_TO_CLIENT: A team member has reviewed client input and found issues, returning the task to the client with feedback for revisions. Status effectively reverts to OPEN or IN_PROGRESS_CLIENT for the client.
  - CANCELED: An optional task that was not needed or explicitly canceled by the client or an authorized employee.
  - INVALIDATED: The task was determined to be not applicable based on root form data (evaluation of invalidation_condition). These tasks are effectively skipped.
-
- **Rationale:** Defines a clear lifecycle for tasks, indicating their state and who is responsible for the next action.
- **Acceptance Criteria:**
  - The defined statuses are implemented and used consistently.
  - Transitions between statuses are governed by specific actions/events.
-
- **Priority:** Must Have
- **Standard/Reference:** Workflow Management

**REQ-TASKINST-LIFE-002**

- **Requirement Type:** Functional, Server-Side Logic
- **Description:** The system MUST manage task step progression for each TaskInstance. When a step is completed:
  - The TaskInstance.current_step_number is updated to the success_target_step_number defined in the TaskModelSteps.
  - If the step involved input validation and failed, current_step_number is updated to the failure_target_step_number.
  - If the new current_step_number corresponds to a step assigned to a different role (e.g., Client completes input, next step is Team review), the task status updates accordingly (e.g., to PENDING_REVIEW).
  - If the final step of the Task Model is completed successfully, the TaskInstance.status is set to COMPLETED. The system then MUST check for any dependent tasks (via PlanTaskGraphEdges for the petition's plan) and transition their status from LOCKED to OPEN if all their prerequisites are now COMPLETED.
-
- **Rationale:** Automates the flow through a task's defined steps and triggers the unlocking of subsequent tasks in the overall petition graph.
- **Acceptance Criteria:**
  - Step completion correctly updates current_step_number.
  - Task status changes appropriately based on new step's assignee.
  - Completion of the final step sets task status to COMPLETED.
  - Dependent tasks are correctly transitioned to OPEN when all their prerequisites are met.
-
- **Priority:** Must Have
- **Standard/Reference:** Workflow Automation, DAG Traversal

**REQ-TASKINST-LIFE-003**

- **Requirement Type:** Functional, API
- **Description:** API endpoints MUST exist for users to interact with tasks assigned to them, facilitating step progression and status changes:
  - POST /v1/tasks/{taskInstanceId}/start: Allows a user (Client or Team member) to signal they are beginning work on an 'OPEN' task, changing its status to IN_PROGRESS_CLIENT or IN_PROGRESS_TEAM.
  - POST /v1/tasks/{taskInstanceId}/steps/{stepNumber}/submit-input: Client/Employee submits data for the current input step. (Data saved to TaskInstanceData as per REQ-TASKINST-INTERACT-001). Triggers progression to next step (validation or completion).
  - POST /v1/tasks/{taskInstanceId}/steps/{stepNumber}/approve-review: Team member approves a review step. Triggers progression.
  - POST /v1/tasks/{taskInstanceId}/steps/{stepNumber}/reject-review: Team member rejects a review step. Triggers progression to failure step (often back to client input) and requires feedback (REQ-TASKINST-INTERACT-003).
  - POST /v1/tasks/{taskInstanceId}/cancel: Client/Employee cancels an optional, open task. Status changes to CANCELED.
-
- **Rationale:** Provides the necessary API calls for users to perform actions on tasks, driving the workflow.
- **Acceptance Criteria:**
  - Specified endpoints exist, perform described actions, and update task/step status.
  - Authorization restricts endpoint access to the currently assigned user/role for the task/step.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** REST Principles, Workflow APIs, OAS 3.x
