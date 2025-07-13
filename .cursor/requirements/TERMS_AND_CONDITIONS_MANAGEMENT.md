**Module: Terms and Conditions Management**

**REQ-PETI-TNC-001**

- **Requirement Type:** Functional, API, Legal
- **Description:** Before a client can finalize the payment for a petition (plan \+ add-ons), they MUST explicitly accept the Terms and Conditions associated with the selected PetitionTemplatePlan (referenced by PetitionTemplatePlans.terms_and_conditions_id).
  - The client application MUST display the content of the applicable TermsAndConditions document.
  - The client MUST actively indicate acceptance (e.g., via a checkbox).
  - The API endpoint that processes the final order/initiates payment (e.g., POST /v1/orders/checkout or similar, see REQ-ADDON-002) MUST receive an indicator of this acceptance.
  - The system MUST log this acceptance event, storing user_id, plan_id, terms_and_conditions_id (and its version/effective_date), and timestamp_of_acceptance.
-
- **Rationale:** Ensures legal compliance by obtaining and recording client agreement to specific terms for the services purchased. This aligns with the "Payment & Terms Acceptance Screen" mockup.
- **Acceptance Criteria:**
  - Client UI displays relevant T\&C content and provides a clear mechanism for acceptance.
  - Backend API receives confirmation of T\&C acceptance as part of the order finalization/payment initiation.
  - T\&C acceptance is securely logged with all required details for auditing.
  - Payment processing is blocked if T\&C are not accepted.
-
- **Priority:** Must Have
- **Standard/Reference:** Legal Compliance, E-commerce Best Practices

**REQ-PETI-ORDER-001**

- **Requirement Type:** Functional, API
- **Description:** An API endpoint (e.g., POST /v1/orders/checkout) MUST exist to finalize a client's order for a new petition. This endpoint is called _after_ plan selection, add-on selection (if any), and T\&C acceptance (REQ-PETI-TNC-001). The request MUST include:
  - template_id
  - plan_id
  - Array of selected benefit_ids for purchased add-ons (if any).
  - Indicator of T\&C acceptance.
  - Payment method details (or token from payment gateway if using client-side tokenization).  
    This endpoint will:
  - Calculate the total cost (plan cost \+ sum of selected add-on costs).
  - Process payment via the integrated payment gateway.
  - If payment is successful:  
    a. Trigger the creation of the PetitionInstance and its initial Root Form Task (as per REQ-PETI-001).  
    b. Record purchased benefits in PetitionInstanceBenefits (as per REQ-ADDON-001).  
    c. Trigger instantiation of any benefit-specific tasks (as per REQ-PETI-003 / REQ-PTMPL-BEN-TASKLINK-001).
  - Return a success response including the petition_instance_id and the task_instance_id of the Root Form task, or an error if payment/creation fails.
-
- **Rationale:** Provides a single transactional endpoint to confirm the client's choices, process payment, and initiate the creation of all necessary petition-related records and initial tasks. Aligns with "Complete Your Order" screen mockup.
- **Acceptance Criteria:**
  - POST /v1/orders/checkout endpoint exists, is authenticated and authorized for CLIENT role.
  - Calculates total cost accurately.
  - Securely processes payment via the payment gateway.
  - Upon successful payment, all subsequent actions (PetitionInstance creation, Root Form Task creation, benefit recording, benefit task creation) are triggered and completed successfully.
  - T\&C acceptance is verified before proceeding.
  - Returns appropriate success or error response.
  - Endpoint and schemas are documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** E-commerce Checkout Flow, Payment Gateway Integration, REST Principles, OAS 3.x

**REQ-TNC-001**

- **Requirement Type:** Data, Functional
- **Description:** The system MUST allow for storing and managing multiple versions of Terms and Conditions documents in a TermsAndConditions table. Each record MUST include:
  - id (Primary Key, UUID recommended)
  - title (TEXT, e.g., "Standard Plan Terms v1.2", "Vendor Agreement v2.0", NOT NULL)
  - content (TEXT, supporting rich text or Markdown for the full T\&C document, NOT NULL)
  - version (VARCHAR or Integer, e.g., "1.2", NOT NULL)
  - effective_date (DATE, NOT NULL)
  - is_active (Boolean, default: true, NOT NULL) \- Only active T\&Cs can be assigned to new plans.
  - created_by_user_id (UUID, FK to Users.id)
  - created_at (TIMESTAMP WITH TIME ZONE)
-
- **Rationale:** Provides a central repository for T\&C documents that can be versioned and associated with specific petition template plans, as required by REQ-PTMPL-PLAN-001 and seen in payment screen mockups.
- **Acceptance Criteria:**
  - Database schema includes TermsAndConditions table with specified fields.
  - NN Admins can CRUD T\&C documents via a dedicated internal API/interface.
-
- **Priority:** Must Have
- **Standard/Reference:** Legal Compliance, Data Modeling
