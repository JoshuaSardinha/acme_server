**Module: Petition Template Tabs**

**REQ-PTMPL-TAB-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist template tab definitions in a PetitionTemplateTabs table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - template_id (UUID, FK to PetitionTemplates.id, NOT NULL)
  - title (TEXT, Tab title, NOT NULL)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Rich description for the tab.
  - display_order (Integer, NOT NULL, unique per template_id)
  - is_required (Boolean, default: true, NOT NULL)
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
-
- **Rationale:** Defines tab structure. Uses ContentBlocks for rich descriptions.
- **Acceptance Criteria:** Database schema includes PetitionTemplateTabs. Admins can associate ContentBlock for description.
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling
- **REQ-PTMPL-TAB-002**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for NN Admins (NN_ADMIN) to manage tabs within a 'DRAFT' Petition Template:
  - POST /v1/petition-templates/{templateId}/tabs: Add a new tab. Requires title, order, allows description, is_required.
  - GET /v1/petition-templates/{templateId}/tabs: List tabs for a template, ordered by order.
  - PATCH /v1/petition-templates/{templateId}/tabs/{tabId}: Update an existing tab (title, description, order, is_required). Re-ordering might require adjustments to other tabs' order values.
  - DELETE /v1/petition-templates/{templateId}/tabs/{tabId}: Remove a tab. Must cascade delete associated document requirements (TabDocuments).
-
- **Rationale:** Allows NN Admins to define and modify the tab structure of a template.
- **Acceptance Criteria:**
  - Specified endpoints exist and function as described.
  - Only NN Admins can access these endpoints for 'DRAFT' templates.
  - Endpoints correctly manage tab creation, updates (including order), and deletion.
  - Deletion correctly handles dependencies.
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, REST Principles, OAS 3.x
