**Module: Core Petition Template Structure**

**REQ-PTMPL-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist petition template data in a PetitionTemplates table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - name (TEXT, Template name, Unique, NOT NULL)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Rich description of the petition template.
  - petition_type_id (UUID, FK to PetitionTemplateTypes.id, NOT NULL)
  - status (Enum: 'DRAFT', 'PUBLISHED', 'ARCHIVED', default: 'DRAFT', NOT NULL)
  - version (Integer, default: 1, NOT NULL)
  - eligibility_condition (TEXT, Nullable) \- Stores the logical expression for eligibility.
  - filing_instructions_content_id (UUID, Nullable FK to ContentBlocks.id) \- For self-filing instructions.
  - created_by_user_id (UUID, FK to Users.id, NOT NULL)
  - updated_by_user_id (UUID, FK to Users.id, NOT NULL)
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
-
- **Rationale:** Defines the main template entity. Uses ContentBlocks for rich descriptions. root_form_definition_id removed as root form fields are directly linked.
- **Acceptance Criteria:**
  - Database schema includes PetitionTemplates table.
  - Admins can associate a ContentBlock for the description.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling

**REQ-PTMPL-002**

- **Requirement Type:** Data
- **Description:** The system MUST have lookup tables for PetitionTemplateTypes (e.g., 'USCIS_VISA', 'OTHER_GOVT_APP') and PetitionTemplateTags (e.g., 'EMPLOYMENT_BASED', 'FAMILY_BASED'). These tables are managed by Developers or designated super-admins, not regular NN Admins via the UI. A many-to-many relationship MUST exist between PetitionTemplates and PetitionTemplateTags via an association table (PetitionTemplateTagAssignments).
- **Rationale:** Provides controlled vocabularies for classifying templates. Allows assignment of multiple tags.
- **Acceptance Criteria:**
  - PetitionTemplateTypes table exists with id, name, description.
  - PetitionTemplateTags table exists with id, name, description.
  - PetitionTemplateTagAssignments table exists linking the Petition template's id and the Tag's id.
  - Mechanism for managing Types/Tags (e.g., DB seeds, internal admin interface) is defined separately.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-PTMPL-003**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for NN Admins (NN_ADMIN) to manage the lifecycle of Petition Templates:
  - POST /v1/petition-templates: Create a new template (initial state 'DRAFT'). Requires name, petition_type_id, allows optional description, tag_ids.
  - GET /v1/petition-templates: List existing templates. Supports filtering by status, petition_type_id, tag_ids.
  - GET /v1/petition-templates/{templateId}: Retrieve details of a specific template (including its associated components like tabs, plans, criteria \- potentially via nested data or separate calls).
  - PATCH /v1/petition-templates/{templateId}: Update basic template details (name, description, tag_ids). Can only update templates in 'DRAFT' status. Increment version.
  - POST /v1/petition-templates/{templateId}/publish: Change status from 'DRAFT' to 'PUBLISHED'. Performs validation checks (REQ-PTMPL-VALIDATE-001).
  - POST /v1/petition-templates/{templateId}/archive: Change status from 'PUBLISHED' to 'ARCHIVED'. Prevents new petitions from being created based on it.
  - POST /v1/petition-templates/{templateId}/revert: (Optional: Consider versioning implications) Revert an 'ARCHIVED' template back to 'DRAFT' or create a new draft based on it.
  - DELETE /v1/petition-templates/{templateId}: Delete a template (only if in 'DRAFT' status).
-
- **Rationale:** Provides full CRUD and lifecycle management capabilities for petition templates exclusively for NN Admins.
- **Acceptance Criteria:**
  - Specified endpoints exist and function as described.
  - Only NN Admins can access these endpoints.
  - Status transitions are correctly enforced.
  - Updating triggers version increment.
  - Deletion constraints are enforced.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, OWASP A01:2021-Broken Access Control, REST Principles, OAS 3.x
