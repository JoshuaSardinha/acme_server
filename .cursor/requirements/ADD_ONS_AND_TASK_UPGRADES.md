**Module: Add-ons & Task Upgrades**

**REQ-ADDON-001**

- **Requirement Type:** Functional, Data
- **Description:**
  - When a client is selecting add-ons for a petition (associated with a specific template_id and chosen plan_id):
    - Available add-ons are determined by querying PetitionTemplateAvailableAddons for the template_id.
    - From this list, filter out any Benefit that is already included in the client's chosen plan (by checking PlanIncludedBenefits for the plan_id).
  - A PetitionInstanceBenefits table tracks all benefits active for a PetitionInstance. Each record includes id, petition_instance_id (FK), benefit_id (FK), source (Enum: 'PLAN_INCLUDED', 'ADDON_PURCHASED'), purchase_date (if ADDON_PURCHASED), cost_paid (if ADDON_PURCHASED).
  - **Benefit Task Instantiation:** If an acquired Benefit (either from PLAN_INCLUDED or ADDON_PURCHASED) has is_task_triggering \= true and a triggered_task_model_id:
    - A new TaskInstance MUST be created for the PetitionInstance using this triggered_task_model_id.
    - These benefit-triggered tasks are distinct from the main document-driven task graph.
- **Rationale:** Clarifies how the list of purchasable add-ons is derived and how all acquired benefits (plan-included or purchased) are tracked and trigger tasks.
- **Acceptance Criteria:**
  - Logic correctly determines available add-ons for purchase by comparing PetitionTemplateAvailableAddons with PlanIncludedBenefits for the selected plan.
  - PetitionInstanceBenefits table accurately tracks all acquired benefits and their source.
  - Acquiring any task-triggering benefit (regardless of source) correctly creates its associated TaskInstance.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-ADDON-002**

- **Requirement Type:** Functional, API
- **Description:**
  - GET /v1/petition-templates/{templateId}/plans/{planId}/purchasable-addons: New endpoint (or modified existing one) to list Benefits that can be purchased as add-ons _specifically for a given template and chosen plan_. This endpoint internally performs the logic from REQ-ADDON-001.1.
  - Client petition creation flow allows selection of these purchasable add-ons after plan selection, before final payment.
  - The POST /v1/petitions/initiate-checkout (or similar) API takes template_id, plan_id, and an array of selected addon_benefit_ids (which are the benefit_ids of the chosen purchasable add-ons).
  - This endpoint calculates total cost (plan_cost \+ sum of selected add-on_benefit_costs from Benefits.cost).
  - Upon successful payment:
    - PetitionInstance is created.
    - Benefits from the plan (via PlanIncludedBenefits) are recorded in PetitionInstanceBenefits with source 'PLAN_INCLUDED'.
    - Purchased add-on benefits are recorded in PetitionInstanceBenefits with source 'ADDON_PURCHASED' and cost paid.
    - All relevant benefit-triggered tasks are created.
    - Root Form task is generated.
  -
-
- **Rationale:** Integrates add-on selection into the initial petition setup flow, allowing for a single checkout transaction.
- **Acceptance Criteria:**
  - New API endpoint correctly lists purchasable add-ons for a specific plan context.
  - Client flow allows selection.
  - Checkout API calculates total cost correctly.
  - Successful payment correctly populates PetitionInstanceBenefits distinguishing plan-included vs. purchased add-ons.
  - All relevant tasks (benefit-triggered and root form) are created.
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** E-commerce Checkout Flow Best Practices

**REQ-ADDON-003**

- **Requirement Type:** Functional, Data
- **Description:** Some Benefits (add-ons or plan-included) MAY trigger the creation of new TaskInstances or modify existing ones. The definition of how a Benefit impacts tasks MUST be configurable (e.g., a BenefitTaskTriggers table linking benefit_id to task_model_id to be added, or specifying a target document_type_preset_id for which an existing task's model should be upgraded).
- **Rationale:** Connects the acquisition of benefits to concrete changes in the petition's workflow.
- **Acceptance Criteria:**
  - Mechanism exists to define task-related outcomes of acquiring a benefit.
  - Acquiring such a benefit triggers the appropriate task creation or modification.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-ADDON-POST-001**

- **Requirement Type:** Functional, API, Data
- **Description:** Clients MUST be able to purchase additional Benefits (add-ons) for an _existing, active_ PetitionInstance.
  - **Available Add-ons API:** An endpoint GET /v1/petitions/{petitionInstanceId}/available-purchase-addons MUST list Benefits that can be purchased. This list is derived by:
    - Taking all Benefits linked to the petition's PetitionTemplate.id via PetitionTemplateAvailableAddons.
    - Filtering out any Benefit.id that already exists for this petition_instance_id in the PetitionInstanceBenefits table.  
      The response should include benefit name, description, and Benefits.cost.
  -
  - **Purchase API:** An endpoint POST /v1/petitions/{petitionInstanceId}/purchase-addons allows a client to select one or more available add-ons. Request includes an array of benefit_ids.
    - Calculates total cost of selected add-ons.
    - Integrates with a payment gateway if total cost \> 0\.
    - Upon successful payment (or if free):
      - For each purchased benefit_id, a new record is added to PetitionInstanceBenefits with source \= 'ADDON_PURCHASED_POST_CREATION', cost_paid, and purchase_date.
      - If any purchased benefit has Benefits.is_task_triggering \= true, the corresponding TaskInstance(s) (linked via BenefitTriggeredTaskModels) are created for the PetitionInstance (as per logic in REQ-PETI-003.4 & .5 for data placeholders and status).
    -
  -
-
- **Rationale:** Provides clients the flexibility to add services to their active petition after initial setup. This complements the initial add-on selection.
- **Acceptance Criteria:**
  - GET /v1/petitions/{petitionInstanceId}/available-purchase-addons correctly lists purchasable add-ons.
  - POST /v1/petitions/{petitionInstanceId}/purchase-addons endpoint processes selection, handles payment, updates PetitionInstanceBenefits, and triggers new task instantiation for task-triggering benefits.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** E-commerce, REST Principles, OAS 3.x

**REQ-ADDON-BENEFIT-EFFECT-001 (Consolidating REQ-ADDON-003 from file)**

- **Requirement Type:** Functional, Server-Side Logic
- **Description:** Whenever a Benefit is associated with a PetitionInstance (either through plan inclusion at petition creation, initial add-on purchase via REQ-PETI-ORDER-001, or post-creation add-on purchase via REQ-ADDON-POST-001), if that Benefit.is_task_triggering is true, the system MUST instantiate the corresponding TaskModel(s) as defined in BenefitTriggeredTaskModels (REQ-PTMPL-BEN-TASKLINK-001).
  - These new TaskInstance(s) are linked to the PetitionInstance.
  - Placeholder TaskInstanceData rows are created.
  - Initial status ('OPEN' or 'LOCKED') is set based on their TaskModel's input requirements (if they depend on root form data or other prerequisites).
-
- **Rationale:** Ensures that acquiring a benefit, irrespective of timing, consistently triggers its associated tasks in the workflow.
- **Acceptance Criteria:**
  - Acquisition of any task-triggering benefit correctly and consistently creates its associated TaskInstance(s) with appropriate data placeholders and initial status.
-
- **Priority:** Must Have
- **Standard/Reference:** Workflow Automation

**REQ-TASKUPG-001**

- **Requirement Type:** Functional, Data
- **Description:** The system MUST allow clients or authorized team members to "upgrade" an existing TaskInstance to use a different, typically more comprehensive or assisted, TaskModel. An upgrade is only possible if:
  - The target TaskModel is for the _same_ DocumentTypePreset as the current task.
  - The target TaskModel has a cost greater than the current task's TaskModel.cost.
  - The current task is in an appropriate status (e.g., 'OPEN', 'IN_PROGRESS_CLIENT', 'RETURNED_TO_CLIENT').
-
- **Rationale:** Allows users to opt for more assistance on specific tasks even after starting the petition.
- **Acceptance Criteria:**
  - Logic correctly identifies valid upgrade paths for a task instance.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-TASKUPG-002**

- **Requirement Type:** Functional, API
- **Description:** API endpoints MUST exist for task upgrades:
  - GET /v1/tasks/{taskInstanceId}/available-upgrades: Lists available TaskModels (name, description, additional cost) that the specified task instance can be upgraded to.
  - POST /v1/tasks/{taskInstanceId}/upgrade: Allows a client to select and initiate purchase of a task upgrade. Requires target task_model_id. Integrates with a payment gateway for the cost difference. Upon successful payment:
    - The TaskInstance.task_model_id is updated.
    - The TaskInstance.current_step_number MAY be reset to the first step of the new model, or intelligently mapped if possible. Existing TaskInstanceData relevant to the new model should be preserved. New placeholder TaskInstanceData rows for additional inputs/outputs of the new model MUST be created.
    - The task status may need adjustment (e.g., back to 'OPEN').
  -
-
- **Rationale:** Provides interface for upgrading tasks and handles associated payment and state changes.
- **Acceptance Criteria:**
  - Endpoints exist and function as described.
  - Payment integration handles cost difference.
  - TaskInstance is updated correctly (model, step, status).
  - TaskInstanceData is appropriately adjusted/extended for the new model.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** Payment Gateway Integration, REST Principles, OAS 3.x
