**Module: AI Process Integration**

**REQ-AI-001**

- **Requirement Type:** Data
- **Description:** The system MUST have an AIProcesses table to register available AI processing capabilities. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - name (TEXT, Unique, human-readable name, NOT NULL)
  - description (TEXT, NOT NULL)
  - process_type (Enum: 'REVIEW_VALIDATION', 'OUTPUT_GENERATION', NOT NULL)
  - endpoint_url (TEXT, Nullable) \- For external AI services.
  - internal_handler_id (TEXT, Nullable) \- For internal AI modules.
  - managed_by (Enum: 'DEVELOPER', 'AI_ADMIN', NOT NULL)
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - **(Removed)** expected_input_schema_ref, produces_output_schema_ref. These are now defined by linking AIProcesses to DataPoints.
-
- **Rationale:** Central registry for AI functions, defining their type and invocation method. Specific I/O is managed via a linking table.
- **Acceptance Criteria:**
  - Database schema includes AIProcesses table with specified fields.
  - Mechanism exists to manage these AI process definitions.
-
- **Priority:** Must Have
- **Standard/Reference:** System Integration, API Design

**REQ-AI-PROCDP-001 (NEW \- Linking AI Processes to DataPoints for I/O)**

- **Requirement Type:** Data
- **Description:** A many-to-many relationship MUST exist between AIProcesses and DataPoints to define the specific expected inputs and produced outputs for each AI process. This is stored in an AIProcessDataPointLinks table:
  - id (Primary Key, UUID)
  - ai_process_id (FK to AIProcesses.id, NOT NULL)
  - data_point_id (FK to DataPoints.id, NOT NULL)
  - direction (Enum: 'INPUT', 'OUTPUT', NOT NULL)
  - is_required_input (Boolean, Nullable, applicable if direction is 'INPUT')
  - notes (TEXT, Nullable, e.g., "Primary document file for analysis", "Confidence score for validation")
-
- **Rationale:** Clearly defines the data contract for each AI process in terms of specific, centrally managed DataPoints, making integration with TaskInstanceData straightforward.
- **Acceptance Criteria:**
  - Database schema includes AIProcessDataPointLinks table.
  - Admin/Developer interface allows defining these I/O DataPoints for each AI process.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, API Design

**REQ-AI-002**

- **Requirement Type:** Data (Reference in TaskModelSteps)
- **Description:** The TaskModelSteps table (REQ-TASKM-002) already includes an ai_process_id (Nullable FK to AIProcesses). This field is ONLY populated if the TaskModelSteps.assigned_role is 'AI'.
- **Rationale:** Reiteration and confirmation of how an AI process is linked to a specific step in a task model.
- **Acceptance Criteria:**
  - ai_process_id in TaskModelSteps correctly references AIProcesses.id.
  - Business rule: ai_process_id should only be non-null if assigned_role is 'AI'.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Consistency

**REQ-AI-003**

- **Requirement Type:** Functional, Server-Side Logic, Integration
- **Description:** When a TaskInstance's current_step_number points to a TaskModelStep where assigned_role is 'AI' and ai_process_id is populated:
  - Identify the AIProcess (and its AIProcessDataPointLinks) to be invoked.
  - Gather required input data: For each linked INPUT DataPoint in AIProcessDataPointLinks, retrieve the corresponding value(s) from TaskInstanceData for the current TaskInstance (respecting instance_index if TaskInstance.instance_count \> 1). Prepare data in the format expected by the AI (which might be a structured object containing these data point values).
  - Invoke the AI process (external via endpoint_url or internal via internal_handler_id).
  - Handle the AI process's response:
    - **For REVIEW_VALIDATION types:** Response expected: approval/denial status, optional message.
      - Success: Progress to success_target_step_number.
      - Failure: Progress to failure_target_step_number. Store denial message in TaskComments (REQ-TASKINST-INTERACT-003) associated with the AI user/system.
    -
    - **For OUTPUT_GENERATION types:** Response expected: data for specific OUTPUT DataPoints linked via AIProcessDataPointLinks.
      - For each output DataPoint and for each instance_index (if applicable), parse and store the generated value/reference into the corresponding TaskInstanceData record.
      - Progress to success_target_step_number.
    -
  -
  - Implement error handling (AI service unavailability, timeouts, malformed responses), with retry mechanisms or flagging for manual intervention, and robust logging.
-
- **Rationale:** Defines core logic for AI step execution, now using AIProcessDataPointLinks for precise data mapping with TaskInstanceData.
- **Acceptance Criteria:**
  - System correctly prepares input data for AI by fetching specified DataPoints from TaskInstanceData.
  - System correctly invokes AI handlers.
  - REVIEW_VALIDATION responses correctly drive step progression and log feedback.
  - OUTPUT_GENERATION responses are correctly parsed and stored into TaskInstanceData against the defined output DataPoints.
  - Robust error handling and logging are implemented.
-
- **Priority:** Must Have
- **Standard/Reference:** API Integration, Error Handling

**REQ-AI-004**

- **Requirement Type:** Security
- **Description:** If AI processes involve external services (AIProcesses.endpoint_url), communication MUST use HTTPS (TLS 1.2+). Authentication mechanisms (e.g., API Keys, OAuth 2.0 Client Credentials) MUST be used to secure calls to these external AI services. Sensitive data (PII) sent to external AI services MUST be minimized and subject to contractual agreements (e.g., BAAs if HIPAA applies) regarding data handling and privacy.
- **Rationale:** Ensures secure communication and data protection when integrating with third-party AI services.
- **Acceptance Criteria:**
  - HTTPS is enforced for all external AI service calls.
  - Appropriate authentication is implemented for external AI services.
  - Secrets (API keys) are managed securely (e.g., using a secrets manager, not hardcoded).
  - Data minimization principles are applied if PII is sent externally.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A02:2021-Cryptographic Failures, OWASP A07:2021-Identification and Authentication Failures, Data Privacy Regulations (GDPR, HIPAA)

**REQ-AI-005**

- **Requirement Type:** Auditing
- **Description:** All invocations of AI processes MUST be audited. Audit logs MUST include:
  - Timestamp
  - TaskInstance ID
  - AIProcess ID invoked
  - Status (Success, Failure, Error)
  - A summary of input data (e.g., hash or non-sensitive identifiers)
  - A summary of output data or decision (e.g., Approved/Denied, hash of output, non-sensitive identifiers)
  - Duration of the AI process call.
-
- **Rationale:** Provides a trail for understanding AI decision-making, performance, and troubleshooting integration issues.
- **Acceptance Criteria:**
  - Audit log entries are created for each AI process invocation with all specified fields.
  - Logs are stored securely (as per REQ-AUDIT-001).
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A09:2021-Security Logging and Monitoring Failures
