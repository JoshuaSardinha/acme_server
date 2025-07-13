**Module: Content Management (NEW \- for Reusable Rich Content)**

**REQ-CONTENT-001**

- **Requirement Type:** Data, Functional
- **Description:** The system MUST provide a mechanism for managing reusable blocks of rich content (e.g., HTML, Markdown, or structured JSON for templating engines) to be used for PDF generation components (cover pages, indexes, tab dividers) and filing instructions. This will be stored in a ContentBlocks table:
  - id (Primary Key, UUID recommended)
  - name (TEXT, Unique, human-readable identifier, e.g., "USCIS_Cover_Page_Template_v1", "H1B_Self_Filing_Instructions_v2")
  - content_type (Enum: 'HTML', 'MARKDOWN', 'JSON_TEMPLATE_DATA', 'PLAIN_TEXT', NOT NULL)
  - content (TEXT, storing the actual content, NOT NULL)
  - version (Integer, default: 1, NOT NULL)
  - description (TEXT, Nullable, for admin reference)
  - created_by_user_id (UUID, FK to Users.id)
  - updated_by_user_id (UUID, FK to Users.id)
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
-
- **Rationale:** Centralizes management of templated or rich text content used in various parts of the system, particularly for document generation and dynamic instructions.
- **Acceptance Criteria:**
  - Database schema includes ContentBlocks table with specified fields.
  - NN Admins (or designated content managers) can CRUD ContentBlocks via a dedicated internal API/interface.
-
- **Priority:** Must Have (to support REQ-PFILE-001 & REQ-PFILE-005 effectively)
- **Standard/Reference:** Content Management Systems Principles, Data Modeling
