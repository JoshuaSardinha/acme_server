# National Niner Backend - Project Overview

## Purpose
Multi-tenant backend API server for the National Niner application, providing comprehensive business management capabilities including authentication, company management, team organization, and granular permission systems.

## Tech Stack
- **Framework**: NestJS with TypeScript
- **Database**: MySQL with Sequelize ORM
- **Authentication**: JWT with Auth0 integration
- **Architecture**: Multi-tenant with company-based isolation
- **Testing**: Comprehensive suite (unit, e2e, integration, security, performance)
- **Documentation**: Swagger/OpenAPI integration

## Key Business Requirements
- **Multi-tenancy**: All data access must include company_id for tenant isolation
- **Security**: JWT authentication + granular permissions system
- **Soft Deletes**: All entities use paranoid mode (no hard deletes)
- **Audit Trail**: All modifications logged
- **Legal Teams**: Must always have at least one lawyer
- **Task Management**: Cannot remove users with active tasks