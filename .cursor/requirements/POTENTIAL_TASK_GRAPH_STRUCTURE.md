**Module: Potential Task Graph Structure**

**REQ-PTMPL-GRAPH-DEF-001**

- **Requirement Type:** Data, Server-Side Logic (Template Save/Validation)
- **Description:** When a 'DRAFT' Petition Template configuration affecting tasks or plans is saved or validated, the system MUST calculate and store the _potential_ task graph structure **for each associated Plan**. This calculation, performed _per plan_, involves:
  - Identifying all PetitionTemplateTabDocuments associated with the template.
  - For the specific planId being processed, identifying the assigned TaskModel for each document via PlanDocumentTaskModels.
  - Analyzing the required INPUT DataPoints and produced OUTPUT DataPoints for each assigned TaskModel via TaskModelDataPointLinks.
  - Determining potential dependencies _within this plan's context_: Task B depends on Task A if a required, evidence-based INPUT data_point_id for Task B (via its assigned Task Model) matches an OUTPUT data_point_id produced by Task A (via its assigned Task Model).
  - Storing this structure, explicitly linking it to the planId. This could use tables like PlanPotentialTaskNodes (linking plan_id, tab_document_id, task_model_id) and PlanPotentialTaskDependencies (linking prerequisite/dependent PlanPotentialTaskNodes based on matching data_point_id).
  - The PlanPotentialTaskNodes table (or equivalent) should indicate the source of the node: either derived from a PetitionTemplateTabDocument OR created as an "Admin-Added Root Task" to satisfy a previously unconnected evidence-based input (as per REQ-PTMPL-VALIDATE-001.6.d).
-
- **Rationale:** Pre-calculates the specific potential workflow and dependencies _for each plan_, reflecting that different Task Models (and thus different I/O and dependencies) may be used. Stores this structure for validation and faster runtime instantiation. Differentiates between tasks defined as part of the main document flow vs. those added specifically to resolve missing dependencies.
- **Acceptance Criteria:**
  - Process performs analysis and storage _per plan_.
  - Database schema includes tables like PlanPotentialTaskNodes, PlanPotentialTaskDependencies linked to plan_id.
  - Stored structure accurately reflects the plan-specific task models and dependencies based on data_point_id matching.
  - PlanPotentialTaskNodes structure can distinguish between these two types of source tasks.
-
- **Priority:** Must Have
- **Standard/Reference:** Graph Theory, Data Modeling
- **Requirement Type:** Data, Server-Side Logic (Template Save/Validation)
- **Description:** The system MUST determine and store a **single unified Root Form definition** for the entire Petition Template during template analysis/validation. This definition represents all data points that _might_ need to be collected upfront, regardless of the plan chosen later. This involves:
  - Identifying all DataPoints referenced (by system*name) in any invalidation_condition or multiplicity_condition across \_all* PetitionTemplateTabDocuments in the template.
  - For _all_ TaskModels assigned in _any Plan_ of the template: Identifying their required INPUT DataPoints (via TaskModelDataPointLinks) where is_separate_request is false AND is_evidence_based is false.
  - Consolidating the unique set of required DataPoints IDs from steps 1 & 2\.
  - **Safety Check:** Verifying that every DataPoint ID identified in step 2 actually exists in the central DataPoints table. (This check is somewhat redundant if foreign keys are enforced but adds explicit validation). If any required input doesn't map to a defined DataPoint, fail validation.
  - Storing this definitive list of DataPoints IDs (representing the unified Root Form fields) associated with the PetitionTemplate (e.g., in a PetitionTemplateRootFormFields table linking template_id and data_point_id).
-
- **Rationale:** Defines a single, comprehensive Root Form for the template by considering the upfront data needs of all conditions and all potential task models across all plans. Ensures consistency for the client initially. Uses central DataPoints for structure/text. Adds a safety check for undefined inputs.
- **Acceptance Criteria:**
  - Root form determination logic correctly identifies necessary DataPoints IDs by analyzing conditions and _all_ potential task model inputs across _all_ plans.
  - Safety check verifies identified input DataPoints exist.
  - The consolidated list of DataPoints IDs is stored, linked to the PetitionTemplate.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, Validation

**REQ-PTMPL-VALIDATE-001**

- **Requirement Type:** Functional, Constraint, Server-Side Logic
- **Description:** Before a Petition Template can be 'PUBLISHED' (POST /v1/petition-templates/{templateId}/publish), the system MUST perform comprehensive validation, including:
  - Basic checks (Type assigned, \>=1 Plan exists).
  - Condition validation (Syntax OK, variables exist as DataPoints.system_name).
  - Root Form Input validation (Safety check in REQ-PTMPL-ROOTFORM-DEF-001 ensures all needed root form inputs are defined DataPoints).
  - **Per-Plan Task Configuration Checks:** For _each Plan_ associated with the template:
    - Every required (is_required=true) PetitionTemplateTabDocument MUST have a TaskModel assigned via PlanDocumentTaskModels.
    - The assigned TaskModel's document_type_preset_id MUST match the document_type_preset_id of the PetitionTemplateTabDocument.
  -
  - **Per-Plan Graph Dependency Checks:** For _each Plan_, based on its calculated _potential_ task graph structure (REQ-PTMPL-GRAPH-DEF-001):
    - All required (is*required_input=true), evidence-based (is_evidence_based=true) INPUT DataPoints for all potential tasks in \_that plan's graph* MUST have a corresponding OUTPUT DataPoint (matching data*point_id) produced by another potential task \_within that same plan's graph*.
  -
-
- **Rationale:** Ensures published templates are structurally sound _for every plan offered_. Validates assignments, types, conditions, and graph completeness specifically for the set of task models chosen in each plan.
- **Acceptance Criteria:**
  - Validation logic iterates through each plan for checks 4 & 5\.
  - Publish operation fails with descriptive errors if any validation fails for _any_ plan.
  - Successful validation allows status change to 'PUBLISHED'.
-
- **Priority:** Must Have
- **Standard/Reference:** Business Logic Constraint, Data Integrity, DAG Validation

**REQ-GRAPH-STORE-001**

- **Requirement Type:** Data
- **Description:** The system MUST store the definition of potential task nodes for each plan in a PlanTaskGraphNodes table. Each row represents a potential task that could be instantiated for a petition using this plan. It MUST include:
  - id (Primary Key, UUID recommended)
  - plan_id (FK to PetitionTemplatePlans, NOT NULL, Indexed)
  - task_model_id (FK to TaskModels, NOT NULL) \- The Task Model to be used.
  - document_type_preset_id (FK to DocumentTypePresets, NOT NULL) \- The primary document this node aims to produce/collect.
  - source_type (Enum: 'TAB_DOCUMENT', 'ADMIN_ADDED_ROOT_TASK', 'INITIAL_FORM_TASK', default: 'TAB_DOCUMENT') \- Indicates how this node was defined.
  - source_tab_document_id (Nullable FK to PetitionTemplateTabDocuments) \- If source_type is 'TAB_DOCUMENT'.
  - node_identifier (TEXT, Unique within a plan_id) \- A stable, human-readable or system-generated unique ID for this node within the plan's graph (e.g., "PassportUpload", "CoverLetterDraft_PlanA"). Useful for referencing in dependencies.
-
- **Rationale:** Clearly defines each potential task (node) within a specific plan's workflow, its associated model and document, and how it originated (from a tab or added by an admin to fulfill a dependency). Replaces PlanPotentialTaskNodes with a more descriptive name and clear fields.
- **Acceptance Criteria:**
  - Database schema includes PlanTaskGraphNodes table with specified fields, FKs, and constraints.
  - Enum values for source_type are defined.
  - A unique constraint exists on (plan_id, node_identifier).
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, Graph Theory

**REQ-GRAPH-STORE-002**

- **Requirement Type:** Data
- **Description:** The system MUST store the dependencies (edges) between potential task nodes for each plan in a PlanTaskGraphEdges table. Each row represents a directed dependency where one task must be completed (or a specific output DataPoint from it must be available) before another task can begin or proceed. It MUST include:
  - id (Primary Key, UUID recommended)
  - plan_id (FK to PetitionTemplatePlans, NOT NULL, Indexed) \- Though derivable via nodes, explicit linking simplifies queries for a plan's entire edge set.
  - prerequisite_node_id (FK to PlanTaskGraphNodes, NOT NULL) \- The node that must be completed first.
  - dependent_node_id (FK to PlanTaskGraphNodes, NOT NULL) \- The node that depends on the prerequisite.
  - triggering_data_point_id (FK to DataPoints, NOT NULL) \- The specific output DataPoint from the prerequisite_node_id that satisfies an evidence-based input requirement of the dependent_node_id. This DataPoint must be declared as an OUTPUT of the prerequisite node's TaskModel and an evidence-based INPUT of the dependent node's TaskModel.
-
- **Rationale:** Explicitly defines the directed edges of the task graph for each plan, clearly stating which output from a prerequisite task triggers a dependency for a subsequent task. This allows for precise tracking of data flow and readiness of tasks. Replaces PlanPotentialTaskDependencies.
- **Acceptance Criteria:**
  - Database schema includes PlanTaskGraphEdges table with specified fields, FKs, and constraints.
  - A unique constraint SHOULD exist on (plan_id, prerequisite_node_id, dependent_node_id, triggering_data_point_id) to prevent duplicate dependency definitions for the same data flow.
  - Validation ensures that triggering_data_point_id is indeed an output of the prerequisite's Task Model and an input of the dependent's Task Model.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, Directed Acyclic Graph (DAG) Representation

**REQ-GRAPH-STORE-003**

- **Requirement Type:** Data
- **Description:** The system MUST associate the unified Root Form definition with each Petition Template. This is stored in a PetitionTemplateRootFormFields table, linking the template_id to the data_point_id of each field required on the root form, along with its display order.
  - id (Primary Key)
  - template_id (FK to PetitionTemplates, NOT NULL)
  - data_point_id (FK to DataPoints, NOT NULL)
  - order (Integer)
-
- **Rationale:** Stores the ordered list of DataPoints that constitute the initial data collection form for the template, common across all plans.
- **Acceptance Criteria:**
  - Database schema includes PetitionTemplateRootFormFields table.
  - A unique constraint exists on (template_id, data_point_id).
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-GRAPH-CALC-001**

- **Requirement Type:** Server-Side Logic, Functional
- **Description:** As part of the "Save & Validate" or "Publish" process for a Petition Template (within REQ-PTMPL-VALIDATE-001), the system MUST perform the following analysis **for each Plan** associated with the template to define its potential task graph:
  - **Node Identification:**
    - Identify all PetitionTemplateTabDocuments for the template. For each, determine the TaskModel assigned under the current Plan (via PlanDocumentTaskModels). Create a PlanTaskGraphNode record for each of these, with source_type \= 'TAB_DOCUMENT'.
    - (Iterative Step from REQ-PTMPL-VALIDATE-001.6.d) If the admin defines "Admin-Added Root Tasks" to satisfy missing evidence, create PlanTaskGraphNode records for these as well, with source_type \= 'ADMIN_ADDED_ROOT_TASK'. Assign unique node_identifier to all nodes.
  -
  - **Edge Identification (Dependency Mapping):**
    - For every PlanTaskGraphNode in the current plan:
      - Retrieve its required INPUT DataPoints that are flagged as is_evidence_based=true (from TaskModelDataPointLinks associated with the node's TaskModel).
      - For each such evidence-based input DataPoint:
        - Search all other PlanTaskGraphNodes within the same plan for a node whose TaskModel produces a matching data_point_id as an OUTPUT (from TaskModelDataPointLinks).
        - If a producing node is found, create a PlanTaskGraphEdge record linking the producing node (as prerequisite_node_id) to the consuming node (as dependent_node_id), specifying the triggering_data_point_id.
        - Also consider the DataPoints collected by the Unified Root Form (PetitionTemplateRootFormFields) as potential outputs from an implicit "Initial Form Completion" event. If an evidence-based input matches a Root Form DataPoint, an edge can be conceptualized from this event (though not necessarily stored as a node-to-node edge if the "Initial Form Node" isn't in PlanTaskGraphNodes).
      -
    -
  -
  - **Storage:** Persist the calculated PlanTaskGraphNodes and PlanTaskGraphEdges for the plan. Delete and recreate if re-validating.
-
- **Rationale:** Formalizes the algorithm for calculating and storing the potential task graph structure for each plan during template design time. This structure is then used for validation and later for instantiating actual tasks. This replaces the less formal "Algorithm Note" and parts of the old REQ-PTMPL-GRAPH-DEF-001.
- **Acceptance Criteria:**
  - The graph calculation process is triggered during template save/validation for each plan.
  - PlanTaskGraphNodes are correctly created for all tab-documents and admin-added root tasks.
  - PlanTaskGraphEdges are correctly created by matching evidence-based INPUT DataPoints to OUTPUT DataPoints from other nodes or the root form, using data_point_id for matching.
  - The generated graph structures are correctly persisted in the database for each plan.
-
- **Priority:** Must Have
- **Standard/Reference:** Graph Theory, Algorithm Design, Data Integrity

**REQ-GRAPH-ROOTFORM-CALC-001**

- **Requirement Type:** Server-Side Logic, Functional
- **Description:** As part of the "Save & Validate" or "Publish" process for a Petition Template, the system MUST determine and store a single, unified Root Form definition for the template:
  - Collect all DataPoint.ids referenced by system_name in any invalidation_condition or multiplicity_condition across all PetitionTemplateTabDocuments.
  - Collect all INPUT DataPoint.ids from TaskModelDataPointLinks where is_separate_request is false AND is_evidence_based is false, for _all_ Task Models assigned in _any Plan_ of the template.
  - Consolidate a unique set of these DataPoint.ids.
  - For each unique DataPoint.id, create/update a record in PetitionTemplateRootFormFields, storing template_id, data_point_id, and a defined display_order for the root form.
-
- **Rationale:** Formalizes the process of identifying all DataPoints needed for the unified initial data collection form, ensuring all conditional logic and non-derived task inputs are covered. Replaces parts of the old REQ-PTMPL-GRAPH-DEF-001 and REQ-PTMPL-ROOTFORM-DEF-001.
- **Acceptance Criteria:**
  - Root form calculation process is triggered during template save/validation.
  - All necessary DataPoints are correctly identified from conditions and non-separate, non-evidence-based task inputs across all plans.
  - PetitionTemplateRootFormFields table is accurately populated with the unique list of DataPoints and their order.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, Algorithm Design
