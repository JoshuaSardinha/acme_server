**Module: Company Data Model & Management (Refactored Paths)**

**REQ-COMP-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist company data in a dedicated Companies table (or equivalent). Each record MUST include:
  - company_id (Primary Key, UUID recommended)
  - name (Company name, Unique)
  - type (Enum: 'NATIONAL_NINER', 'VENDOR')
  - status (Enum: 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED') \- for Vendors
  - created_at (Timestamp)
  - updated_at (Timestamp)
  - billing_plan_id (Nullable FK to a BillingPlans table) \- for Vendors
  - primary_contact_user_id (Nullable FK to Users table) \- Initially the self-registering admin
  - submitted_documents_ref (Reference to stored documents for verification, e.g., path in object storage) \- for Vendors
-
- **Rationale:** Defines the structure for representing National Niner and Vendor companies, including status for the vendor approval workflow and billing info.
- **Acceptance Criteria:**
  - Database schema includes the Companies table with specified fields and constraints.
  - A single 'NATIONAL_NINER' type company record exists (can be seeded).
  - Enum values for type and status are defined.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-COMP-002**

- **Requirement Type:** Functional, API
- **Description:** A public-facing API endpoint MUST exist for prospective vendors to register their company (POST /companies/register-vendor). This endpoint MUST accept company name, primary contact details (email, first name, last name \- which will create the initial VENDOR_ADMIN user), and potentially initial document uploads for verification.
- **Rationale:** Enables vendor self-registration.
- **Acceptance Criteria:**
  - POST /companies/register-vendor endpoint exists.
  - Accepts required details.
  - Creates Company (status 'PENDING_APPROVAL') and initial User (role 'VENDOR_ADMIN') records.
  - Handles verification document upload securely (links to File Management reqs).
  - Sends notifications (user confirmation, NN admin alert).
  - Endpoint documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** OAS 3.x
- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for National Niner Admins (NN_ADMIN) to manage Vendor companies:
  - GET /v1/admin/companies?status=PENDING_APPROVAL\&type=VENDOR: List vendor company applications awaiting approval. Supports pagination and filtering.
  - GET /v1/admin/companies/{companyId}: View details of a specific Vendor company, including submitted verification documents.
  - PATCH /v1/admin/companies/{companyId}/approve: Approve a vendor company application, changing its status to 'ACTIVE'.
  - PATCH /v1/admin/companies/{companyId}/reject: Reject a vendor company application, changing status to 'REJECTED'. Reason for rejection should be recordable and communicable.
  - PATCH /v1/admin/companies/{companyId}/status: Update an active Vendor company's status (e.g., to 'SUSPENDED' or back to 'ACTIVE'). Requires {"status": "SUSPENDED" | "ACTIVE"} in body.
  - POST /v1/admin/companies/vendor: Allows an NN_ADMIN to directly create a new VENDOR Company record and its initial VENDOR_ADMIN user (similar to REQ-USER-004 but initiated by NN_ADMIN). This bypasses the public self-registration and approval flow for vendors directly onboarded by National Niner. The company status would be 'ACTIVE' immediately.
-
- **Rationale:** Provides NN Admins with necessary tools for vendor application management and allows for direct onboarding of pre-vetted vendors.
- **Acceptance Criteria:**
  - Specified endpoints exist and function as described, with appropriate authorization for NN_ADMIN role.
  - Company status is updated correctly in the database.
  - Appropriate notifications are sent to the vendor admin upon status changes.
  - Changes are audited (REQ-SEC-AUDIT-001).
  - Endpoints and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, OWASP A01:2021-Broken Access Control, OAS 3.x

**REQ-COMP-004**

- **Requirement Type:** Non-Functional, Scalability (Future)
- **Description:** The system design SHOULD consider that the number of vendors and clients may grow significantly. Database queries related to companies and users should be optimized using appropriate indexing (e.g., on company_id, role, status).
- **Rationale:** Ensures the system remains performant as the user base expands.
- **Acceptance Criteria:**
  - Key foreign keys and frequently queried fields (like status, type, role) are indexed.
  - Performance tests demonstrate acceptable response times for user/company lookups under simulated load (specific targets TBD).
-
- **Priority:** Should Have
- **Standard/Reference:** Database Performance Tuning

**REQ-COMP-005**

- **Requirement Type:** Data, Functional
- **Description:** The system MUST support defining different billing plans specifically for Vendors to use the white-label service. A VendorBillingPlans table is required, storing plan name, features, monthly cost, etc. The Companies table's billing_plan_id will link to this. Functionality for NN Admins to manage these plans and for integrating with a payment gateway for recurring vendor subscriptions MUST be implemented. (Detailed requirements for this billing subsystem are TBD and constitute a separate feature set).
- **Rationale:** Supports the B2B business model for vendor white-labeling.
- **Acceptance Criteria:**
  - Initial database schema includes VendorBillingPlans table with essential fields (ID, name, cost, description, feature flags).
  - NN Admins can CRUD VendorBillingPlans.
  - Mechanism to associate a Vendor company with a VendorBillingPlan.
  - Placeholder for recurring payment integration.
-
- **Priority:** Must Have (for full Vendor functionality)
- **Standard/Reference:** Subscription Billing Models
