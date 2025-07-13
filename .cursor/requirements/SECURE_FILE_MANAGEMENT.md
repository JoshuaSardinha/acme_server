**Module: Secure File Management**

**REQ-FMAN-001 (Secure File Upload Process)**

- **Requirement Type:** File Management, Security, API
- **Description:** The system MUST provide a secure mechanism for clients and authorized team members to upload files (documents, evidence). This process MUST include:
  - **Client-Side Pre-validation (Optional but Recommended):** Client application SHOULD perform basic checks for file size and type (based on DataPoints.data_type attributes like allowed MIME types/extensions) before initiating upload to improve UX, but server-side validation is paramount.
  - **API Endpoint:** A dedicated API endpoint (e.g., POST /v1/files/upload) MUST handle file uploads. This endpoint MUST be authenticated and authorized.
  - **Server-Side Validation (Mandatory):**
    - **File Type Validation:** Validate file types using an allow-list of permitted MIME types and extensions (e.g., PDF, DOCX, JPEG, PNG). Reject disallowed types. Do not rely solely on client-provided Content-Type header; inspect file signatures if possible.
    - **File Size Validation:** Enforce a configurable maximum file size limit (e.g., 10MB, 25MB per file). Reject oversized files.
    - **Filename Sanitization:** Sanitize uploaded filenames to remove or replace potentially harmful characters (e.g., ../, null bytes, control characters) before using them in any storage path. Generate a unique, non-guessable internal filename for storage.
  -
  - **Virus Scanning:** All uploaded files MUST be scanned for malware/viruses by an integrated antivirus engine _before_ being persisted to permanent storage or made accessible. Files failing the scan MUST be rejected or quarantined, and the user notified.
  - **Temporary Storage:** Files MAY be temporarily stored during upload processing (e.g., during virus scan) in a secure, isolated location. This temporary storage must be cleaned up promptly after processing.
-
- **Rationale:** Ensures only valid, safe files are accepted into the system, protecting against malware, denial-of-service from large files, and path traversal/injection attacks via filenames. Aligns with REQ-SEC-INTEGRITY-001.
- **Acceptance Criteria:**
  - API endpoint for file upload exists, is authenticated and authorized.
  - Server-side validation for file type (allow-list), size, and filename sanitization is implemented and effective.
  - Virus scanning is integrated and effectively blocks/quarantines infected files.
  - Attempts to upload invalid/malicious files are rejected with appropriate error messages.
  - Endpoint documented in OAS, specifying multipart/form-data and expected fields.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP File Upload Cheat Sheet, OWASP A08:2021-Software and Data Integrity Failures

**REQ-FMAN-002 (Secure File Storage)**

- **Requirement Type:** File Management, Security
- **Description:** All uploaded files (documents, evidence, compiled petitions) and system-generated files (e.g., final PDF petitions) MUST be stored securely in a dedicated, robust object storage service (e.g., AWS S3, Azure Blob Storage). Storage MUST:
  - Be in a private, non-publicly accessible bucket/container.
  - Have Server-Side Encryption (SSE) enabled using strong encryption (e.g., AES-256), preferably with service-managed keys (SSE-S3/SSE-Azure) or customer-managed keys via a KMS (SSE-KMS) for enhanced control (REQ-SEC-CRYPTO-002).
  - Use unique, non-guessable, system-generated object keys/names for stored files (derived from the sanitized upload or a UUID). Original user-provided filenames can be stored as metadata.
  - Implement versioning for files if overwrites are possible or if recovery from accidental deletion is required.
  - Have strict access controls (IAM policies, bucket policies) ensuring only authorized application roles/services can read/write files.
-
- **Rationale:** Protects the confidentiality, integrity, and availability of stored documents.
- **Acceptance Criteria:**
  - Files are stored in a designated private object storage service.
  - Server-side encryption (AES-256) is enabled and verified.
  - System-generated unique names are used for stored objects.
  - Access controls (IAM/bucket policies) are configured according to the principle of least privilege.
  - Versioning is enabled (if deemed necessary).
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP Top 10 (various, re: data protection), Cloud Provider Security Best Practices

**REQ-FMAN-003 (File Integrity)**

- **Requirement Type:** File Management, Security
- **Description:** To ensure file integrity:
  - Upon successful upload (after virus scan and validation), the system MUST generate a cryptographic hash (e.g., SHA-256) of the file content.
  - This hash, along with original filename, MIME type, size, and upload timestamp, MUST be stored as metadata associated with the file (e.g., in the TaskInstanceData record for the corresponding FILE_REFERENCE DataPoint, or in a dedicated Files metadata table if files are managed more centrally).
  - Optionally, when a file is downloaded or accessed for processing (e.g., PDF compilation), its hash CAN be re-calculated and compared against the stored hash to detect corruption or tampering. (This can be computationally intensive).
-
- **Rationale:** Provides a mechanism to verify that files have not been altered since they were uploaded or generated. Builds on REQ-SEC-INTEGRITY-001.
- **Acceptance Criteria:**
  - SHA-256 (or stronger) hash is generated for every uploaded/generated file.
  - Hash and other metadata are stored securely alongside the file reference.
  - (Optional) Integrity check on download/access is considered/implemented where critical.
-
- **Priority:** Must Have (for hash generation/storage), Should Have (for check on download)
- **Standard/Reference:** NIST SP 800-107 (Recommendation for Applications Using Approved Hash Algorithms)

**REQ-FMAN-004 (Secure File Access & Download)**

- **Requirement Type:** File Management, Security, API
- **Description:** The system MUST provide a secure mechanism for authorized users to download files associated with their petitions or tasks.
  - Direct public URLs to files in object storage MUST NOT be used.
  - An API endpoint (e.g., GET /v1/files/{fileId}/download or GET /v1/tasks/{taskInstanceId}/data/{dataPointId}/file?instanceIndex=0) MUST gate access to files.
  - This endpoint MUST perform robust authentication and authorization checks to ensure the user has permission to access the specific file (based on petition ownership, task assignment, document visibility rules from REQ-SEC-BAC-001 & REQ-SEC-BAC-002).
  - The API endpoint can either:
    - Stream the file directly from object storage through the server.
    - Generate a short-lived, pre-signed URL for the object storage service, allowing the client to download directly from object storage temporarily. This is generally preferred for performance and reducing server load.
  -
  - Appropriate Content-Disposition: attachment; filename="user_friendly_name.ext" and Content-Type headers MUST be set in the download response.
-
- **Rationale:** Ensures only authorized users can access specific files, preventing direct unauthorized access to the storage layer. Pre-signed URLs offer a good balance of security and performance.
- **Acceptance Criteria:**
  - File download API endpoint exists, is authenticated and authorized.
  - Authorization logic correctly verifies user's permission for the specific file.
  - Pre-signed URLs (if used) are short-lived and correctly generated.
  - Appropriate HTTP headers for download are set.
  - Files cannot be accessed via direct, persistent URLs to object storage.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A01:2021-Broken Access Control, Cloud Provider Pre-signed URL documentation

**REQ-FMAN-005 (File Metadata Storage)**

- **Requirement Type:** File Management, Data
- **Description:** The system MUST store comprehensive metadata for every uploaded or system-generated file in a central Files table. When a DataPoint of type FILE_REFERENCE is used, the corresponding TaskInstanceData.value_file_reference field MUST store the file_id (FK to Files.id). When a DataPoint of type ARRAY_OF_FILES is used, TaskInstanceData.value_file_array_reference MUST store a JSON array of file_ids. The Files table MUST include:
  - file_id (Primary Key, UUID recommended)
  - original_filename (TEXT, User-provided filename, sanitized, NOT NULL)
  - stored_object_key (TEXT, Unique key/path used in the object storage, NOT NULL)
  - mime_type (VARCHAR, Detected MIME type, NOT NULL)
  - size_bytes (BIGINT, File size in bytes, NOT NULL)
  - sha256_hash (CHAR(64), Hex-encoded SHA-256 hash of the file content, NOT NULL, Indexed)
  - storage_bucket_name (TEXT, Name of the object storage bucket, NOT NULL)
  - uploaded_by_user_id (UUID, FK to Users.id, NOT NULL)
  - upload_timestamp (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - virus_scan_status (Enum: 'PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'SKIPPED', NOT NULL)
  - virus_scan_details (TEXT, Nullable)
  - access_tier (Enum: 'STANDARD', 'ARCHIVAL', Nullable)
  - deletion_status (Enum: 'ACTIVE', 'PENDING_DELETION', 'DELETED', default: 'ACTIVE', NOT NULL)
  - created_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - updated_at (TIMESTAMP WITH TIME ZONE, NOT NULL, default: now())
  - **(Optional Context Links \- consider if needed or if queries will join through TaskInstanceData)**
    - \_context_petition_instance_id (UUID, FK to PetitionInstances.id, Nullable, Indexed for faster global file searches per petition)
    - \_context_task_instance_id (UUID, FK to TaskInstances.id, Nullable, Indexed for faster file searches per task)
  -
-
- **Rationale:** Provides a central, auditable, detailed record for every file. TaskInstanceData links to these records. Context links are for optimized querying.
- **Acceptance Criteria:**
  - Database schema includes Files table.
  - TaskInstanceData fields for file references store file_id(s).
  - File upload process (REQ-FMAN-001) creates entries in Files.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling, Digital Asset Management

**REQ-FMAN-006 (Document Retention & Disposal Policies)**

- **Requirement Type:** File Management, Compliance, Legal
- **Description:** The system MUST support configurable document retention policies based on legal and business requirements (e.g., retain petition data for X years after case completion/closure). There MUST be a secure mechanism for the disposal (deletion) of documents and their associated metadata when their retention period expires. Deletion MUST be permanent and irrecoverable from primary storage.
- **Rationale:** Ensures compliance with data retention laws and minimizes risk associated with holding data longer than necessary.
- **Acceptance Criteria:**
  - Mechanism for defining retention policies (e.g., by PetitionTemplateType or globally) exists.
  - A scheduled process or manual trigger exists to identify documents eligible for disposal.
  - Secure deletion methods are used (e.g., object storage lifecycle policies for deletion, database record deletion).
  - Deletion actions are auditable.
-
- **Priority:** Must Have (for legal compliance)
- **Standard/Reference:** GDPR (Storage Limitation), CCPA, relevant legal record-keeping requirements.

**REQ-FMAN-007 (Audit Trail for File Access)**

- **Requirement Type:** File Management, Auditing, Security
- **Description:** All significant file access events MUST be audited (as per REQ-SEC-AUDIT-001). This includes:
  - File Upload (User ID, Timestamp, File ID/Name, Outcome)
  - File Download (User ID, Timestamp, File ID/Name)
  - File Deletion (User ID, Timestamp, File ID/Name, Trigger: Policy/Manual)
  - Failed access attempts to files.
-
- **Rationale:** Provides a security trail for file handling, crucial for investigating breaches or unauthorized access.
- **Acceptance Criteria:**
  - Specified file access events are logged with all necessary details (User ID, Timestamp, File ID, Action, Source IP).
  - Audit logs are stored securely and are tamper-evident.
-
- **Priority:** Must Have
- ## **Standard/Reference:** OWASP A09:2021-Security Logging and Monitoring Failures

**REQ-PTMPL-LIST-001 (Client/Admin): List/Search Petition Templates**

- **Requirement Type:** Functional, API
- **Description:** An API endpoint (GET /v1/petition-templates/published) MUST exist to list all PUBLISHED Petition Templates. It MUST support:
  - Filtering by petition_type_id, tag_ids.
  - Full-text search on name and description.
  - Pagination.
  - The response for each template should include id, name, description, petition_type_name, associated tag_names. For admins, more details like status might be included via a separate admin endpoint (GET /v1/petition-templates).
-
- **Rationale:** Allows clients to discover available petitions and admins to manage templates.
- **Acceptance Criteria:** Endpoint exists, implements filtering/search/pagination, returns specified data, documented in OAS.
- **Priority:** Must Have

**REQ-CLIENT-PETLIST-001 (Client): List/Filter Own Petitions**

- **Requirement Type:** Functional, API
- **Description:** An API endpoint (GET /v1/client/petitions) MUST allow authenticated clients to retrieve a list of their own PetitionInstances. It MUST support:
  - Filtering by status (e.g., 'IN_PROGRESS', 'COMPLETED', 'FILED').
  - Filtering by date range (created_at).
  - Searching by petition name (derived from PetitionTemplate.name).
  - Pagination.
-
- **Rationale:** Allows clients to view and manage their history of petitions.
- **Acceptance Criteria:** Endpoint exists, correctly filters by current user, implements filtering/search/pagination, documented in OAS.
- **Priority:** Must Have

**REQ-CLIENT-TASKLIST-001 (Client): List/Filter Own Tasks**

- **Requirement Type:** Functional, API
- **Description:** An API endpoint (GET /v1/client/tasks) MUST allow authenticated clients to retrieve a list of their own assigned TaskInstances across all their petitions. It MUST support:
  - Filtering by status.
  - Filtering by petition_instance_id.
  - Pagination.
-
- **Rationale:** Allows clients to get an overview of all their tasks.
- **Acceptance Criteria:** Endpoint exists, correctly filters by current user, implements filtering/pagination, documented in OAS.
- **Priority:** Must Have

**REQ-TEAM-TASKLIST-001 (Employee/Manager/Admin): List/Filter Team/Company Tasks**

- **Requirement Type:** Functional, API
- **Description:** Enhance dashboard APIs or create specific endpoints (e.g., GET /v1/tasks/assigned-to-me, GET /v1/tasks/team/{teamId}, GET /v1/tasks/company/{companyId}) to allow Employees, Managers, and Admins to list and filter tasks based on their role and scope, including:
  - Filtering by status, assigned_user_id, assigned_team_id, petition_instance_id, due_date range.
  - Pagination.
-
- **Rationale:** Supports advanced task searching beyond basic dashboard views for internal users.
- **Acceptance Criteria:** Endpoints exist, implement role-based scoping and specified filters/pagination, documented in OAS.
- **Priority:** Must Have

**REQ-CLIENT-PETCREATE-001 (New \- derived from flow): Accept T\&Cs for Petition**

- **Requirement Type:** Functional, API
- **Description:** When a client selects a plan and initiates petition creation (via POST /v1/petitions REQ-PETI-001, or a preceding step), the API request (or a separate confirmation step) MUST include an indicator that the client has accepted the terms_and_conditions_content associated with the selected PetitionTemplatePlan. The acceptance (user_id, plan_id, timestamp) MUST be logged.
- **Rationale:** Captures client agreement to plan-specific T\&Cs.
- **Acceptance Criteria:** API for petition creation includes T\&C acceptance. Acceptance is logged for audit.
- **Priority:** Must Have

**REQ-INTERNAL-PETLIST-001 (NEW \- List/Filter Petitions for Internal Users)**

- **Requirement Type:** Functional, API
- **Description:** An API endpoint (e.g., GET /v1/internal/petitions) MUST exist to allow authenticated internal users (Employees, Managers, Admins) to retrieve a list of PetitionInstances based on their role-defined scope and provided filters.
  - **Authorization:** The endpoint MUST enforce data scoping:
    - NN_EMPLOYEE/VENDOR_EMPLOYEE: Sees petitions where they are assigned to a task, or the petition is assigned to a team they are a member of.
    - NN_MANAGER/VENDOR_MANAGER: Sees petitions assigned to their team(s) or team members, plus their own assigned task-related petitions.
    - NN_ADMIN: Sees all petitions across all companies.
    - VENDOR_ADMIN: Sees all petitions within their own company.
  -
  - **Request Parameters (Query):**
    - search_term (string, for free-text search)
    - status (array of strings, for PetitionInstance.status)
    - client_id (UUID)
    - assigned_team_id (UUID)
    - assigned_lead_employee_id (UUID)
    - template_type_id (UUID)
    - company_id (UUID, for NN_ADMIN)
    - date_created_start, date_created_end
    - date_updated_start, date_updated_end
    - sort_by (e.g., 'last_updated_at', 'client_name')
    - sort_direction ('asc', 'desc')
    - page (integer)
    - limit (integer)
  -
  - **Response:** Paginated list of petition summaries, including fields necessary for the list view (Petition ID, Client Name, Template Name, Status, relevant counts, dates).
-
- **Rationale:** Provides the data backbone for the internal "Petitions Management" screen, enabling powerful searching and filtering capabilities for staff.
- **Acceptance Criteria:**
  - Endpoint exists and correctly implements role-based data scoping.
  - All specified search and filter parameters function correctly.
  - Pagination and sorting are implemented.
  - Response structure provides all necessary data for the UI.
  - Performance is optimized for querying large datasets.
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
