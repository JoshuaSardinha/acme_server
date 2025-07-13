**Module: Client Application Configuration**

**REQ-APP-001**

- **Requirement Type:** Functional, Configuration
- **Description:** The client application (Flutter) build process MUST support configuration to identify itself as either the primary National Niner app or a specific Vendor's white-label app. This configuration MUST include a unique identifier (e.g., COMPANY_ID for the vendor, or a default/null value for National Niner).
- **Rationale:** Allows the same codebase to serve multiple vendors and the main NN brand, enabling the backend to correctly associate users and petitions.
- **Acceptance Criteria:**
  - Build scripts allow injecting a COMPANY_ID during the build process (e.g., via build flags, environment variables).
  - The running application can access this configured COMPANY_ID.
-
- **Priority:** Must Have
- **Standard/Reference:** Mobile App Build Configuration Practices

**REQ-APP-002**

- **Requirement Type:** Functional, API
- **Description:** The client application MUST include its configured COMPANY_ID (from REQ-APP-001) in relevant API requests where the backend needs context about the application flavor (e.g., during user creation associated with /v1/auth/signup callback handling, or when initiating new petitions). This could be via a custom HTTP header (e.g., X-App-Flavor-Company-ID) or as part of the request body where appropriate and documented in the OAS.
- **Rationale:** Provides backend context for correct company association.
- **Acceptance Criteria:**
  - Client includes COMPANY_ID in specified API calls or contexts.
  - Backend APIs process this identifier.
  - Mechanism (header/body field) is documented in the relevant OAS endpoint definitions.
-
- **Priority:** Must Have
- **Standard/Reference:** API Design Best Practices, OAS 3.x
