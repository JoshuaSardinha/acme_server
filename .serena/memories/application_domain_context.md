# National Niner Application Domain Context

## Business Overview
**National Niner** is a comprehensive petition management platform that enables:
- **Clients** to start and complete immigration/legal petitions
- **Vendors** (law firms/agencies) to provide white-label petition services
- **National Niner Admins** to create petition templates and manage the platform

## Core Business Entities

### Petition Templates (Admin-Created)
- **PetitionTemplate**: Complex workflow definitions created by NN_ADMINs
- **DataPoints**: Form fields and data definitions (managed by developers/admins)
- **TaskModels**: Define steps/workflows for specific document types
- **Plans & Benefits**: Pricing tiers and feature packages
- **Conditions**: JEXL expressions for eligibility and workflow logic

### Runtime Petition Workflow
- **PetitionInstance**: Client's active petition based on a template
- **TaskInstance**: Individual tasks within a petition (status-driven lifecycle)
- **TaskInstanceData**: Actual form data and file uploads for tasks

### Multi-Tenant Structure
- **Companies**: National Niner + Vendor companies (status: PENDING_APPROVAL → ACTIVE)
- **Teams**: Groups within companies (LEGAL teams must have lawyers)
- **Users**: Role-based with granular permissions

## Key Business Rules

### Critical Constraints
1. **Multi-tenancy**: Every query MUST include company_id for isolation
2. **LEGAL Teams**: Must always have at least one lawyer (is_lawyer = true)
3. **Task Assignment**: Cannot remove users with active TaskInstances
4. **Status Progression**: Task lifecycle follows strict state machine
5. **Soft Deletes**: All entities use paranoid mode (deleted_at field)

### Permission Patterns
- Format: `resource:action:scope` (e.g., `teams:create:own`, `tasks:reassign:company`)
- **Roles**: CLIENT, VENDOR_EMPLOYEE, VENDOR_MANAGER, VENDOR_ADMIN, NN_EMPLOYEE, NN_MANAGER, NN_ADMIN
- **ABAC**: Context-based on company_id, team membership, task assignment

### Task Lifecycle States
- LOCKED → OPEN → IN_PROGRESS_CLIENT → PENDING_REVIEW → COMPLETED
- Special states: RETURNED_TO_CLIENT, CANCELED, INVALIDATED

## Complex Workflow Features

### Template Engine
- **Condition Evaluation**: JEXL expressions for eligibility/invalidation
- **Task Graph**: Dependencies between tasks (prerequisite → dependent)
- **Multiplicity**: Tasks can have instance_count > 1 (multiple documents)
- **Template Validation**: Complex validation before publishing

### Payment Integration
- **Stripe Integration**: Payment intents for plans and add-ons
- **Upselling**: Post-creation add-on purchases and task upgrades
- **Webhook Handling**: Payment confirmation triggers petition creation

### File Management
- **Secure Upload**: S3 storage with virus scanning (ClamAV)
- **Access Control**: Pre-signed URLs with authorization checks
- **Document Compilation**: PDF merging for final petition documents

## Development Context
This is a **Phase 4** implementation (Weeks 12-15) focusing on:
- Client petition lifecycle completion
- File upload/download security
- Payment processing integration
- Task interaction and status progression

## Priority Order
1. **EPIC 1**: Authentication & Authorization (Foundation)
2. **EPIC 2**: User/Company/Team Management 
3. **EPIC 3**: Template Engine (Admin Tools)
4. **EPIC 4**: Client Petition Lifecycle ← Current Focus
5. **EPIC 5**: Integrations (Files, Notifications, AI)
6. **EPIC 6**: Dashboards & Advanced Views
7. **EPIC 7**: Add-ons & Upgrades
8. **EPIC 8**: Filing & Finalization