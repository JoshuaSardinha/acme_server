**Module: Petition Filing & Completion**

**REQ-PFILE-001**

- **Requirement Type:** Data
- **Description:** The PetitionTemplateTypes table (or a dedicated PetitionTypeCompilationConfig table linked to it) MUST store references to ContentBlocks that define templates for PDF components:
  - cover_page_content_id (UUID, Nullable FK to ContentBlocks.id)
  - index_page_content_id (UUID, Nullable FK to ContentBlocks.id)
  - tab_divider_content_id (UUID, Nullable FK to ContentBlocks.id)
-
- **Rationale:** Allows customization of the compiled PDF's appearance per petition type using centrally managed, versionable content blocks.
- **Acceptance Criteria:**
  - Relevant table (PetitionTemplateTypes or new config table) includes FKs to ContentBlocks.id.
  - NN Admins can associate specific ContentBlocks with these PDF components during PetitionTemplateType setup.
-
- **Priority:** Should Have (for PDF customization)
- **Standard/Reference:** Data Modeling

**REQ-PFILE-002**

- **Requirement Type:** Functional, Server-Side Logic
- **Description:** Once all mandatory, non-invalidated TaskInstances for a PetitionInstance are 'COMPLETED', the system MUST enable a "Compile Petition" process. This server-side process will:
  - Retrieve all output DataPoints (especially FILE_REFERENCE types) from TaskInstanceData for all completed tasks, respecting instance_count and instance_index.
  - Organize these documents according to the PetitionTemplateTabs order and the document order within tabs.
  - Generate a cover page using cover_page_template_ref and petition data (client name, petition type).
  - Generate an index page listing all tabs and their documents.
  - Generate tab divider pages.
  - Assemble all generated pages and collected documents into a single, consolidated PDF file.
  - Store this final PDF securely (see File Management REQ-FMAN-002) and link it to the PetitionInstance.
-
- **Rationale:** Automates the creation of the final petition document package.
- **Acceptance Criteria:**
  - Process is triggered when all tasks are complete.
  - Correctly retrieves and orders all documents.
  - Generates cover, index, and tab dividers as per templates.
  - Produces a single, well-formed PDF.
  - PDF is securely stored and linked.
-
- **Priority:** Must Have
- **Standard/Reference:** PDF Generation Libraries (e.g., pdf-lib, Puppeteer)

**REQ-PFILE-003**

- **Requirement Type:** Data
- **Description:** Petition Templates MUST allow NN Admins to define "Filing Steps" if a "Filing Included" type Benefit is available/selected for the PetitionTemplateType. These steps are stored in a PetitionTemplateFilingSteps table:
  - id (Primary Key)
  - template_id (FK to PetitionTemplates)
  - step_number (Order of the step)
  - step_name (e.g., "Printing & Organizing", "Mailing to USCIS", "Receipt Notice Received")
  - description (Optional details)
  - estimated_duration_days (Optional)
-
- **Rationale:** Defines the trackable stages for petitions where the company handles filing.
- **Acceptance Criteria:**
  - PetitionTemplateFilingSteps table exists.
  - NN Admins can define these steps via an API when creating/editing templates.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-PFILE-004**

- **Requirement Type:** Data, Functional
- **Description:** For PetitionInstances where a "Filing Included" Benefit is active, the system MUST track the progress through these filing steps. A PetitionInstanceFilingProgress table will store:
  - id (Primary Key)
  - petition_instance_id (FK)
  - filing_step_template_id (FK to PetitionTemplateFilingSteps)
  - status (Enum: 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD')
  - completed_at (Timestamp, nullable)
  - notes (TEXT, nullable)
-
- **Rationale:** Allows tracking and displaying filing status to clients and internal teams.
- **Acceptance Criteria:**
  - PetitionInstanceFilingProgress table exists.
  - When such a petition is compiled, entries are created in this table for each defined filing step with status 'PENDING'.
  - API endpoints (PATCH /v1/petitions/{petitionInstanceId}/filing-steps/{progressId}) allow authorized team members (NN/Vendor employee assigned to filing) to update step status and add notes. Documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-PFILE-005**

- **Requirement Type:** Data
- **Description:** The PetitionTemplates table MUST have a field filing_instructions_content_id (UUID, Nullable FK to ContentBlocks.id). This links to a ContentBlock record containing the rich text/media instructions displayed to clients if they do _not_ have a "Filing Included" benefit.
- **Rationale:** Provides guidance to clients who are self-filing, using centrally managed rich content.
- **Acceptance Criteria:**
  - PetitionTemplates table has the filing_instructions_content_id field.
  - NN Admins can select/assign a ContentBlock for filing instructions when creating/editing a Petition Template.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-PFILE-006**

- **Requirement Type:** Functional, API
- **Description:** Once a petition's tasks are all 'COMPLETED':
  - The PetitionInstance status is updated to 'COMPILED' (or similar).
  - If "Filing Included" is active, the client view shows the current PetitionInstanceFilingProgress timeline.
  - If "Filing Included" is NOT active, the client view shows the filing_instructions_content.
  - The client MUST be able to download the compiled PDF (GET /v1/petitions/{petitionInstanceId}/compiled-pdf). Access MUST be authorized.
  - After all filing steps are 'COMPLETED' (if applicable), the PetitionInstance status can be updated to 'FILED' or 'FINALIZED'.
-
- **Rationale:** Defines the user experience post-task completion and provides access to the final document.
- **Acceptance Criteria:**
  - Client UI displays correct information based on filing benefit.
  - Secure PDF download endpoint exists and is authorized.
  - Petition status updates reflect compilation and filing completion.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** \-

**REQ-PFILE-007**

- **Requirement Type:** Functional
- **Description:** The system MUST allow authorized users (Client, or NN/Vendor team members with permission) to add updates/notes (e.g., "RFE Received", "Interview Scheduled", "Approved") to a PetitionInstance even after it's considered 'FILED' or 'FINALIZED'. These updates should be timestamped and attributed.
- **Rationale:** Allows for long-term tracking of case outcomes beyond initial filing.
- **Acceptance Criteria:**
  - A PetitionInstanceUpdates table exists (linking to petition_instance_id, user_id, timestamp, update_text, update_type \[Enum\]).
  - API endpoint exists to add and retrieve these updates.
-
- **Priority:** Should Have
- **Standard/Reference:** \-
