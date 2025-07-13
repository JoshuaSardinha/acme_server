**Module: Task Instance Data Model**

**REQ-TASKINST-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist task instance data in a TaskInstances table. Each record represents a specific task for a specific petition instance and MUST include:
  - id (Primary Key, UUID recommended)
  - petition_instance_id (UUID, FK to PetitionInstances.id, NOT NULL, Indexed)
  - task_model_id (UUID, FK to TaskModels.id, NOT NULL)
  - document_type_preset_id (UUID, FK to DocumentTypePresets.id, NOT NULL) \- The primary document this task instance is concerned with.
  - plan_task_graph_node_id (UUID, Nullable FK to PlanTaskGraphNodes.id) \- Links to the node in the pre-defined graph, if applicable (null for benefit-triggered tasks not in the main graph).
  - status (Enum: 'LOCKED', 'OPEN', 'IN_PROGRESS_CLIENT', 'IN_PROGRESS_TEAM', 'PENDING_REVIEW', 'COMPLETED', 'RETURNED_TO_CLIENT', 'CANCELED', 'INVALIDATED', NOT NULL)
  - current_step_number (Integer, Nullable, FK to TaskModelSteps.step_number relative to task_model_id) \- Current active step.
  - assigned_user_id (UUID, Nullable FK to Users.id)
  - assigned_team_id (UUID, Nullable FK to Teams.team_id)
  - instance_count (Integer, default: 1, NOT NULL) \- How many instances of the document/data this task represents.
  - completed_instance_count (Integer, default: 0, NOT NULL) \- Number of instances for which input/processing is complete (for multi-instance tasks).
  - is_invalidated (Boolean, default: false, NOT NULL)
  - due_date (TIMESTAMP WITH TIME ZONE, Nullable) \- Calculated based on task model step deadlines or overall petition timeline.
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
-
- **Rationale:** Defines the runtime entity for tasks, tracking their state, assignments, multiplicity, validity, and links to workflow definitions. Actual data values are stored separately in TaskInstanceData.
- **Acceptance Criteria:**
  - Database schema includes TaskInstances table with specified fields, data types, nullability, and constraints.
  - Enum values for status are defined.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-TASKINST-DATA-001**

- **Requirement Type:** Data
- **Description:** The system MUST store the actual data values associated with Task Instances in a dedicated TaskInstanceData table. Each row represents a specific data point's value for a specific instance within a task. The table MUST include:
  - id (Primary Key, UUID recommended)
  - task_instance_id (FK to TaskInstances, NOT NULL, Indexed)
  - data_point_id (FK to DataPoints, NOT NULL, Indexed)
  - instance_index (Integer, default: 0\) \- Indicates which document instance this data belongs to when TaskInstances.instance_count \> 1\. 0-based index.
  - value_string (VARCHAR, nullable)
  - value_text (TEXT, nullable)
  - value_integer (BIGINT, nullable)
  - value_decimal (DECIMAL, nullable)
  - value_boolean (BOOLEAN, nullable)
  - value_date (DATE, nullable)
  - value_datetime (TIMESTAMP WITH TIME ZONE, nullable)
  - value_file_reference (TEXT, nullable) \- Stores path/URL/ID for single file uploads.
  - value_file_array_reference (JSON, nullable) \- Stores array of paths/URLs/IDs for multiple file uploads associated with one DataPoint instance.
  - value_json (JSONB, nullable) \- For complex object structures.
  - last_updated_by_user_id (FK to Users, nullable)
  - last_updated_at (TIMESTAMP)
-
- **Rationale:** Provides a normalized, queryable structure for storing all input and output data associated with task instances. Uses typed columns for common data types and JSON/TEXT for others. Supports multi-instance tasks via instance_index. Replaces input_data/output_data JSON fields in TaskInstances.
- **Acceptance Criteria:**
  - Database schema includes TaskInstanceData table with specified fields, FKs, and indexes.
  - A unique constraint SHOULD exist on (task_instance_id, data_point_id, instance_index) to prevent duplicate entries.
  - Appropriate value\_\* column is used based on the associated DataPoints.data_type.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices, Database Normalization
