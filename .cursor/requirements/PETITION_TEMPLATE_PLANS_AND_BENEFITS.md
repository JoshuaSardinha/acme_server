**Module: Petition Template Plans & Benefits**

**REQ-PTMPL-BEN-001**

- **Requirement Type:** Data
- **Description:** The system MUST have a Benefits table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - name (TEXT, Benefit name, Unique, NOT NULL)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Rich description of the benefit.
  - cost (DECIMAL, Cost if purchased as a standalone add-on, NOT NULL)
  - is_task_triggering (Boolean, default: false, NOT NULL)
  - managed_by (Enum: 'DEVELOPER', 'ADMIN', NOT NULL)
-
- **Rationale:** Defines benefits. Uses ContentBlocks for rich descriptions. triggered_task_model_id moved to BenefitTriggeredTaskModels.
- **Acceptance Criteria:** Schema exists. Admins/Devs can associate ContentBlock for description.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling
-

**REQ-PTMPL-BEN-TASKLINK-001 (NEW \- Linking Benefits to Task Models)**

- **Requirement Type:** Data
- **Description:** If a Benefit has is_task_triggering set to true, there MUST be a way to associate it with one or more specific TaskModels that will be instantiated when the benefit is acquired. This is managed via a BenefitTriggeredTaskModels table:
  - id (Primary Key, UUID)
  - benefit_id (FK to Benefits.id, NOT NULL)
  - task_model_id (FK to TaskModels.id, NOT NULL)
  - notes (TEXT, Optional, e.g., "Primary task for this benefit")
-
- **Rationale:** Explicitly defines which Task Model(s) are created when a task-triggering benefit is activated for a petition instance. Addresses the "Benefits translate to tasks" user note.
- **Acceptance Criteria:**
  - Database schema includes BenefitTriggeredTaskModels table.
  - Admin interface allows linking task-triggering benefits to specific task models.
  - A benefit can potentially trigger multiple distinct task models.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-PTMPL-PLAN-INCLUDED-BEN-001**

- **Requirement Type:** Data
- **Description:** A many-to-many relationship MUST exist between PetitionTemplatePlans and Benefits to specify which benefits are included as part of each plan. This MUST be stored in a PlanIncludedBenefits join table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - plan_id (FK to PetitionTemplatePlans.id, NOT NULL)
  - benefit_id (FK to Benefits.id, NOT NULL)
  - Unique constraint on (plan_id, benefit_id).
-
- **Rationale:** Explicitly defines which benefits are intrinsically part of each plan.
- **Acceptance Criteria:** Database schema exists as specified.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling
-

**REQ-PTMPL-TEMPLATE-AVAILABLE-ADDONS-001**

- **Requirement Type:** Data
- **Description:** A many-to-many relationship MUST exist between PetitionTemplates and Benefits to specify which benefits are available to be purchased as add-ons for any petition created from that template. This MUST be stored in a PetitionTemplateAvailableAddons join table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - template_id (FK to PetitionTemplates.id, NOT NULL)
  - benefit_id (FK to Benefits.id, NOT NULL)
  - Unique constraint on (template_id, benefit_id).
-
- **Rationale:** Defines the catalog of all possible add-on benefits for a specific petition template. The actual purchasable list for a client depends on what's already in their chosen plan.
- **Acceptance Criteria:** Database schema exists as specified.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-PTMPL-PLAN-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist template plan definitions in a PetitionTemplatePlans table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - template_id (UUID, FK to PetitionTemplates.id, NOT NULL)
  - name (TEXT, Plan name, NOT NULL, unique per template_id)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Rich description of the plan.
  - cost (DECIMAL, Cost for selecting this plan, NOT NULL)
  - is_free (Boolean, generated as (cost \== 0), NOT NULL)
  - display_order (Integer, NOT NULL)
  - terms_and_conditions_id (UUID, Nullable FK to TermsAndConditions.id)
  - created_at, updated_at
-
- **Rationale:** Defines service tiers. Uses ContentBlocks for rich descriptions.
- **Acceptance Criteria:** Schema exists. Admins can associate ContentBlock for description.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-PTMPL-PLAN-002**

- **Requirement Type:** Data
- **Description:** A many-to-many relationship MUST exist between PetitionTemplatePlans and Benefits via an association table (PlanBenefits). This table links specific benefits included within each plan.
  - plan_benefit_id (Primary Key)
  - plan_id (FK to PetitionTemplatePlans)
  - benefit_id (FK to Benefits)
-
- **Rationale:** Explicitly defines which benefits are part of each plan.
- **Acceptance Criteria:**
  - Database schema includes PlanBenefits association table with specified fields and constraints (unique key on plan_id, benefit_id).
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-PTMPL-PLAN-003**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for NN Admins (NN_ADMIN) to manage plans and benefits associations within a 'DRAFT' Petition Template:
  - **Plan CRUD:**
    - POST /v1/petition-templates/{templateId}/plans: Create a new plan. Requires name, description, cost, display_order. Optionally terms_and_conditions_id.
    - GET /v1/petition-templates/{templateId}/plans: List plans for a template. Response SHOULD include details of their included benefits.
    - GET /v1/petition-templates/{templateId}/plans/{planId}: Get details of a specific plan, including its included benefits.
    - PATCH /v1/petition-templates/{templateId}/plans/{planId}: Update plan details (name, description, cost, display_order, terms_and_conditions_id).
    - DELETE /v1/petition-templates/{templateId}/plans/{planId}: Remove a plan. Must cascade delete associated PlanIncludedBenefits and plan-specific graph definitions (PlanTaskGraphNodes, PlanTaskGraphEdges). Cannot delete the last plan.
  -
  - **Managing Included Benefits for a Plan:**
    - POST /v1/petition-templates/{templateId}/plans/{planId}/included-benefits: Associate an existing Benefit with the specified plan (creates record in PlanIncludedBenefits). Request: {"benefit_id": "..."}.
    - DELETE /v1/petition-templates/{templateId}/plans/{planId}/included-benefits/{benefitId}: Disassociate an included Benefit from the plan.
  -
  - **Managing Available Add-ons for a Template:**
    - POST /v1/petition-templates/{templateId}/available-addons: Mark a Benefit as an available add-on for this template (creates record in PetitionTemplateAvailableAddons). Request: {"benefit_id": "..."}.
    - GET /v1/petition-templates/{templateId}/available-addons: List benefits configured as available add-ons for this template.
    - DELETE /v1/petition-templates/{templateId}/available-addons/{benefitId}: Remove a benefit from the list of available add-ons for this template.
  -
-
- **Rationale:** Provides comprehensive API for admins to define plan structures, what benefits are included in them, and what benefits can be separately purchased as add-ons for the entire template. Addresses user note.
- **Acceptance Criteria:**
  - Specified endpoints exist and function correctly.
  - Authorization restricts access to NN_ADMIN for 'DRAFT' templates.
  - Cascade deletion rules are implemented for plan deletion.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, REST Principles, Data Integrity, OAS 3.x

**REQ-PTMPL-PLAN-004**

- **Requirement Type:** Functional, Constraint
- **Description:** Every Petition Template MUST have at least one plan defined before it can be 'PUBLISHED'. At least one of these plans SHOULD typically be a 'Free' plan (cost \== 0), although this is not a strict system constraint.
- **Rationale:** Ensures clients have at least one option to choose from when starting a petition. Reflects business model description.
- **Acceptance Criteria:**
  - Validation check during POST /v1/petition-templates/{templateId}/publish verifies at least one plan exists.
  - Publish operation fails with an error if no plans are defined.
-
- **Priority:** Must Have
- **Standard/Reference:** Business Logic Constraint
