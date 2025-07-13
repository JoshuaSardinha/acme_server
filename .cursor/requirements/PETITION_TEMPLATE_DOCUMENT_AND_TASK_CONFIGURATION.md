**Module: Petition Template Document & Task Configuration**

**REQ-PTMPL-DOC-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist the association between template tabs and document presets in PetitionTemplateTabDocuments. Each record MUST include:
  - id (Primary Key)
  - tab_id (FK to PetitionTemplateTabs, NOT NULL)
  - document_type_preset_id (FK to DocumentTypePresets, NOT NULL)
  - is_required (Boolean, default: true) \- Is this document generally mandatory for the petition (can still be invalidated by condition)?
  - invalidation_condition (TEXT, nullable) \- Condition string evaluated _after_ root form submission. If true, the corresponding Task Instance is marked is_invalidated. Condition string using DataPoints.system_name as variables. Can apply to both required and optional documents.
  - multiplicity_condition (TEXT, nullable) \- Condition string evaluated _after_ root form submission. Determines the number of instances/documents required for the task (e.g., returns numberOfChildren). If null or evaluates non-numerically, defaults to 1\. Condition string using DataPoints.system_name as variables.
-
- **Rationale:** Defines _what_ documents _potentially_ belong in each tab, whether they are fundamentally required or optional, and the conditions (based on root form data) that determine their final validity and quantity for a specific petition instance. Replaces condition_logic and allow_multiple.
- **Acceptance Criteria:**
  - Database schema includes PetitionTemplateTabDocuments table with revised fields.
  - condition_logic and allow_multiple fields are removed/replaced.
  - Format/syntax for condition strings is defined and validated..
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-PTMPL-DOC-002**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints for managing PetitionTemplateTabDocuments (POST, GET, PATCH, DELETE under /v1/petition-templates/{templateId}/tabs/{tabId}/documents) MUST now validate that variables used in invalidation_condition and multiplicity_condition strings correspond to existing DataPoints.system_name known to the system. The admin UI should facilitate selecting available Data Points when building conditions.
- **Rationale:** Ensures conditions use valid, defined data points.
- **Acceptance Criteria:**
  - API validation checks condition variables against DataPoints.system_name.
  - Admin UI assists in selecting valid data points for conditions.
  - Endpoints and schemas documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, API Validation, OAS 3.x
-

**REQ-PTMPL-TASKASSOC-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist the association between a specific document requirement (within a tab) and the specific Task Model chosen to fulfill it for a specific Plan, in a PlanDocumentTaskModels table. Each record MUST include:
  - id (Primary Key)
  - plan_id (FK to PetitionTemplatePlans, NOT NULL)
  - tab_document_id (FK to PetitionTemplateTabDocuments, NOT NULL) \- Links to the specific document requirement in a tab.
  - task_model_id (FK to TaskModels, NOT NULL) \- The chosen task model for this doc, under this plan.
-
- **Rationale:** This is the crucial link defining _how_ a document requirement is met for each service plan (e.g., Free plan uses "Basic Upload", Premium plan uses "Attorney Assisted Drafting" for the same required document).
- **Acceptance Criteria:**
  - Database schema includes PlanDocumentTaskModels table.
  - A unique constraint MUST exist on (plan_id, tab_document_id) to ensure only one task model is assigned per document requirement per plan.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-PTMPL-TASKASSOC-002**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for NN Admins (NN_ADMIN) to associate Task Models with document requirements for each plan within a 'DRAFT' Petition Template:
  - PUT /v1/petition-templates/{templateId}/plans/{planId}/document-task-models: (Bulk endpoint recommended) Accepts a list of mappings \[{ "tab_document_id": "...", "task_model_id": "..." }, ...\]. This assigns or updates the Task Model for each document requirement under the specified plan. The backend MUST validate that the chosen task_model_id corresponds to the document_type_preset_id defined in the referenced tab_document_id.
  - GET /v1/petition-templates/{templateId}/plans/{planId}/document-task-models: Retrieve the current Task Model assignments for all document requirements under the specified plan.
-
- **Rationale:** Allows NN Admins to configure the specific tasks that will be generated for clients based on their chosen plan.
- **Acceptance Criteria:**
  - Specified endpoints exist and function as described.
  - Only NN Admins can access for 'DRAFT' templates.
  - Validation ensures the Task Model matches the required Document Type Preset.
  - Endpoints correctly manage the PlanDocumentTaskModels associations.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, REST Principles, OAS 3.x

**REQ-PTMPL-VALIDATE-001**

- **Requirement Type:** Functional, Constraint, Server-Side Logic, Admin UI Interaction
- **Description:** Before a Petition Template can be 'PUBLISHED' (via POST /v1/petition-templates/{templateId}/publish), or when an admin explicitly triggers "Save & Validate" for a 'DRAFT' template, the system MUST perform comprehensive validation:
  - **Basic Template Checks:**
    - name and petition_type_id MUST be present.
    - At least one PetitionTemplatePlan MUST be defined (REQ-PTMPL-PLAN-004).
  -
  - **Root Form Definition Check:**
    - The unified Root Form definition (PetitionTemplateRootFormFields) MUST have been successfully calculated (REQ-GRAPH-ROOTFORM-CALC-001).
    - All DataPoints referenced in this root form definition MUST exist and be valid.
  -
  - **Condition Validation (across all PetitionTemplateTabDocuments):**
    - invalidation_condition and multiplicity_condition strings (if present) MUST have valid syntax.
    - All DataPoints.system_name variables used in these conditions MUST correspond to DataPoints included in the Unified Root Form definition or be derivable as outputs from tasks that would precede the condition's evaluation context (this latter check is complex and might be simplified to only allow root form variables in these specific conditions). **Decision:** For invalidation_condition and multiplicity_condition on PetitionTemplateTabDocuments, variables MUST come from the Unified Root Form.
  -
  - **Per-Plan Configuration & Graph Validation (Iterate for each Plan of the Template):**  
    a. **Task Model Assignments:** Every PetitionTemplateTabDocument that is is_required=true (or potentially active based on non-root-form conditions, if any) MUST have a TaskModel assigned to it for the current plan via PlanDocumentTaskModels. The assigned TaskModel.document_type_preset_id MUST match the PetitionTemplateTabDocument.document_type_preset_id.  
    b. **Graph Calculation:** The potential task graph for this plan (nodes and edges) MUST be successfully calculated and stored as per REQ-GRAPH-CALC-001 (PlanTaskGraphNodes, PlanTaskGraphEdges).  
    c. **Dependency Resolution (Unconnected Evidence-Based Inputs):**  
    i. Identify all required (is_required_input=true), evidence-based (is_evidence_based=true) INPUT DataPoints for all PlanTaskGraphNodes in this plan's graph.  
    ii. Verify that each such input DataPoint has a corresponding OUTPUT DataPoint (matching data_point_id) produced by another PlanTaskGraphNode in the same plan (via a defined PlanTaskGraphEdge) or by a DataPoint collected in the Unified Root Form.  
    iii. **If Unconnected Inputs Exist:**  
    \* The overall validation fails. The template cannot be published.  
    \* The system MUST provide feedback to the NN Admin listing the specific unconnected INPUT DataPoints and for which plan(s) they are problematic.  
    \* The admin UI MUST then guide the admin to resolve these by adding "Admin-Added Root Tasks" for this plan: Select a DocumentTypePreset that can produce the missing output, then select a compatible TaskModel. This creates a new PlanTaskGraphNode (source_type 'ADMIN_ADDED_ROOT_TASK') for _this specific plan_.  
    \* The graph calculation (4b) and dependency resolution (4c) for this plan MUST be re-run. This process is iterative until all required evidence-based inputs for this plan are connected.
  - **Final Check:** The template is considered valid for publishing only if all above checks pass for the template itself and for _all_ its associated plans.
-
- **Rationale:** Ensures published templates are complete, structurally sound, logically consistent, and that all data dependencies within every plan's workflow are resolvable. Provides an interactive way for admins to fix dependency gaps. This is the primary gatekeeper for template quality.
- **Acceptance Criteria:**
  - Validation logic is triggered by "Publish" or "Save & Validate" actions.
  - All specified checks (basic, root form, conditions, per-plan assignments, per-plan graph completeness) are executed.
  - If unconnected evidence-based inputs are found for any plan, the publish/validation fails, and the admin is guided through adding necessary source tasks for that plan.
  - A template can only be published if all checks pass successfully for the template and all its plans.
  - Clear error messages are provided for any validation failure.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Integrity, DAG Validation, Interactive Configuration

---
