**Module: Petition Instance & Task Instance Creation**

**REQ-PETI-001**

- **Requirement Type:** Functional, Server-Side Logic (triggered by REQ-PETI-ORDER-001)
- **Description:** Upon successful payment and order finalization (via REQ-PETI-ORDER-001), the system MUST:
  - Create a PetitionInstance record. It MUST be linked to the client_user_id, template_id, plan_id, and the company_id (derived from the client's app flavor context \- REQ-APP-001/002). Initial status set to 'IN_PROGRESS' or 'AWAITING_ROOT_FORM'.
  - Retrieve the Unified Root Form definition (list of DataPoints IDs) associated with the PetitionTemplates.id (from PetitionTemplateRootFormFields).
  - Create a TaskInstance record for this Root Form task:
    - Link to the new PetitionInstance.id.
    - Associate with a predefined "Root Form Task Model" ID (a generic model for data collection).
    - Set status to 'OPEN'.
    - Set assigned_user_id to the client_user_id.
    - Set instance_count to 1\.
  -
  - For this Root Form TaskInstance, create placeholder rows in TaskInstanceData (as per REQ-PETI-003.4) for each DataPoint defined in its Root Form definition.
-
- **Rationale:** Creates the core petition record and the very first task (Root Form) for the client to interact with, after payment and order confirmation.
- **Acceptance Criteria:**
  - PetitionInstance record is created correctly with all specified links and initial status.
  - Unified Root Form definition is correctly retrieved.
  - The Root Form TaskInstance is created, marked 'OPEN', assigned to the client, and linked to the petition.
  - Placeholder TaskInstanceData rows are created for all fields of the root form.
-
- **Priority:** Must Have
- **Standard/Reference:** Workflow Initiation

**REQ-PETI-002**

- **Requirement Type:** Functional, API
- **Description:** POST /v1/tasks/{taskId}/submit (for Root Form)... Validates submitted data against the expected DataPoints definition for the Root Form. For each submitted data point:
  - Finds the corresponding data_point_id.
  - Creates/updates a record in TaskInstanceData linking it to the Root Form task_instance_id, the data_point_id, setting instance_index=0, and storing the value in the appropriate value\_\* column.
  - Marks the Root Form TaskInstance as 'COMPLETED'.
  - Triggers the Task Instance Generation Process (REQ-PETI-003).
-
- **Rationale:** Captures root form data into the normalized TaskInstanceData structure and triggers subsequent task creation.
- **Acceptance Criteria:**
  - Endpoint validates data against DataPoints definitions.
  - Data saved correctly into TaskInstanceData linked to the root form task instance.
  - Root form task status updated. Triggers next process.
-
- **Priority:** Must Have
- **Standard/Reference:** REST Principles, OAS 3.x

**REQ-PETI-003**

- **Requirement Type:** Functional, Server-Side Logic (triggered by REQ-PETI-002)
- **Description:** The **Task Instance Generation Process**, triggered by Root Form submission, performs the following for the specific PetitionInstance:
  - Retrieve the submitted Root Form data (from TaskInstanceData linked to the completed Root Form TaskInstance).
  - Retrieve the _plan-specific potential task graph structure_ (PlanTaskGraphNodes, PlanTaskGraphEdges) associated with the PetitionInstance's plan_id.
  - **Main Graph Task Instantiation:** For each PlanTaskGraphNode defined in the plan's structure:  
    a. Evaluate its invalidation_condition and multiplicity_condition (defined in PetitionTemplateTabDocuments if source_type is 'TAB_DOCUMENT', or use defaults if 'ADMIN_ADDED_ROOT_TASK') using the submitted Root Form data.  
    b. If the invalidation_condition evaluates to true, create a TaskInstance record and immediately set its status to 'INVALIDATED' and is_invalidated to true. No further processing for this node.  
    c. If not invalidated, create one TaskInstance record:  
    i. Link to the PetitionInstance.id, the PlanTaskGraphNode.task_model_id, and PlanTaskGraphNode.document_type_preset_id.  
    ii. Set instance_count based on the multiplicity_condition (default 1).  
    iii. Set is_invalidated to false.  
    iv. **Data Placeholder Creation:** For this new TaskInstance:  
    \* Identify all unique DataPoint.ids that are either an INPUT or an OUTPUT for its TaskModel (from TaskModelDataPointLinks).  
    \* Additionally, identify any standard OUTPUT DataPoints for its DocumentTypePreset (from DocumentPresetDataPointLinks) not already covered.  
    \* For each such unique DataPoint.id, and for each instance_index from 0 to (TaskInstance.instance_count \- 1), create a placeholder row in TaskInstanceData (linking task_instance_id, data_point_id, instance_index) with null values for all value\_\* columns.
  - **Benefit-Triggered Task Instantiation:**  
    a. Retrieve all active benefits for the PetitionInstance from PetitionInstanceBenefits.  
    b. For each benefit where Benefits.is_task_triggering is true, retrieve associated TaskModel.id(s) from BenefitTriggeredTaskModels.  
    c. For each such TaskModel.id, create a new TaskInstance:  
    i. Link to PetitionInstance.id, the TaskModel.id, and its DocumentTypePreset.  
    ii. instance_count typically 1 (unless benefit implies multiplicity). is_invalidated typically false.  
    iii. Create placeholder rows in TaskInstanceData as per step 3.c.iv.
  - **Initial Status Setting for All Created Tasks (Main Graph & Benefit-Triggered):**  
    a. For each newly created, non-invalidated TaskInstance:  
    i. If it has no prerequisite DataPoints that are evidence-based (or all its evidence-based inputs are satisfied by the Root Form data already marked as 'COMPLETED'), set its status to 'OPEN'.  
    ii. Otherwise, if it depends on outputs from other tasks in the PlanTaskGraphEdges (or from other benefit-triggered tasks if such dependencies are defined), set its status to 'LOCKED'.
-
- **Rationale:** Creates the actual, personalized workflow by instantiating tasks from the plan's graph and from benefits, evaluating conditions, setting multiplicity, pre-defining all expected data slots, and determining initial task readiness.
- **Acceptance Criteria:**
  - Process correctly retrieves potential graph structure and root form data.
  - Correctly evaluates invalidation_condition and multiplicity_condition.
  - TaskInstance records are created with correct is_invalidated, instance_count, linked model, and preset.
  - Placeholder TaskInstanceData rows are created for all expected input and output DataPoints (covering both Task Model specifics and Document Preset standards) for every instance_index.
  - Benefit-triggered tasks are correctly instantiated with data placeholders.
  - Initial 'OPEN'/'LOCKED' status for all tasks is correctly set based on dependencies and Root Form completion.
-
- **Priority:** Must Have
- **Standard/Reference:** Workflow Instantiation, DAG Traversal, Data Integrity
-
