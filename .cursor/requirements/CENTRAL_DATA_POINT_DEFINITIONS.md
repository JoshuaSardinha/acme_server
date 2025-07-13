**Module: Central Data Point Definitions**

**REQ-DP-001**

- **Requirement Type:** Data
- **Description:** The system MUST have a central DataPoints table serving as the single source of truth for all potential pieces of data used as inputs or outputs. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - system_name (TEXT, Unique, Indexed, NOT NULL, e.g., 'client.passport.expiry_date', 'doc.birth_certificate.file_ref')
  - display_name (TEXT, NOT NULL, e.g., "Passport Expiry Date")
  - question_text (TEXT, Nullable, e.g., "What is your passport's expiry date?") \- User-facing question for direct input.
  - data_type (Enum: 'STRING', 'TEXT_BLOCK', 'NUMBER_INTEGER', 'NUMBER_DECIMAL', 'DATE', 'BOOLEAN', 'FILE_REFERENCE', 'ARRAY_OF_FILES', 'JSON_OBJECT', 'EMAIL', 'PHONE_NUMBER', 'URL', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', NOT NULL)
  - description_content_id (UUID, Nullable FK to ContentBlocks.id) \- Optional link to a rich content block for detailed help text/guidance related to this data point, displayed in UIs.
  - is_pii (Boolean, default: false, NOT NULL) \- Indicates if this data point typically contains Personally Identifiable Information.
  - validation_rules (JSONB, Nullable) \- Stores structured validation rules (e.g., regex, min/max length/value, required if applicable in a specific context).
  - options_list_id (UUID, Nullable FK to OptionLists.id) \- Used if data_type is 'SINGLE_CHOICE' or 'MULTIPLE_CHOICE'.
  - managed_by (Enum: 'DEVELOPER', 'ADMIN', NOT NULL)
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
-
- **Rationale:** Centralizes data element definitions. description_content_id allows rich help text. validation_rules centralizes validation logic. options_list_id enables reusable choice sets.
- **Acceptance Criteria:**
  - Database schema includes DataPoints table.
  - Enum for data_type includes 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'.
  - validation_rules JSON schema is defined.
  - Process for managing DataPoints exists.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, Single Source of Truth Principle

**REQ-DP-OPT-001 (NEW \- Option Lists for DataPoints)**

- **Requirement Type:** Data
- **Description:** To support DataPoints of data_type 'SINGLE_CHOICE' or 'MULTIPLE_CHOICE', the system MUST have tables for managing reusable lists of options:
  - **OptionLists Table:**
    - id (Primary Key, UUID recommended)
    - name (TEXT, Unique, human-readable name for the list, e.g., "Gender Options", "Country List", NOT NULL)
    - description (TEXT, Nullable)
    - managed_by (Enum: 'DEVELOPER', 'ADMIN', NOT NULL)
    - created_at, updated_at
  -
  - **OptionListItems Table:**
    - id (Primary Key, UUID recommended)
    - option_list_id (UUID, FK to OptionLists.id, NOT NULL)
    - item_value (TEXT, NOT NULL, the actual value stored in the database)
    - item_label (TEXT, NOT NULL, the user-facing label for display)
    - display_order (Integer, default: 0, NOT NULL)
    - is_active (Boolean, default: true, NOT NULL)
    - Unique constraint on (option_list_id, item_value).
    - Unique constraint on (option_list_id, item_label).
  -
-
- **Rationale:** Provides a centralized, manageable way to define and reuse sets of choices for dropdowns, radio buttons, or checkbox groups linked to DataPoints.
- **Acceptance Criteria:**
  - Database schema includes OptionLists and OptionListItems tables with specified fields and constraints.
  - A process (DB seeds or Admin UI) exists for managing these lists and items.
  - DataPoints.options_list_id correctly references OptionLists.id.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, UI/UX Best Practices for Forms
