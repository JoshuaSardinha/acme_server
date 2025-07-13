**Module: Task Models**

**REQ-TASKM-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist task model definitions in a TaskModels table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - name (TEXT, Task model name, Unique, NOT NULL)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Rich overall description/instructions for the task, visible to clients/users.
  - document_type_preset_id (UUID, FK to DocumentTypePresets.id, NOT NULL)
  - cost (DECIMAL, additional cost for this model, NOT NULL)
  - requires_lawyer_assignment (Boolean, default: false, NOT NULL)
  - managed_by (Enum: 'DEVELOPER', 'ADMIN', NOT NULL)
  - created_at, updated_at
-
- **Rationale:** Defines task templates. Uses ContentBlocks for rich task descriptions.
- **Acceptance Criteria:** Schema exists. Admins/Devs can associate ContentBlock for description.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-TASKM-002**

- **Requirement Type:** Data
- **Description:** The system MUST persist the steps associated with each Task Model in a TaskModelSteps table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - task_model_id (UUID, FK to TaskModels.id, NOT NULL)
  - step_number (Integer, NOT NULL, defining order within model)
  - name (TEXT, Step name/title, NOT NULL)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Rich instructions specific to this step.
  - step_type (Enum: 'CLIENT_INPUT', 'VALIDATION_AUTO', 'VALIDATION_MANUAL', 'OUTPUT_GENERATION', 'OUTPUT_ASSIGNMENT', NOT NULL)
  - assigned_role (Enum: 'CLIENT', 'EMPLOYEE', 'MANAGER', 'LAWYER', 'AI', 'SYSTEM', NOT NULL)
  - deadline_duration_days (Integer, Nullable)
  - success_target_step_number (Integer, NOT NULL)
  - failure_target_step_number (Integer, Nullable)
  - ai_process_id (UUID, Nullable FK to AIProcesses.id)
-
- **Rationale:** Defines task workflow steps. Uses ContentBlocks for rich step-specific instructions.
- **Acceptance Criteria:** Schema exists. Admins/Devs can associate ContentBlock for step descriptions.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-TASKM-003**

- **Requirement Type:** Data
- **Description:** The system MUST define the specific data points that each Task Model _requires as input_ OR _produces as output_ using a TaskModelDataPointLinks table. This allows task models to specify exact I/O needs, including extra outputs. Each record MUST include:
  - id (Primary Key)
  - task_model_id (FK to TaskModels, NOT NULL)
  - data_point_id (FK to DataPoints, NOT NULL)
  - direction (Enum: 'INPUT', 'OUTPUT') \- Does this model REQUIRE this input or PRODUCE this output?
  - is*required_input (Boolean, nullable) \- If direction is 'INPUT', is it mandatory \_for this specific model*?
  - is_separate_request (Boolean, nullable) \- If direction is 'INPUT', collect within this task?
  - is_evidence_based (Boolean, nullable) \- If direction is 'INPUT', must it come from another task's output?
-
- **Rationale:** Provides a single mechanism for Task Models to declare their precise data dependencies (inputs) and deliverables (outputs), referencing the central DataPoints definitions. Allows different models for the same preset to have varying I/O. Replaces TaskModelInputs.
- **Acceptance Criteria:**
  - Database schema includes TaskModelDataPointLinks table.
  - Allows linking task models to specific Data Points for both input and output.
  - Input-specific flags (is_required_input, is_separate_request, is_evidence_based) are defined.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-TASKM-004**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for managing TaskModels. Endpoints for managing associated data points (TaskModelDataPointLinks) MUST be provided:
  - GET /v1/task-models/{modelId}/datapoints: List associated input and output data points for the model.
  - POST /v1/task-models/{modelId}/datapoints: Associate a DataPoint with the model (specifying direction and input-specific flags). Requires data_point_id, direction, etc.
  - PATCH /v1/task-models/{modelId}/datapoints/{linkId}: Update the details of an association (e.g., change is_required_input).
  - DELETE /v1/task-models/{modelId}/datapoints/{linkId}: Remove an association.
  - Other Task Model endpoints (POST, GET, PATCH, DELETE) remain as previously defined. Step management APIs also remain.
-
- **Rationale:** Provides API interface for defining the specific inputs and outputs of each task model.
- **Acceptance Criteria:**
  - Specified endpoints exist and function.
  - API payloads correctly handle TaskModelDataPointLinks definition.
  - Authorization appropriately restricts access.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, REST Principles, OAS 3.x
