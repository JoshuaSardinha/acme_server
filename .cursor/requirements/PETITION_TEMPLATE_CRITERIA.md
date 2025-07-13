**Module: Petition Template Criteria**

**REQ-PTMPL-CRIT-001**

- **Requirement Type:** Data
- **Description:** The system MUST persist template eligibility criteria questions by linking a Petition Template to specific DataPoints intended for eligibility checking. This link MUST be stored in a PetitionTemplateCriteriaLinks table. Each record MUST include:
  - id (Primary Key)
  - template_id (FK to PetitionTemplates, NOT NULL)
  - data_point_id (FK to DataPoints, NOT NULL) \- The data point representing the question.
  - order (Integer, display order of questions)
-
- **Rationale:** Defines the questions asked for eligibility using the central DataPoints definitions (leveraging DataPoints.question_text, data_type, options).
- **Acceptance Criteria:**
  - Database schema includes PetitionTemplateCriteriaLinks table.
  - Ensures criteria questions are based on standardized, reusable data points.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-PTMPL-CRIT-002**

- **Requirement Type:** Data
- **Description:** The system MUST store the overall eligibility condition logic for a template as a field (eligibility_condition TEXT) within the PetitionTemplates table. This string MUST represent the logical expression using DataPoints.system_name as variables (e.g., "(client.years_experience \> 10 AND client.has_degree \== TRUE) OR client.special_case \== TRUE").
- **Rationale:** Stores the rule used to evaluate answers, referencing centrally defined data points via their unique system names.
- **Acceptance Criteria:**
  - PetitionTemplates table includes eligibility_condition field.
  - Format/syntax allowed in the condition string is defined. Variables MUST match DataPoints.system_name.
-
- **Priority:** Must Have
- **Standard/Reference:** Data Modeling Best Practices

**REQ-PTMPL-CRIT-003**

- **Requirement Type:** Functional, API, Security
- **Description:** API endpoints MUST exist for NN Admins (NN_ADMIN) to manage criteria questions (by linking DataPoints) and the condition for a 'DRAFT' Petition Template:
  - POST /v1/petition-templates/{templateId}/criteria/links: Link a DataPoint as a criteria question. Requires data_point_id, order.
  - GET /v1/petition-templates/{templateId}/criteria/links: List linked Data Points (criteria questions) for the template, ordered by order. Returns relevant DataPoints details (question text, type, etc.).
  - DELETE /v1/petition-templates/{templateId}/criteria/links/{linkId}: Unlink a Data Point. Must ensure the DataPoints.system_name is removed/handled in the main condition if it exists.
  - PUT /v1/petition-templates/{templateId}/criteria/condition: Set or update the eligibility_condition string. Backend MUST validate syntax and ensure all variable names used exist as DataPoints.system_name.
  - GET /v1/petition-templates/{templateId}/criteria/condition: Retrieve the current eligibility_condition string.
-
- **Rationale:** Allows NN Admins to define the eligibility screening process using centrally defined Data Points.
- **Acceptance Criteria:**
  - Specified endpoints exist and function. Only NN Admins access for 'DRAFT' templates.
  - Condition string syntax/variable validation uses DataPoints.
  - Endpoints and schemas documented in OAS.
-
- **Priority:** Must Have
- **Standard/Reference:** RBAC, REST Principles, OAS 3.x

**REQ-PTMPL-CRIT-004**

- **Requirement Type:** Functional, Client-Side Logic, API
- **Description:** The backend MUST provide an endpoint (POST /v1/petition-templates/{templateId}/check-eligibility) to evaluate client-provided answers against the template's criteria questions and condition.
  - Input: Answers keyed by variable_name.
  - Output: JSON response { "is_eligible": boolean, "message": "Optional feedback message" }.
  - The client application, upon receiving the response, MUST display the result. If is_eligible is false, the client MUST display a message like "Based on your answers, this petition may not be suitable for you as the minimum criteria appear unmet. You can choose to proceed with creating the petition, but it is not recommended." The client MUST allow the user to proceed to plan selection even if is_eligible is false.
-
- **Rationale:** Implements the eligibility check but allows clients to override the recommendation and continue at their own risk, as requested.
- **Acceptance Criteria:**
  - POST /v1/petition-templates/{templateId}/check-eligibility endpoint exists, takes answers, evaluates condition, returns eligibility status and optional message. Documented in OAS.
  - Client displays the appropriate message based on the is_eligible flag. (POST /v1/petition-templates/{templateId}/check-eligibility returns { "is_eligible": boolean, "message": "..." }. Client displays message but allows proceeding.)
  - Client UI allows proceeding regardless of the eligibility result.
-
- **Priority:** Must Have
- **Standard/Reference:** \-
