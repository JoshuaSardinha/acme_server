# Key Requirements Reference

## Critical Requirements Files Location
All detailed requirements are stored in `.cursor/requirements/` directory:

### Core Architecture Requirements
- **AUTHORIZATION_MODEL.md**: RBAC + ABAC permission patterns
- **CORE_PETITION_TEMPLATE_STRUCTURE.md**: Template engine data models
- **COMPANY_DATA_MODEL_AND_MANAGEMENT.md**: Multi-tenant company structure
- **TASK_INSTANCE_DATA_MODEL.md**: Runtime task workflow entities

### Data Models & Management
- **USER_DATA_MODEL_AND_MANAGEMENT.md**: User roles and permissions
- **TEAM_DATA_MODEL_AND_MANAGEMENT.md**: Team structure and validation
- **CENTRAL_DATA_POINT_DEFINITIONS.md**: Form field definitions
- **TASK_MODELS.md**: Task workflow definitions

### Business Logic Requirements
- **PETITION_INSTANCE_AND_TASK_INSTANCE_CREATION.md**: Runtime workflow creation
- **TASK_INSTANCE_LIFECYCLE_STATUS_AND_STEPS.md**: State machine definitions
- **PETITION_TEMPLATE_CRITERIA.md**: Eligibility conditions (JEXL)
- **PETITION_TEMPLATE_PLANS_AND_BENEFITS.md**: Pricing and features

### Integration Requirements
- **SECURE_FILE_MANAGEMENT.md**: S3 + virus scanning
- **AUTHENTICATION_AND_AUTHORIZATION.md**: Auth0 JWT integration
- **NOTIFICATIONS.md**: OneSignal push notifications
- **AI_PROCESS_INTEGRATION.md**: Gemini API integration

### API & Standards
- **API_STANDARDS_AND_DOCUMENTATION.md**: OpenAPI specifications
- **SYSTEM_SECURITY_AND_COMPLIANCE.md**: Security requirements
- **AUDIT.md**: Audit logging requirements

## How to Use Requirements
1. **Search by domain**: Use pattern matching to find relevant files
2. **Cross-reference**: Many requirements reference others (REQ-XXX-001 format)
3. **Validation rules**: Look for "MUST", "SHOULD", "Acceptance Criteria"
4. **Test scenarios**: Many requirements include specific test cases

## Key Patterns to Search For
- `REQ-[A-Z]+-[0-9]+`: Requirement identifiers
- `MUST|SHOULD|MAY`: Requirement priority levels
- `Acceptance Criteria`: Implementation validation rules
- `Priority: Must Have`: Critical requirements
- `FK to|References`: Database relationship definitions