**Module: System Security & Compliance**

**General Security Principles:**

- **Defense in Depth:** Implement multiple layers of security controls.
- **Principle of Least Privilege:** Users and system components should only have the permissions necessary to perform their intended functions.
- **Secure by Default:** Configure systems and applications with secure settings out-of-the-box.
- **Fail Securely:** If a system or component fails, it should do so in a way that maintains security.

---

**A01:2021 – Broken Access Control (Consolidated & Detailed)**

**REQ-SEC-BAC-001**

- **Requirement Type:** Security
- **Description:** The system MUST implement robust server-side authorization checks for every API endpoint based on the authenticated user's role (CLIENT, VENDOR_EMPLOYEE, etc.) and relevant attributes (e.g., company_id, team_id, resource ownership, is_lawyer). All authorization decisions MUST be enforced on the server. (Cross-references REQ-AUTHZ-001, REQ-AUTHZ-002, REQ-AUTHZ-003).
- **Rationale:** Prevents users from accessing unauthorized data or functionality by bypassing client-side controls or manipulating requests.
- **Acceptance Criteria:**
  - For every API endpoint, clear authorization rules are defined and implemented server-side.
  - Penetration testing and code reviews verify that users cannot perform actions or access data outside their defined permissions.
  - Attempts to access unauthorized resources result in HTTP 403 Forbidden.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A01:2021

**REQ-SEC-BAC-002**

- **Requirement Type:** Security
- **Description:** API endpoints that operate on specific resources (e.g., /v1/tasks/{taskInstanceId}, /v1/petitions/{petitionInstanceId}) MUST verify that the authenticated user has the right to access/modify that _specific instance_ of the resource, in addition to role-based checks. (e.g., a client can only access their own petitions).
- **Rationale:** Prevents insecure direct object references (IDOR) where a user could potentially access another user's data by guessing resource IDs.
- **Acceptance Criteria:**
  - Ownership or explicit permission checks for specific resource instances are implemented for all relevant endpoints.
  - Testing verifies that users cannot access or modify resources not belonging to them or not explicitly shared/assigned.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A01:2021 (IDOR)

**REQ-SEC-BAC-003**

- **Requirement Type:** Security
- **Description:** The system MUST enforce Cross-Origin Resource Sharing (CORS) policies on the server-side to restrict which origins are allowed to make requests to the API. Policies should be as restrictive as possible (e.g., allowing only the known client application domains/origins).
- **Rationale:** Mitigates risks associated with cross-domain request forgery and unauthorized data access from malicious websites.
- **Acceptance Criteria:**
  - CORS headers (e.g., Access-Control-Allow-Origin) are correctly configured on the server.
  - Policy only allows expected client origins. Wildcard origins (\*) should be avoided for sensitive APIs.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A01:2021, W3C CORS Specification

---

**A02:2021 – Cryptographic Failures (Consolidated & Detailed)**

**REQ-SEC-CRYPTO-001 (Data in Transit)**

- **Requirement Type:** Security
- **Description:** All communication channels between the client application and the backend server, between the server and external services (Auth0, OneSignal, Payment Gateway, AI Services), and between server components (if applicable) MUST use HTTPS enforced with TLS 1.2 or higher. Older TLS/SSL versions (TLS 1.1, 1.0, SSLv3) MUST be disabled.
- **Rationale:** Protects data confidentiality and integrity during transmission against eavesdropping and tampering.
- **Acceptance Criteria:**
  - Server is configured to only accept TLS 1.2+ connections.
  - Valid, trusted SSL/TLS certificates are used.
  - Automated scans (e.g., SSL Labs) confirm strong TLS configuration.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A02:2021, PCI DSS, HIPAA

**REQ-SEC-CRYPTO-002 (Data at Rest \- PII & Documents)**

- **Requirement Type:** Security
- **Description:**
  - All PII fields within specific tables (e.g., Users.email, Users.first_name) MUST be encrypted at rest using AES-256 (or equivalent strong algorithm).
  - Data stored in TaskInstanceData.value\_\* columns MUST be encrypted at rest if the corresponding DataPoints.is_pii flag for its data_point_id is true.
  - All uploaded documents (legal documents, evidence files) MUST be encrypted at rest in object storage (REQ-FMAN-002).  
    Key management MUST follow REQ-SEC-CRYPTO-003.
-
- **Rationale:** Protects sensitive data, including dynamic data collected in tasks, based on its PII classification in DataPoints.
- **Acceptance Criteria:**
  - Specified PII fields in tables like Users are encrypted.
  - Values in TaskInstanceData linked to PII DataPoints are encrypted.
  - Object storage encryption is enabled.
  - Application can decrypt for authorized use.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A02:2021, GDPR Art. 32

**REQ-SEC-CRYPTO-003 (Key Management)**

- **Requirement Type:** Security
- **Description:** Cryptographic keys used for data-at-rest encryption (database field encryption, document encryption if using client-side or application-level encryption) MUST be managed securely. This includes:
  - Using a dedicated Key Management Service (KMS) (e.g., AWS KMS, Azure Key Vault, HashiCorp Vault) where possible.
  - Strong key generation and regular key rotation policies.
  - Strict access controls to the KMS and keys.
  - Never hardcoding keys in application code or configuration files.
-
- **Rationale:** Protects the keys that protect the data. Compromise of keys renders encryption useless.
- **Acceptance Criteria:**
  - Key management strategy is documented and implemented.
  - KMS is used if feasible.
  - Keys are not present in source code or unencrypted configuration.
  - Key rotation procedures are defined.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A02:2021, NIST SP 800-57

**REQ-SEC-CRYPTO-004 (Hashing Passwords \- Auth0 Handled)**

- **Requirement Type:** Security
- **Description:** User passwords MUST NOT be stored by the application. Authentication is delegated to Auth0, which is responsible for securely hashing and storing password credentials.
- **Rationale:** Application avoids the significant risk and complexity of managing user passwords directly.
- **Acceptance Criteria:**
  - Application does not store or handle user passwords directly.
  - Auth0 integration handles all password-related operations.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A02:2021 (Related to not storing secrets insecurely)

---

**A03:2021 – Injection (Consolidated & Detailed)**

**REQ-SEC-INJECT-001 (Input Validation)**

- **Requirement Type:** Security
- **Description:** All input data received by the server (URL path parameters, query parameters, request headers, request bodies) MUST be rigorously validated on the server-side before being processed or stored. Validation MUST include:
  - **Type checking:** Based on DataPoints.data_type and OAS schema definitions.
  - **Structural validation:** Adherence to JSON Schema for request bodies (see REQ-SEC-INJECT-003).
  - **Specific constraints:** Using DataPoints.validation_rules (e.g., regex, min/max length/value).
  - **Allow-list validation:** For parameters with a known set of allowed values (e.g., enums).
  - **Output Encoding/Sanitization:** Before rendering any user-supplied data back to a client (especially in web contexts if a web admin panel is built), data MUST be contextually encoded (e.g., HTML entity encoding, JavaScript encoding) to prevent Cross-Site Scripting (XSS). For data used in other contexts (e.g., constructing OS commands \- AVOID), proper escaping is critical.
-
- **Rationale:** Prevents injection flaws by ensuring data conforms to expected patterns and by neutralizing malicious payloads for various contexts.
- **Acceptance Criteria:**
  - Server-side input validation is implemented for all API endpoints using a consistent framework (e.g., integrating with OAS schema validation, custom validators using DataPoints metadata).
  - Invalid input results in HTTP 400 Bad Request or 422 Unprocessable Entity with clear, non-sensitive error messages.
  - Contextual output encoding is applied if data is reflected in UIs served by the backend.
  - Penetration testing specifically targets injection vulnerabilities.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A03:2021, OWASP XSS Prevention Cheat Sheet
-

**REQ-SEC-INJECT-002 (Parameterized Queries / ORM)**

- **Requirement Type:** Security
- **Description:** All database queries that involve user-supplied data MUST use parameterized queries (prepared statements) or an Object-Relational Mapper (ORM) / Object-Document Mapper (ODM) that inherently uses parameterized queries. Dynamic query construction with string concatenation of user input is strictly forbidden.
- **Rationale:** Primary defense against SQL Injection (SQLi) and NoSQL Injection vulnerabilities.
- **Acceptance Criteria:**
  - Code review confirms no direct string concatenation of user input into database queries.
  - ORM/ODM or parameterized query libraries are used consistently for all database interactions.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A03:2021 (SQLi)

**REQ-SEC-INJECT-003 (JSON Schema Validation)**

- **Requirement Type:** Security, API
- **Description:** The structure and data types of API request and response payloads (JSON) MUST be defined using JSON Schema. The server MUST validate incoming request bodies against their defined JSON Schema (as part of REQ-SEC-INJECT-001).
- **Rationale:** Ensures structural integrity of data and provides a clear contract for API interactions, aiding in early rejection of malformed requests. Aligns with OpenAPI specification.
- **Acceptance Criteria:**
  - JSON Schemas are defined for all API request/response bodies in the OAS document.
  - Server-side validation against these schemas is performed.
-
- **Priority:** Must Have
- **Standard/Reference:** JSON Schema, OAS 3.x, OWASP A03:2021 (Data validation aspect)

---

**A04:2021 – Insecure Design (High-Level Principle)**

**REQ-SEC-DESIGN-001**

- **Requirement Type:** Security
- **Description:** The system design MUST incorporate threat modeling during the design and development phases to identify potential threats, vulnerabilities, and required mitigations. Security considerations MUST be integrated throughout the entire software development lifecycle (SDL).
- **Rationale:** Proactively addresses security risks from the outset rather than treating security as an afterthought.
- **Acceptance Criteria:**
  - Evidence of threat modeling activities (e.g., diagrams, identified threats, planned mitigations).
  - Security requirements are reviewed and updated as the design evolves.
-
- **Priority:** Must Have
- ## **Standard/Reference:** OWASP A04:2021, Microsoft SDL

**A05:2021 – Security Misconfiguration (Consolidated & Detailed)**

**REQ-SEC-MISCONF-001 (Secure Headers)**

- **Requirement Type:** Security
- **Description:** The backend server MUST set appropriate HTTP security headers in responses to the client to protect against common web vulnerabilities. These include, but are not limited to:
  - Strict-Transport-Security (HSTS): Enforces HTTPS.
  - Content-Security-Policy (CSP): Prevents XSS by restricting sources of content.
  - X-Content-Type-Options: nosniff: Prevents MIME-sniffing attacks.
  - X-Frame-Options: DENY or SAMEORIGIN: Protects against clickjacking.
  - Referrer-Policy: strict-origin-when-cross-origin or similar.
  - Permissions-Policy (formerly Feature-Policy): Controls browser feature access.
-
- **Rationale:** Hardens the client-side against various attacks by leveraging browser-based security mechanisms.
- **Acceptance Criteria:**
  - Server responses include the specified security headers with appropriate, restrictive configurations.
  - Headers are verified using browser developer tools or security scanning tools.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A05:2021, MDN Web Docs for each header

**REQ-SEC-MISCONF-002 (Disable Unnecessary Features/Services)**

- **Requirement Type:** Security
- **Description:** All unnecessary features, services, ports, protocols, and default accounts MUST be disabled or removed from the server environment and application dependencies. Verbose error messages revealing backend details MUST be disabled in production environments.
- **Rationale:** Reduces the attack surface of the system.
- **Acceptance Criteria:**
  - Server hardening procedures are documented and applied.
  - Application frameworks are configured to not reveal sensitive error details in production.
  - Regular reviews of enabled services and open ports.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A05:2021, CIS Benchmarks

**REQ-SEC-MISCONF-003 (Dependency Management)**

- **Requirement Type:** Security
- **Description:** A process MUST be in place to regularly scan and update third-party libraries and dependencies (both client and server-side) for known vulnerabilities. Outdated or vulnerable components MUST be patched or replaced promptly.
- **Rationale:** Addresses vulnerabilities in reusable components (OWASP A06:2021 \- Vulnerable and Outdated Components).
- **Acceptance Criteria:**
  - Tools for dependency scanning (e.g., npm audit, Snyk, OWASP Dependency-Check) are integrated into the CI/CD pipeline.
  - A policy for addressing identified vulnerable dependencies is defined and followed.
-
- **Priority:** Must Have
- ## **Standard/Reference:** OWASP A06:2021 (Covered here as it's often a misconfiguration to use outdated parts)

**A07:2021 – Identification and Authentication Failures (Auth0 Focused)**

**REQ-SEC-AUTHN-001 (Auth0 Integration Security)**

- **Requirement Type:** Security
- **Description:** The integration with Auth0 MUST follow security best practices:
  - Use Authorization Code Flow with PKCE for client authentication (REQ-AUTH-001).
  - Securely store client secrets (if applicable for any backend Auth0 interactions, e.g., Management API) using a secrets manager.
  - Regularly review Auth0 tenant security settings (MFA policies, brute-force protection, breached password detection).
  - Validate JWTs correctly on the backend (issuer, audience, signature, expiration) (REQ-AUTH-002).
  - Implement secure session management and logout (REQ-AUTH-004).
-
- **Rationale:** Ensures the third-party identity provider is used securely.
- **Acceptance Criteria:**
  - Auth0 configuration adheres to its security recommendations.
  - JWT validation is comprehensive.
  - Client-side token storage and handling are secure.
-
- **Priority:** Must Have
- ## **Standard/Reference:** OWASP A07:2021, Auth0 Documentation

**A08:2021 – Software and Data Integrity Failures (File Uploads)**

**REQ-SEC-INTEGRITY-001 (Secure File Uploads)**

- **Requirement Type:** Security, File Management
- **Description:** The system MUST implement secure file upload mechanisms:
  - Validate file types using an allow-list of permitted extensions and MIME types (server-side).
  - Enforce maximum file size limits.
  - Scan uploaded files for malware/viruses before storing or processing them.
  - Store uploaded files in a designated, non-executable location separate from application code (e.g., dedicated object storage).
  - Generate and store a cryptographic hash (e.g., SHA-256) of uploaded files on upload and verify this hash on download to ensure integrity. (See REQ-FMAN-003)
-
- **Rationale:** Prevents attacks via malicious file uploads (e.g., webshells, malware). Ensures file integrity.
- **Acceptance Criteria:**
  - File type, size, and virus scan validations are performed server-side.
  - Files are stored securely. Hash generation and verification implemented.
  - Attempting to upload disallowed file types or oversized files is rejected.
-
- **Priority:** Must Have
- ## **Standard/Reference:** OWASP A08:2021, OWASP File Upload Cheat Sheet

**A09:2021 – Security Logging and Monitoring Failures (Consolidated Auditing)**

**REQ-SEC-AUDIT-001 (Comprehensive Audit Logging)**

- **Requirement Type:** Security, Auditing
- **Description:** The system MUST implement comprehensive audit logging for security-relevant events. Logs MUST be detailed enough to reconstruct events and identify potential misuse. Key events to log include:
  - **Authentication & Session Management:** Logins (success/failure), logouts, password reset attempts (via Auth0), significant token validation failures (REQ-AUTH-003).
  - **Authorization:** Significant or repeated authorization failures (attempts to access forbidden resources or perform unauthorized actions).
  - **User & Company Administration:** User creation/invitation, role changes, status changes (activation/deactivation), is_lawyer status changes. Company creation, status changes (approval, rejection, suspension). Vendor billing plan changes. (Partially covered by original REQ-AUDIT-001).
  - **Team Management:** Team creation, owner changes, category changes, member additions/removals, team deactivation.
  - **Petition Template Management:** Template creation, publishing, archiving, versioning. Changes to critical components like plans, criteria, or graph definitions.
  - **Petition Instance & Task Management:** Petition creation, status changes (e.g., to 'COMPILED', 'FILED'). Task creation, assignment/reassignment, significant status changes (e.g., 'COMPLETED', 'RETURNED_TO_CLIENT', 'CANCELED'). Task upgrades, Add-on purchases.
  - **Data Access & Modification (Critical Data):**
    - File Management: Upload, download, deletion of any file (REQ-FMAN-007).
    - Access to or export of data from TaskInstanceData where the associated DataPoints.is_pii is true, particularly if unmasked. If PII data is included in log details, it MUST be masked or only non-sensitive identifiers logged.
  -
  - **AI Process Invocations:** (REQ-AI-005).
  - **System & Security Events:** Key configuration changes, security policy violations, startup/shutdown of critical services, errors from security components.
  - Each log entry MUST include: Timestamp (UTC, synchronized across system components), Performing User ID (or system process ID), Authenticated User Role (if applicable), Source IP Address, Action Performed (standardized event type), Target Resource Type & ID (if applicable), Outcome (Success/Failure), and any relevant descriptive details or error codes.
-
- **Rationale:** Enables detection of suspicious activity, supports incident response and forensic analysis, provides accountability, and is often required for compliance.
- **Acceptance Criteria:**
  - All specified categories of events are logged with the required level of detail.
  - Audit logs are written to a secure, central, and tamper-evident storage (e.g., dedicated log management system like ELK/Splunk, or cloud provider solution like AWS CloudTrail/CloudWatch Logs with write-only S3 bucket, versioning, and MFA delete).
  - Logs are protected from unauthorized access, modification, or deletion.
  - Logs are retained according to a defined policy that meets legal, regulatory, and business requirements.
  - Log format is consistent and parsable.
-
- **Priority:** Must Have
- **Standard/Reference:** OWASP A09:2021, NIST SP 800-92, GDPR Art. 30 & 32, CCPA, HIPAA

**REQ-SEC-AUDIT-002 (Log Monitoring & Alerting)**

- **Requirement Type:** Security, Monitoring
- **Description:** A process or system MUST be in place to regularly review and monitor security logs for suspicious activities or anomalies. Automated alerts SHOULD be configured for high-severity security events (e.g., multiple failed logins for an account, privilege escalation attempts).
- **Rationale:** Ensures that logs are not just collected but actively used to detect and respond to potential security incidents.
- **Acceptance Criteria:**
  - A log monitoring solution (e.g., ELK stack, Splunk, AWS CloudWatch Logs with Alarms) is implemented.
  - Alerting rules are defined for critical security events.
  - Procedures for responding to alerts are documented.
-
- **Priority:** Should Have (Must Have for high-security environments)
- ## **Standard/Reference:** OWASP A09:2021

**A10:2021 – Server-Side Request Forgery (SSRF)**

**REQ-SEC-SSRF-001 (Protect Against SSRF)**

- **Requirement Type:** Security
- **Description:** If the application makes server-side requests to URLs provided or influenced by user input (e.g., webhook URLs, AI service endpoints if configurable by users which is NOT currently the case but good to note), it MUST implement defenses against SSRF. This includes:
  - Validating any user-supplied URL against an allow-list of permitted domains/IPs and schemes (e.g., only HTTPS to known hosts).
  - Avoiding direct use of user input in request URLs.
  - Using network controls (e.g., firewalls) to limit server outbound connectivity.
-
- **Rationale:** Prevents attackers from forcing the server to make unintended requests to internal or external services. _Current design (AI endpoints centrally managed) limits this risk, but this is a general best practice._
- **Acceptance Criteria:**
  - If user-influenced URLs are ever introduced, SSRF protections are implemented and verified.
  - Server outbound network access is restricted to only necessary services.
-
- **Priority:** Should Have (Becomes Must Have if user-controlled URLs are used)
- ## **Standard/Reference:** OWASP A10:2021, OWASP SSRF Cheat Sheet

**Compliance & Data Privacy (General)**

**REQ-SEC-COMPL-001**

- **Requirement Type:** Compliance, Legal
- **Description:** The system design and operation MUST consider and adhere to relevant data privacy and security regulations (e.g., GDPR if EU residents' data is processed, CCPA if California residents, HIPAA if health information is involved, specific legal profession data handling rules for Arizona/US). This includes principles like data minimization, purpose limitation, user consent (if applicable beyond terms of service for specific data uses), data subject rights (access, rectification, erasure), breach notification procedures.
- **Rationale:** Ensures legal and regulatory compliance.
- **Acceptance Criteria:**
  - A Data Privacy Impact Assessment (DPIA) is conducted if required by regulations.
  - Mechanisms to support data subject rights are designed (e.g., data export, account deletion that properly handles data).
  - Privacy policy and terms of service accurately reflect data handling practices.
-
- **Priority:** Must Have
- **Standard/Reference:** GDPR, CCPA, HIPAA (as applicable), local legal ethics rules.
