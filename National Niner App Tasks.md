### **Actionable Project Backlog: Detailed Task Breakdown**

#### **EPIC 0: Project Setup & Foundational Infrastructure**

_Objective: Establish a stable, testable, and maintainable project foundation before any business logic is written._

- **Task 0.1: Initialize NestJS Project & Configure Core Tooling**
  - **Description:**
    1. Use the NestJS CLI (nest new national-niner-backend) to generate the initial project structure.
    2. Configure ESLint (.eslintrc.js) with strict rules (e.g., plugin:@typescript-eslint/recommended, no-any).
    3. Configure Prettier (.prettierrc) to enforce a consistent code style.
    4. Create a .vscode/settings.json to enable format-on-save for team consistency.
    5. Create a .nvmrc file specifying the exact Node.js version to be used.
  -
  - **Deliverables:** A Git repository containing the initial NestJS project. A README.md file with setup instructions.
  - **Testing:** Not applicable.
-
- **Task 0.2: Dockerize the Development Environment**
  - **Description:**
    1. Create a Dockerfile for the NestJS application itself. It should use a multi-stage build to create a small, optimized production image.
    2. Create a docker-compose.yml file that defines two services: app (the NestJS backend) and db (a MySQL 8 instance).
    3. The db service should use a volume to persist data locally between runs.
    4. The app service should mount the local source code for live-reloading during development.
    5. Configure environment variables (.env file, referenced in docker-compose.yml) for database credentials.
  -
  - **Deliverables:** Dockerfile, docker-compose.yml, updated README.md with instructions to run docker-compose up.
  - **Testing:** Run docker-compose up. The NestJS app should start, connect to the MySQL container, and not crash.
-
- **Task 0.3: Integrate Sequelize & Create Initial Migration**
  - **Description:**
    1. Install Sequelize, sequelize-cli, mysql2, and necessary TypeScript types (@types/sequelize).
    2. Create a DatabaseModule in NestJS. This module will configure the Sequelize instance and provide it to the rest of the application.
    3. Initialize sequelize-cli (npx sequelize-cli init) and configure its config/config.json to read from the environment variables set in Docker Compose.
    4. Create the first migration using sequelize-cli migration:generate. This migration will be empty for now, just to test the process.
    5. Run the migration (npx sequelize-cli db:migrate) to ensure the SequelizeMeta table is created in the database.
  -
  - **Deliverables:** A DatabaseModule, Sequelize model configuration, and the first successful migration file.
  - **Testing:** The db:migrate command must succeed. The application must start without database connection errors.
-
- **Task 0.4: Implement Centralized Logging Service**
  - **Description:**
    1. Install a production-grade logger like pino and its bindings for NestJS (nestjs-pino).
    2. Configure the AppModule to use pino for all application logging.
    3. Logs should be formatted as structured JSON to be easily parsable by log aggregators.
    4. In development, logs should be "pretty-printed" for readability.
  -
  - **Deliverables:** A globally configured logging service.
  - **Testing:** Manually trigger a log message from a test endpoint (e.g., this.logger.log('Hello World')) and verify it appears in the console in the correct format.
-
- **Task 0.5: Implement Global Exception Filter**
  - **Description:**
    1. Create a global exception filter using the @Catch() decorator in NestJS.
    2. This filter will catch all unhandled exceptions.
    3. It should differentiate between HttpException (and its subclasses) and unexpected system errors.
    4. For HttpException, it should return the status code and message provided by the exception.
    5. For all other errors, it must log the full stack trace and return a generic 500 Internal Server Error response ({ "statusCode": 500, "message": "An unexpected error occurred." }) to avoid leaking implementation details.
  -
  - **Deliverables:** A GlobalExceptionFilter class applied globally in main.ts.
  - **Testing:**
    1. **Scenario 1 (HTTP Exception):** Create a test endpoint that throws new NotFoundException(). Verify the API returns a 404 status with the correct JSON body.
    2. **Scenario 2 (System Error):** Create a test endpoint that throws a generic new Error('Something broke'). Verify the API returns a 500 status with the generic error body and that the full error is logged to the console.
  -
-
- **Task 0.6: Implement Base CI/CD Pipeline**
  - **Description:**
    1. Create a GitHub Actions workflow file (.github/workflows/ci.yml).
    2. The workflow should trigger on pushes to main and all pull requests.
    3. Define jobs for:
       - lint: Runs npm run lint.
       - test: Installs dependencies, starts up the database container, runs all unit and integration tests (npm run test), and then runs e2e tests (npm run test:e2e).
       - build: Ensures the application builds successfully (npm run build).
    4.
    5. The test job must be configured to fail if any tests fail.
  -
  - **Deliverables:** A functioning ci.yml file.
  - **Testing:** Push a commit with a failing test. Verify the GitHub Action run fails as expected. Fix the test and verify it passes.
- ***

#### **EPIC 1: Advanced Authentication & Permission-Based Authorization**

_Objective: Create a flexible and secure Role-Permission authorization model. All endpoints must be secured by default._

- **Task 1.1: Create Authorization Data Models & Seed Data**
  - **Description:**
    - Using sequelize-cli, generate migrations to create the Roles, Permissions, RolePermissions, and UserPermissions tables. Define all columns, types, foreign keys, and indexes as per the model design.
    - Create a Sequelize seed file (npx sequelize-cli seed:generate) to populate the Permissions table with all the granular permissions identified (e.g., templates:create, users:invite:nn, company:approve).
    - Seed the Roles table with the initial roles (e.g., NN_ADMIN, VENDOR_ADMIN, CLIENT).
    - Seed the RolePermissions table to link the initial roles to their default set of permissions.
  -
  - **Deliverables:** Four migration files and a seed file.
  - **Testing:** Run db:migrate and db:seed. Verify in the database that all tables are created and populated correctly.
-
- **Task 1.2: Implement Auth0 JWT Validation Guard**
  - **Description:**
    - Install passport, passport-jwt, @nestjs/passport.
    - Create an AuthModule.
    - Create a JwtStrategy that extends PassportStrategy. It will use jwks-rsa to fetch the signing key from your Auth0 tenant's JWKS URI. It must validate the token's audience and issuer against environment variables.
    - Create a JwtAuthGuard that uses this strategy.
    - Apply this guard globally in main.ts so that all endpoints are protected by default. Public endpoints will need an @Public() decorator to opt-out.
  -
  - **Deliverables:** AuthModule, JwtStrategy.ts, JwtAuthGuard.ts, @Public() decorator.
  - **Testing:**
    - **Scenario 1 (No Token):** Call a protected test endpoint without an Authorization header. Verify it returns a 401 Unauthorized.
    - **Scenario 2 (Invalid Token):** Call the endpoint with an expired or malformed JWT. Verify it returns a 401\.
    - **Scenario 3 (Valid Token):** Call the endpoint with a valid JWT from Auth0. Verify it returns a 200 OK.
    - **Scenario 4 (Public Endpoint):** Call an endpoint decorated with @Public() without a token. Verify it returns a 200 OK.
  -
-
- **Task 1.3: Develop User Permission Caching Service**
  - **Description:**
    - Create a PermissionsService within the AuthModule.
    - This service will have a method getEffectivePermissionsForUser(userId). This method queries the database to find all permissions granted to the user via their assigned role(s) AND any direct UserPermissions.
    - To improve performance, implement caching for this permission set (e.g., using NestJS's built-in CacheModule with an in-memory or Redis store). The cache should be invalidated when a user's role or direct permissions are changed.
  -
  - **Deliverables:** PermissionsService.ts with caching logic.
  - **Testing:** Write unit tests for the service.
    - **Scenario 1:** A user has one role. Verify the service returns the correct permissions for that role.
    - **Scenario 2:** A user has a role and a direct permission. Verify the service returns the union of both sets.
    - **Scenario 3:** Call the service twice for the same user. Verify the second call hits the cache (can be mocked/spied on).
  -
-
- **Task 1.4: Implement PermissionsGuard**
  - **Description:**
    - Create a custom decorator @RequirePermissions(...permissions: string\[\]).
    - Create the PermissionsGuard. Inside its canActivate method, it will:  
      a. Extract the required permissions from the decorator using the Reflector service.  
      b. Get the user ID from the request.user object (populated by the JwtAuthGuard).  
      c. Call the PermissionsService.getEffectivePermissionsForUser() from Task 1.3.  
      d. Check if the user's effective permissions include ALL of the required permissions.  
      e. Return true if they do, or throw a ForbiddenException if they don't.
  -
  - **Deliverables:** permissions.decorator.ts, PermissionsGuard.ts.
  - **Testing:** Create a test controller with endpoints protected by this guard.
    - **Scenario 1 (Sufficient Permissions):** Call an endpoint requiring 'test:read' with a user who has that permission. Verify 200 OK.
    - **Scenario 2 (Insufficient Permissions):** Call the same endpoint with a user who does _not_ have that permission. Verify 403 Forbidden.
    - **Scenario 3 (Multiple Permissions):** Protect an endpoint with ('test:read', 'test:write'). Call it with a user who only has 'test:read'. Verify 403 Forbidden.
  -
-
- **Task 1.5: Implement Custom User Signup Module**
  - **Description:**
    - Create a UserModule.
    - Define the User Sequelize model and a corresponding migration. Include fields like id, auth0UserId, email, firstName, lastName, roleId.
    - Create a UserService.
    - Create an AuthController with the POST /v1/auth/signup endpoint. This endpoint must be public.
    - The controller will use a DTO (CreateUserDto) with class-validator decorators to validate the incoming request body (e.g., @IsEmail(), @MinLength(8) for password).
    - The UserService will contain the logic to create the user in the local DB and call the Auth0ManagementService (from the next task) to provision the user in Auth0. It must handle potential race conditions or errors (e.g., user already exists in Auth0 but not locally).
  -
  - **Deliverables:** UserModule, UserService, AuthController, CreateUserDto.
  - **Testing:** Write E2E tests for the signup endpoint.
    - **Scenario 1 (Success):** Post valid data. Verify a 201 Created response. Spy on the Auth0ManagementService to ensure it was called with the correct parameters. Check the database to ensure the user was created.
    - **Scenario 2 (Invalid Email):** Post with a malformed email. Verify a 400 Bad Request with a descriptive validation error.
    - **Scenario 3 (User Exists):** Post with an email that already exists in the database. Verify a 409 Conflict.
  -
-
- **Task 1.6: Implement Auth0 Management API Service**
  - **Description:**
    - Create an Auth0ManagementService within the AuthModule.
    - This service will use the auth0 Node.js library to communicate with the Auth0 Management API.
    - It will require its own client ID and secret, which must be stored securely and not in Git.
    - Implement a method createUser(email, password) that creates a new user in the Auth0 database connection.
    - Implement a method sendVerificationEmail(userId) and sendPasswordChangeTicket(userId) for future use.
  -
  - **Deliverables:** Auth0ManagementService.ts.
  - **Testing:** Write integration tests for this service that (in a test environment) actually call a _test_ Auth0 tenant.
    - **Scenario 1:** Call createUser. Verify the user appears in the Auth0 test tenant. Clean up the user after the test.
    - **Scenario 2:** Attempt to create a user that already exists. Verify Auth0's API returns the expected error and the service handles it gracefully.
  -
- ***

### **EPIC 2: User, Company & Team Management**

_Objective: Build the core business logic for managing the primary entities of the system, with strict permission-based access control._

- **Task 2.1: Create Company & Team Data Models**
  - **Description:**
    - Using sequelize-cli, generate migrations to create the Companies, Teams, and TeamMembers tables.
    - Define all columns as specified in the requirements (REQ-COMP-001, REQ-TEAM-001, REQ-TEAM-002), including data types, nullability, and default values.
    - Establish foreign key relationships using Sequelize associations: A Company has many Users, a Company has many Teams. A Team belongs to a Company and has an owner_user_id. Users and Teams have a many-to-many relationship through the TeamMembers table.
    - Add a unique composite key constraint on (team_id, user_id) in the TeamMembers table. Add a unique constraint on (company_id, name) in the Teams table.
  -
  - **Deliverables:** Three migration files.
  - **Testing:** Run db:migrate. Inspect the database schema to verify all tables, columns, relationships, and constraints are correctly created.
-
- **Task 2.2: Implement GET /users/me Endpoint**
  - **Description:**
    - In the UserController from Epic 1, create a getProfile method for the route GET /users/me.
    - This endpoint is protected by the JwtAuthGuard, but does not need a PermissionsGuard.
    - The UserService will fetch the user's record from the local DB using the auth0UserId from the JWT payload. It will also join the Company and Role tables to include the user's company name and role name in the response.
    - Create a response DTO (UserProfileDto) to structure the output, ensuring no sensitive data (like password hashes, internal state) is returned. It must include the user's effective permissions as calculated in Task 1.5.
  -
  - **Deliverables:** A fully functional GET /users/me endpoint.
  - **Testing:** Write an E2E test.
    - **Scenario 1:** Call the endpoint with a valid token for a user. Verify the response is 200 OK and contains the correct user profile data and permissions array.
  -
-
- **Task 2.3: Implement User Invitation Module (NN_ADMIN)**
  - **Description:**
    - In the UserController (or a new AdminController), create a nnInvite method for POST /users/nn-invite.
    - Protect the endpoint with @RequirePermissions('users:invite:nn').
    - Create an NnInviteDto with validation for email, firstName, lastName, role, and is_lawyer. The role enum must be restricted to NN roles.
    - The UserService logic will:  
      a. Verify the target role is a valid National Niner role.  
      b. Find the 'National Niner' company record ID.  
      c. Create the user in the local DB, associating them with the NN company and the specified role.  
      d. Call the Auth0ManagementService.createUser() and sendPasswordChangeTicket() (or similar invitation flow).
  -
  - **Deliverables:** A POST /users/nn-invite endpoint.
  - **Testing:** Write E2E tests.
    - **Scenario 1 (Success):** Call with a user who has users:invite:nn permission and valid data. Verify 201 Created. Spy on services to confirm DB and Auth0 were called correctly.
    - **Scenario 2 (Forbidden):** Call with a user who does _not_ have the permission. Verify 403 Forbidden.
    - **Scenario 3 (Bad Data):** Call with an invalid role (e.g., 'VENDOR_ADMIN'). Verify 400 Bad Request.
  -
-
- **Task 2.4: Implement User Invitation Module (VENDOR_ADMIN)**
  - **Description:**
    - In the same controller, create a vendorInvite method for POST /users/vendor-invite.
    - Protect with @RequirePermissions('users:invite:vendor').
    - The UserService logic will be more complex:  
      a. Get the calling admin's company*id from their user record.  
      b. Verify the target role is a valid Vendor role.  
      c. Create the user locally, associating them with the \_admin's own company ID* and the specified role.  
      d. Provision the user in Auth0.
  -
  - **Deliverables:** A POST /users/vendor-invite endpoint.
  - **Testing:** Write E2E tests.
    - **Scenario 1 (Success):** Call as a VENDOR*ADMIN. Verify the new user is created within the \_same* company as the admin.
    - **Scenario 2 (Forbidden):** Call as an NN_ADMIN or CLIENT. Verify 403 Forbidden.
  -
-
- **Task 2.5: Implement Company Registration & Management**
  - **Description:**
    - Create a CompanyModule, CompanyService, and CompanyController.
    - Implement the public endpoint POST /companies/register-vendor (REQ-COMP-002). This is a complex transactional flow: create the Company with PENDING_APPROVAL status, then create the initial VENDOR_ADMIN User and provision them in Auth0.
    - Implement the admin management endpoints from REQ-COMP-003 (list, approve, reject, suspend). Each endpoint must be protected by the appropriate granular permission (e.g., 'company:approve', 'company:suspend').
  -
  - **Deliverables:** A full CompanyModule with all specified endpoints.
  - **Testing:** Extensive E2E tests for each endpoint, covering success paths and all authorization failure cases. Test the transactional nature of vendor registration (if user creation fails, company creation should be rolled back).
-
- **Task 2.6: Implement Team CRUD APIs**
  - **Description:**
    - Create a TeamModule, TeamService, and TeamController.
    - Implement POST /v1/teams, GET /v1/teams, GET /v1/teams/{teamId}, PATCH /v1/teams/{teamId}.
    - The service logic for creation/updates must enforce business rules: the owner_user_id must be a Manager/Admin from the same company.
    - Authorization logic must be robust:
      - An NN_ADMIN ('teams:create:any') can specify a company_id.
      - A VENDOR_ADMIN ('teams:create:own') cannot; the company_id is inferred from their own profile.
      - Listing and retrieving teams must be scoped based on the user's role and company affiliation.
    -
  -
  - **Deliverables:** A full TeamModule.
  - **Testing:** E2E tests for all endpoints.
    - **Scenario 1:** NN_ADMIN creates a team for Company A.
    - **Scenario 2:** VENDOR_ADMIN for Company A creates a team (no company_id in payload).
    - **Scenario 3:** VENDOR_EMPLOYEE from Company A tries to list teams and only sees teams from Company A they are a member of.
    - **Scenario 4:** VENDOR_ADMIN from Company B tries to access a team from Company A. Verify 403/404.
  -
-
- **Task 2.7: Implement Team Membership Management APIs**
  - **Description:**
    - In the TeamController, implement POST /v1/teams/{teamId}/members and DELETE /v1/teams/{teamId}/members/{userId}.
    - The TeamService must contain all critical validation logic from REQ-TEAM-006 and REQ-TEAM-007:
      - Check user and team are in the same company.
      - Prevent removing the team owner.
      - **Crucially:** Prevent removing the last lawyer from a 'LEGAL' team. This requires querying all members of the team to check their is_lawyer status before allowing the deletion.
      - Prevent removing a user with active TaskInstances. This requires a new dependency on the (future) TaskInstanceService.
    -
  -
  - **Deliverables:** Membership management endpoints.
  - **Testing:** Unit tests for the service logic are critical here.
    - **Test Case:** should throw ConflictException when removing the last lawyer from a LEGAL team.
    - **Test Case:** should throw UnprocessableEntityException when removing a user with active assigned tasks.
  -
- ***

### **EPIC 3: Core Petition Template Engine**

_Objective: Build the highly complex backend engine for admins to define petition templates, tasks, plans, and workflows._

- **Task 3.1: Implement All Template Engine Data Models**
  - **Description:** This is a very large modeling task. Create Sequelize models and migrations for every table defined in the requirements related to templates. This includes PetitionTemplates, PetitionTemplateTabs, DataPoints, OptionLists, DocumentTypes, TaskModels, TaskModelSteps, Benefits, ContentBlocks, and all the many-to-many join tables (PlanIncludedBenefits, TaskModelDataPointLinks, etc.).
  - **Deliverables:** A complete set of migration and model files for the entire template engine.
  - **Testing:** db:migrate must succeed. Review schema for correctness.
-
- **Task 3.2: Implement ContentBlocks and DataPoints CRUD**
  - **Description:** Create admin-only modules for managing the foundational ContentBlocks and DataPoints (including their OptionLists). These are simple CRUD operations but are prerequisites for building templates. Each endpoint must be protected by permissions like 'datapoints:create', 'contentblocks:update'.
  - **Deliverables:** ContentBlockModule and DataPointModule.
  - **Testing:** E2E tests for basic CRUD operations on these entities.
-
- **Task 3.3: Implement Template & Tab Management**
  - **Description:** Create a PetitionTemplateModule. Implement the APIs for creating a DRAFT template (POST /v1/petition-templates) and managing its tabs (POST, PATCH, DELETE under /v1/petition-templates/{templateId}/tabs). All operations must check that the template is in DRAFT status.
  - **Deliverables:** Template and Tab management endpoints.
  - **Testing:** E2E tests.
    - **Scenario 1:** Create a draft template.
    - **Scenario 2:** Add three tabs to it.
    - **Scenario 3:** Try to add a tab to a (not yet possible) PUBLISHED template. Verify 422 Unprocessable Entity.
  -
-
- **Task 3.4: Implement Condition Evaluation Service**
  - **Description:**
    - Create a ConditionEvaluationService.
    - Integrate the jexl library.
    - Create a public method evaluate(expression: string, context: object): any.
    - The service must securely evaluate the expression. It should be configured to prevent access to global objects or dangerous functions.
  -
  - **Deliverables:** ConditionEvaluationService.ts.
  - **Testing:** Extensive unit tests.
    - **Test Case:** evaluate('(experience \> 5\) AND has_degree', { experience: 10, has_degree: true }) should return true.
    - **Test Case:** evaluate('num_children \* 2', { num_children: 3 }) should return 6\.
    - **Test Case:** evaluate('some_malicious_code()', {}) should throw a controlled error, not execute code.
  -
-
- **Task 3.5: Implement Template Criteria & Condition Management**
  - **Description:**
    - Implement the endpoints under /v1/petition-templates/{templateId}/criteria.
    - The PUT /condition endpoint must use the ConditionEvaluationService to validate the syntax of the expression string before saving it.
    - The validation logic must also check that every variable used in the expression corresponds to a DataPoints.system_name that is linked as a criteria question for that template.
  -
  - **Deliverables:** Criteria management endpoints.
  - **Testing:** E2E tests.
    - **Scenario 1:** Set a condition var1 \== true. Verify success.
    - **Scenario 2:** Set a condition invalid_var \== true. Verify 422 Unprocessable Entity with a message "Variable 'invalid_var' is not defined for this template."
  -
-
- **Task 3.6: Implement Plan, Benefit & Addon Management**
  - **Description:** Implement the extensive set of endpoints from REQ-PTMPL-PLAN-003 for managing plans, their included benefits, and the template's available add-ons. All operations are restricted to DRAFT templates.
  - **Deliverables:** All plan/benefit/addon association endpoints.
  - **Testing:** E2E tests covering creation of a plan, adding a benefit to it, and making another benefit available as an add-on.
-
- **Task 3.7: Implement Task Model & Document/Task Association**
  - **Description:** This is a critical step.
    - Implement the APIs for managing TaskModels and their TaskModelDataPointLinks (I/O definitions).
    - Implement REQ-PTMPL-DOC-002: managing documents within a tab, including their invalidation_condition and multiplicity_condition.
    - Implement REQ-PTMPL-TASKASSOC-002: the PUT /.../document-task-models endpoint that creates the PlanDocumentTaskModels link. The service logic MUST validate that the chosen TaskModel is compatible with the DocumentTypePreset of the document requirement.
  -
  - **Deliverables:** All specified endpoints.
  - **Testing:** E2E tests.
    - **Scenario 1:** Define a document requirement for a "Passport". Try to associate a TaskModel designed for "Cover Letter Drafting". Verify 422 Unprocessable Entity due to mismatched document types.
  -
-
- **Task 3.8: Implement Template Validation Service & Publish Endpoint**
  - **Description:** This is the capstone task of the epic.
    - Create a TemplateValidationService.
    - Implement all the validation logic from the massive REQ-PTMPL-VALIDATE-001 requirement. This includes:  
      a. Basic checks (name, plan exists).  
      b. Calculating the Unified Root Form (REQ-GRAPH-ROOTFORM-CALC-001).  
      c. Validating all condition strings.  
      d. Iterating through each Plan to check for complete task model assignments.  
      e. For each Plan, calculating the task graph (REQ-GRAPH-CALC-001) and checking for any unconnected evidence-based inputs.
    - The POST /v1/petition-templates/{templateId}/publish endpoint will call this service. If it passes, the template status is set to PUBLISHED. If it fails, a 422 response is returned with a detailed, structured list of all validation errors.
  -
  - **Deliverables:** TemplateValidationService.ts, a functioning publish endpoint.
  - **Testing:** This requires complex setup.
    - **Scenario 1 (Valid Template):** Build a complete, logically sound template via API calls. Call /publish. Verify 200 OK and status change.
    - **Scenario 2 (Incomplete Template):** Build a template but forget to assign a task model for a required document in one of the plans. Call /publish. Verify 422 with an error message pinpointing the missing assignment.
    - **Scenario 3 (Unconnected Graph):** Build a template where a task requires evidence that no other task in its plan produces. Call /publish. Verify 422 with an error message identifying the unconnected input data point.
  -
- ***

### **EPIC 4: Client Petition & Task Lifecycle**

_Objective: Implement the client-facing functionality for starting a petition, completing tasks, and seeing the workflow progress._

- **Task 4.1: Implement Petition & Task Instance Data Models**
  - **Description:**
    - Using sequelize-cli, generate migrations to create the PetitionInstances, TaskInstances, and TaskInstanceData tables.
    - Define all columns as specified in REQ-TASKINST-001 and REQ-TASKINST-DATA-001, including all enums (e.g., for status), foreign keys, and indexes.
    - The TaskInstanceData table must have a unique composite key on (task_instance_id, data_point_id, instance_index).
    - Create the PetitionInstanceBenefits table (REQ-ADDON-001) and the TaskComments table (REQ-TASKINST-INTERACT-003).
  -
  - **Deliverables:** Migration and model files for all petition/task runtime tables.
  - **Testing:** db:migrate must succeed. Review schema for correctness.
-
- **Task 4.2: Implement Stripe Integration Service**
  - **Description:**
    - Create a PaymentModule and an injectable StripeService.
    - Install the stripe Node.js library.
    - Store Stripe API keys securely (not in Git).
    - Implement a method createPaymentIntent(amount, currency) that creates a payment intent with Stripe and returns the client_secret.
    - Implement a method constructWebhookEvent(payload, signature) that securely verifies and constructs webhook events received from Stripe.
  -
  - **Deliverables:** PaymentModule, StripeService.ts.
  - **Testing:** Write integration tests for the service against a Stripe test account.
    - **Scenario 1:** Call createPaymentIntent. Verify a valid intent object is returned.
    - **Scenario 2:** Mock a webhook payload and signature. Verify the constructWebhookEvent correctly validates it.
  -
-
- **Task 4.3: Implement Checkout Endpoint (Client-Side)**
  - **Description:**
    - Create an OrderController with a POST /v1/orders/checkout endpoint.
    - The endpoint takes a CheckoutDto with template_id, plan_id, and an array of addon_benefit_ids.
    - The OrderService will:  
      a. Fetch the plan cost and the costs of all selected add-ons.  
      b. Calculate the total cost.  
      c. Call the StripeService.createPaymentIntent with the total cost.  
      d. Return the client_secret to the client. The petition is **not** created at this stage.
  -
  - **Deliverables:** POST /v1/orders/checkout endpoint.
  - **Testing:** E2E test.
    - **Scenario 1:** Call the endpoint with a valid plan and add-ons. Verify a 201 Created response containing a valid Stripe client_secret. Verify the calculated amount is correct by spying on the StripeService call.
  -
-
- **Task 4.4: Implement Stripe Webhook Handler & Petition Creation**
  - **Description:**
    - Create a StripeWebhookController with a POST /v1/webhooks/stripe endpoint.
    - This endpoint must be public but secured by verifying the webhook signature using the StripeService.
    - The handler will listen for the payment_intent.succeeded event.
    - Upon receiving a successful event, it will trigger a PetitionCreationService. This service will:  
      a. Retrieve the original order details (template, plan, addons) from metadata stored in the Stripe Payment Intent.  
      b. Create the PetitionInstance record (REQ-PETI-001).  
      c. Populate PetitionInstanceBenefits with both plan-included and purchased add-on benefits.  
      d. Retrieve the Unified Root Form definition for the template.  
      e. Create the initial Root Form TaskInstance and all its placeholder TaskInstanceData records.
  -
  - **Deliverables:** Webhook controller, transactional PetitionCreationService.
  - **Testing:** This is complex to E2E test.
    - **Unit/Integration Test:** Manually construct a payment_intent.succeeded payload and pass it to the service. Verify that the PetitionInstance, PetitionInstanceBenefits, TaskInstance, and TaskInstanceData records are all created correctly in the test database.
  -
-
- **Task 4.5: Implement Root Form Submission & Task Graph Instantiation**
  - **Description:**
    - Create a TaskController and TaskService.
    - Implement POST /v1/tasks/{taskId}/submit for the Root Form task.
    - The service logic will:  
      a. Validate the submitted data against the DataPoints definitions for the root form.  
      b. Save the submitted data into the TaskInstanceData table.  
      c. Mark the Root Form TaskInstance as COMPLETED.  
      d. **Trigger the TaskGraphInstantiationService**. This new service contains the complex logic from REQ-PETI-003: it retrieves the plan's pre-calculated graph, evaluates all invalidation/multiplicity conditions, creates all subsequent TaskInstances and their data placeholders, and sets the initial LOCKED/OPEN status based on dependencies.
  -
  - **Deliverables:** TaskController, TaskService, and the critical TaskGraphInstantiationService.
  - **Testing:** This is another complex service requiring thorough testing.
    - **Integration Test:**
      1. Setup a complete, published template with conditions in the test DB.
      2. Create a PetitionInstance and a Root Form task.
      3. Call the TaskGraphInstantiationService with a set of root form answers.
      4. Assert that the correct TaskInstances were created (e.g., some INVALIDATED, some with instance_count \> 1, some OPEN, some LOCKED).
    -
  -
-
- **Task 4.6: Implement General Task Interaction APIs**
  - **Description:**
    - In the TaskController, implement the remaining lifecycle endpoints from REQ-TASKINST-LIFE-003: /start, /steps/{stepNumber}/submit-input, /approve-review, /reject-review.
    - The /submit-input endpoint must validate data against the DataPoints definitions for the specific inputs of that task model.
    - Implement the commenting endpoints: POST and GET on /v1/tasks/{taskInstanceId}/comments.
  -
  - **Deliverables:** All task interaction endpoints.
  - **Testing:** E2E tests for each endpoint.
    - **Scenario 1:** A client starts an OPEN task. Verify its status changes to IN_PROGRESS_CLIENT.
    - **Scenario 2:** A client submits input. Verify the data is saved correctly in TaskInstanceData and the task status progresses to PENDING_REVIEW.
    - **Scenario 3:** A team member rejects the review. Verify the status changes to RETURNED_TO_CLIENT and a comment is required/created.
  -
-
- **Task 4.7: Implement Task Status Progression Service**
  - **Description:**
    - Create a TaskLifecycleService that is called by the interaction APIs.
    - This service contains the state machine logic from REQ-TASKINST-LIFE-002.
    - Its most important function is handleTaskCompletion(completedTaskId). When a task is marked COMPLETED, this function will:  
      a. Find all dependent tasks from the PlanTaskGraphEdges.  
      b. For each dependent task, check if ALL of its prerequisites are now COMPLETED.  
      c. If so, update the dependent task's status from LOCKED to OPEN and trigger a notification (future task).
  -
  - **Deliverables:** A well-tested TaskLifecycleService.
  - **Testing:** Unit/Integration test for handleTaskCompletion.
    - **Setup:** Create a dependent task B that requires tasks A1 and A2.
    - **Action 1:** Complete task A1. Call the service.
    - **Assert 1:** Task B should still be LOCKED.
    - **Action 2:** Complete task A2. Call the service.
    - **Assert 2:** Task B's status should now be OPEN.
  -
- ***

### **EPIC 5: Integrations & Supporting Services**

_Objective: Create secure, auditable, and robust integrations with all required third-party and internal services._

- **Task 5.1: Create Secure File Management Module**
  - **Description:**
    - Create a FileModule, FileService, and FileController.
    - Implement the Files Sequelize model and migration (REQ-FMAN-005).
    - Create an S3StorageService that encapsulates all AWS SDK interactions for uploading, deleting, and generating pre-signed URLs.
    - Create a VirusScanningService with a ClamAVAdapter that communicates with a separate ClamAV container. (A Dockerfile for this container is a sub-task).
  -
  - **Deliverables:** A complete FileModule, S3 service, Virus Scanning service, and a clamav.Dockerfile.
-
- **Task 5.2: Implement Secure File Upload Endpoint**
  - **Description:**
    - Implement POST /v1/files/upload.
    - Use NestJS's FileInterceptor to handle multipart/form-data.
    - The controller will orchestrate the flow:  
      a. Validate file size/type against interceptor options.  
      b. Pass the file buffer to the VirusScanningService. Reject if infected.  
      c. Generate a SHA-256 hash of the file.  
      d. Call the S3StorageService to upload the file to S3.  
      e. Create a record in the Files table with all metadata (REQ-FMAN-005).  
      f. Return the file_id to the client.
  -
  - **Deliverables:** A secure upload endpoint.
  - **Testing:** E2E tests.
    - **Scenario 1 (Success):** Upload a valid PDF. Verify a Files record is created with the correct hash and a file appears in the S3 bucket.
    - **Scenario 2 (Oversized File):** Attempt to upload a file larger than the configured limit. Verify 413 Payload Too Large.
    - **Scenario 3 (Infected File):** Use the EICAR test string to simulate a virus. Verify a 422 response indicating the file is unsafe.
  -
-
- **Task 5.3: Implement Secure File Download Endpoint**
  - **Description:**
    - Implement GET /v1/files/{fileId}/download.
    - The endpoint must be protected by a PermissionsGuard and perform logic to ensure the user is authorized to view the petition/task the file belongs to (this is a complex ABAC check).
    - If authorized, call the S3StorageService to generate a short-lived pre-signed URL for downloading.
    - Redirect the user to this pre-signed URL.
  -
  - **Deliverables:** A secure download endpoint.
  - **Testing:** E2E test.
    - **Scenario 1:** As a client, request a file from your own petition. Verify a 302 Redirect to a valid S3 URL.
    - **Scenario 2:** As a client, request a file from another client's petition. Verify 403 Forbidden.
  -
-
- **Task 5.4: Implement Notification Module**
  - **Description:**
    - Create a NotificationModule, NotificationService.
    - Implement UserDevicePlayerIDs and UserNotifications models/migrations.
    - The NotificationService will use the onesignal-node library.
    - Create methods like sendToUser(userId, title, message, data) that look up player IDs and send notifications. This method will also create a record in the UserNotifications table.
    - Implement the required endpoints: POST /users/me/devices (for client to register), and the endpoints for managing the notification center (GET /notifications, POST /mark-read, etc from REQ-NOTIF-009).
    - Inject the NotificationService into other services (like TaskLifecycleService) and call it on key events.
  -
  - **Deliverables:** A complete NotificationModule integrated into the application logic.
  - **Testing:** Integration tests.
    - **Scenario 1:** Spy on the NotificationService. Trigger an action (like completing a task). Verify the sendToUser method was called with the correct parameters. Verify a record was created in the UserNotifications table.
  -
-
- **Task 5.5: Implement Auditing Module**
  - **Description:**
    - Create an AuditModule and AuditService.
    - Create an AuditLog Sequelize model and migration.
    - Create a NestJS Interceptor (AuditInterceptor). This interceptor can be applied to controllers or globally.
    - The interceptor will log the request details (user, IP, endpoint, outcome) to the AuditService _after_ the request is handled.
    - The AuditService will write the log record to the AuditLog table. This should be done asynchronously to not slow down the API response.
  -
  - **Deliverables:** A global AuditInterceptor and AuditService.
  - **Testing:** E2E test.
    - **Scenario 1:** Make any successful API call to an audited endpoint. After the response, query the AuditLog table. Verify a record for that action was created with the correct details.
  -
-
- **Task 5.6: Implement AI Gateway Service**
  - **Description:**
    - Create an AIModule, AIService, and supporting models/migrations (AIProcesses, etc.).
    - The AIService will have a method invokeProcess(processId, data).
    - This service will look up the AIProcess details. If it's a Gemini process, it will use the Google AI SDK to make the call, handling authentication and data mapping.
    - Inject this service into the TaskLifecycleService to be called when a task step is assigned to 'AI'.
  -
  - **Deliverables:** An AIModule capable of calling the Gemini API.
  - **Testing:** Integration test.
    - **Scenario 1:** Mock the Google AI SDK. Call the invokeProcess method. Verify the SDK was called with the correctly formatted prompt and parameters.
    - **Scenario 2:** Test how the service handles API errors from the external service (e.g., rate limiting, invalid requests).
  -
- ***

### **EPIC 6: Dashboards & Advanced Task Views**

_Objective: Provide role-specific, efficient, and powerful APIs to power the various dashboard and list views for all user types._

- **Task 6.1: Implement Client Dashboard API**
  - **Related REQs:** REQ-DASH-001, REQ-CLIENT-PETLIST-001, REQ-CLIENT-TASKLIST-001
  - **Description:**
    - Create a DashboardController for client-facing endpoints.
    - Implement GET /v1/client/dashboard.
    - The DashboardService will perform multiple queries, scoped to the authenticated user.id:  
      a. Fetch active PetitionInstances.  
      b. Fetch a count of tasks in specific statuses (OPEN, IN_PROGRESS_CLIENT, RETURNED_TO_CLIENT).
    - The service will aggregate this data into a single ClientDashboardDto response object. Optimize queries to be efficient.
  -
  - **Deliverables:** A GET /v1/client/dashboard endpoint.
  - **Testing:** E2E Test.
    - **Setup:** Create a test client user. Create two petitions for them: one active with 3 open tasks, and one completed.
    - **Action:** Call the endpoint as that user.
    - **Assert:** Verify the response is 200 OK and contains data for the single active petition and the correct count of open tasks.
  -
-
- **Task 6.2: Implement Advanced Petition & Task List APIs**
  - **Related REQs:** REQ-INTERNAL-PETLIST-001, REQ-TEAM-TASKLIST-001
  - **Description:**
    - This is a large task focused on building a flexible data retrieval service. Create a SearchService or similar.
    - Implement GET /v1/internal/petitions.
    - The service must dynamically build a complex Sequelize query based on the incoming filter parameters (status, client_id, date_range, etc.).
    - Crucially, the WHERE clause must be dynamically adjusted based on the calling user's permissions and affiliations (role, company_id, team memberships). For example, a VENDOR_MANAGER's query will be restricted to company_id \= \[their_company_id\].
    - Implement proper pagination (limit, offset) and sorting.
  -
  - **Deliverables:** A powerful and secure search/filter endpoint for internal users.
  - **Testing:** This requires extensive E2E testing for authorization scoping.
    - **Scenario 1 (Filtering):** As an NN_ADMIN, call the endpoint with ?status=IN_PROGRESS\&company_id=.... Verify only the correct petitions are returned.
    - **Scenario 2 (Scoping):** As a VENDOR*ADMIN for Company A, call the endpoint \_without* a company*id filter. Verify the service \_automatically* applies the filter and returns no petitions from Company B.
    - **Scenario 3 (Employee Scoping):** As a VENDOR*EMPLOYEE assigned to a task in Petition X, call the endpoint. Verify Petition X is returned. For Petition Y, where the user is not assigned, verify it is \_not* returned.
  -
-
- **Task 6.3: Implement Task Reassignment API**
  - **Related REQs:** REQ-DASH-004
  - **Description:**
    - In the TaskController, implement PATCH /v1/tasks/{taskInstanceId}/assign.
    - The DTO will accept a new assigned_user_id.
    - The endpoint will be protected by a permission like 'tasks:reassign'.
    - The TaskService will contain the ABAC logic:  
      a. A manager can only reassign tasks within their team(s).  
      b. An admin can only reassign tasks within their company.  
      c. The new assignee must be eligible (e.g., if TaskModel.requires_lawyer_assignment is true, the new user must have is_lawyer \= true).
    - The service will update the TaskInstances.assigned_user_id.
  -
  - **Deliverables:** A task reassignment endpoint.
  - **Testing:** E2E Tests.
    - **Setup:** Task A is assigned to Team 1 in Company X. User M is manager of Team 1\. User E1 and User E2 (a lawyer) are in Team 1\. User F1 is in Team 2\.
    - **Scenario 1:** As User M, reassign Task A to User E1. Verify 200 OK.
    - **Scenario 2:** As User M, try to reassign Task A to User F1. Verify 403 Forbidden.
    - **Scenario 3:** If Task A requires a lawyer, try to reassign it to User E1. Verify 422 Unprocessable Entity. Reassign to User E2. Verify 200 OK.
  -
- ***

### **EPIC 7: Add-ons, Upgrades & Post-Creation Purchases**

_Objective: Implement the full lifecycle for upselling, including purchasing add-ons after a petition has started and upgrading individual tasks._

- **Task 7.1: Implement API to List Purchasable Add-ons**
  - **Related REQs:** REQ-ADDON-002, REQ-ADDON-POST-001
  - **Description:**
    - Create an AddonController and AddonService.
    - Implement GET /v1/petitions/{petitionInstanceId}/available-purchase-addons.
    - The service logic will:  
      a. Get the template_id from the PetitionInstance.  
      b. Find all Benefit.ids listed in PetitionTemplateAvailableAddons for that template.  
      c. Find all Benefit.ids already associated with the petition in PetitionInstanceBenefits.  
      d. Return the list of benefits from step 'b' minus the benefits from step 'c'. The response should include benefit details and cost.
  -
  - **Deliverables:** An endpoint to list available add-ons for an active petition.
  - **Testing:** E2E Test.
    - **Setup:** A template has 3 available add-ons (A, B, C). A client starts a petition and purchases add-on A.
    - **Action:** Call the endpoint for that petition instance.
    - **Assert:** Verify the response lists only add-ons B and C.
  -
-
- **Task 7.2: Implement Post-Creation Add-on Purchase Flow**
  - **Related REQs:** REQ-ADDON-POST-001, REQ-ADDON-BENEFIT-EFFECT-001
  - **Description:**
    - This task mirrors the main checkout flow but for existing petitions.
    - Implement a POST /v1/petitions/{petitionInstanceId}/purchase-addons endpoint. This initiates the Stripe Payment Intent flow, similar to Task 4.3, returning a client_secret.
    - The Stripe webhook handler from Task 4.4 must be enhanced. It needs to check the metadata in the Payment Intent to see if this is a _new_ petition checkout or a _post-creation_ add-on purchase.
    - If it's an add-on purchase, the webhook logic will:  
      a. Add the new benefits to the PetitionInstanceBenefits table.  
      b. If any new benefit is task-triggering, call the TaskGraphInstantiationService (or a similar service) to create only the new benefit-triggered tasks for the existing petition.
  -
  - **Deliverables:** Add-on purchase endpoint and enhanced webhook handler.
  - **Testing:** Integration test the webhook handler.
    - **Scenario 1:** Send a webhook payload for a post-creation purchase of a non-task-triggering benefit. Verify the PetitionInstanceBenefits table is updated.
    - **Scenario 2:** Send a payload for a task-triggering benefit. Verify the PetitionInstanceBenefits table is updated AND a new TaskInstance has been created for the petition.
  -
-
- **Task 7.3: Implement Task Upgrade APIs**
  - **Related REQs:** REQ-TASKUPG-001, REQ-TASKUPG-002
  - **Description:**
    - Create a TaskUpgradeController and TaskUpgradeService.
    - Implement GET /v1/tasks/{taskInstanceId}/available-upgrades. The service will find all TaskModels that share the same document_type_preset_id as the current task, have a higher cost, and are valid for upgrade.
    - Implement POST /v1/tasks/{taskInstanceId}/upgrade. This will initiate a Stripe Payment Intent for the _cost difference_ between the new task model and the old one.
    - The Stripe webhook handler must be further enhanced to handle a task_upgrade payment type. Upon success, the webhook logic will:  
      a. Update the TaskInstance.task_model_id.  
      b. Reset the current_step_number to the first step of the new model.  
      c. Create any new placeholder TaskInstanceData records required by the new model that didn't exist for the old one.
  -
  - **Deliverables:** Task upgrade endpoints and a final, versatile webhook handler.
  - **Testing:**
    - **E2E Test GET /available-upgrades:** Verify it correctly lists more expensive, compatible task models.
    - **Integration Test Webhook:** Send a task_upgrade webhook payload. Verify the TaskInstance is correctly updated and new TaskInstanceData placeholders are created.
  -
- ***

### **EPIC 8: Petition Filing & Finalization**

_Objective: Implement the final stages of the petition lifecycle, including document compilation, filing tracking, and post-completion updates._

- **Task 8.1: Implement PDF Compilation Service**
  - **Related REQs:** REQ-PFILE-001, REQ-PFILE-002
  - **Description:**
    1. Create a PdfCompilationService.
    2. Integrate a PDF generation library like pdf-lib for merging existing PDFs and a library like puppeteer (which runs a headless Chrome instance) for generating new pages from HTML.
    3. Implement a method compilePetition(petitionInstanceId). This method will:  
       a. Fetch all completed, non-invalidated tasks for the petition.  
       b. Retrieve all output FILE_REFERENCE data points from TaskInstanceData.  
       c. Fetch the cover page, index, and divider HTML templates from ContentBlocks.  
       d. Use Puppeteer to render these HTML templates into PDF pages (populating data like client name, etc.).  
       e. Use pdf-lib to merge all the generated pages and user-uploaded PDFs into a single file in the correct order.  
       f. Upload the final PDF to S3 using the FileService and link it to the PetitionInstance.
  -
  - **Deliverables:** A PdfCompilationService. This is a complex, potentially long-running task that should be handled asynchronously via a job queue (e.g., BullMQ).
  - **Testing:** Integration test.
    1. **Scenario 1:** Create a test petition with several completed tasks that have uploaded PDFs. Call the service. Verify a single, merged PDF is created in S3 with a cover page, dividers, and the uploaded documents in the correct order.
  -
-
- **Task 8.2: Implement Petition Compilation Trigger & Download**
  - **Related REQs:** REQ-PFILE-006
  - **Description:**
    1. Enhance the TaskLifecycleService. When the final required task for a petition is completed, it should trigger the PdfCompilationService.compilePetition job.
    2. Update the PetitionInstance.status to COMPILED.
    3. Implement the GET /v1/petitions/{petitionInstanceId}/compiled-pdf endpoint. This will use the existing FileService secure download mechanism to provide access to the final compiled PDF.
  -
  - **Deliverables:** Automated compilation trigger and a download endpoint.
  - **Testing:** E2E Test.
    1. **Scenario 1:** Complete the last task of a petition. Wait for the async job to finish. Call the download endpoint. Verify you can download the compiled PDF.
  -
-
- **Task 8.3: Implement Filing Step Management**
  - **Related REQs:** REQ-PFILE-003, REQ-PFILE-004, REQ-PFILE-007
  - **Description:**
    1. Create models/migrations for PetitionTemplateFilingSteps, PetitionInstanceFilingProgress, and PetitionInstanceUpdates.
    2. Implement an admin API for defining PetitionTemplateFilingSteps.
    3. When a petition with a "Filing Included" benefit is compiled, create the initial PetitionInstanceFilingProgress records.
    4. Implement PATCH /v1/petitions/{petitionInstanceId}/filing-steps/{progressId} for internal users to update the status of a filing step (permission-protected).
    5. Implement a simple CRUD API for PetitionInstanceUpdates to allow clients and staff to add notes after filing.
  -
  - **Deliverables:** All data models and APIs for tracking the post-compilation lifecycle.
  - **Testing:** E2E tests for updating filing step status and adding a post-filing update.

---

### **Part 1: Analysis of Critical Dependencies & Complexities**

The primary challenge in sequencing this project is the deep-seated dependency on the **Core Data Models** and the **Authorization System**. Almost every feature requires knowledge of users, permissions, and the foundational entities it operates on.

Another major dependency chain revolves around the **Petition Template Engine**. The client-facing petition lifecycle (EPIC 4\) cannot begin until the admin-facing engine (EPIC 3\) is functional enough to create a "published" template for the client to use.

Here are the most significant cross-epic dependencies and complexities:

1. **Authorization Is Global (EPIC 1 is a Blocker):**
   - **Dependency:** Every single endpoint that creates or modifies data (Epics 2 through 8\) depends on the JwtAuthGuard and PermissionsGuard from **EPIC 1**.
   - **Complexity:** The PermissionsGuard itself depends on the PermissionsService, which in turn depends on the Roles, Permissions, and User data models being in place. This makes the authorization system a true "critical path" item.
2.
3. **User Deactivation Logic (EPIC 2 depends on EPIC 4):**
   - **Dependency:** Task 2.7 (Implement User Deactivation Logic) requires checking for active TaskInstances assigned to the user.
   - **Complexity:** This means a core part of the User management in **EPIC 2** cannot be fully implemented until the TaskInstance model and service from **EPIC 4** are available. We can stub this check initially, but it highlights a backward dependency.
4.
5. **The Template-to-Instance Bridge (EPIC 4 depends on EPIC 3):**
   - **Dependency:** The entire client petition lifecycle (**EPIC 4**) is meaningless without a fully defined and validated PetitionTemplate. Specifically, Task 4.4 (PetitionCreationService) and Task 4.5 (TaskGraphInstantiationService) need to read the data structures created and validated by Task 3.8 (TemplateValidationService).
   - **Complexity:** This is the project's largest dependency. We must build the entire "factory" (template engine) before we can build the "product" (petition instance).
6.
7. **Service-to-Service Injections:**
   - **Dependency:** Many services will need to inject others. For example:
     - TeamService (EPIC 2\) needs to check TaskInstances (EPIC 4).
     - TaskLifecycleService (EPIC 4\) needs to call NotificationService and AuditService (EPIC 5).
     - The StripeWebhookController (EPIC 4\) needs to call the PetitionCreationService (EPIC 4), the AddonService (EPIC 7), and the TaskUpgradeService (EPIC 7).
   -
   - **Complexity:** This necessitates a development approach where we create service "skeletons" with defined interfaces early on, allowing dependent services to be built against the interface before the full logic is implemented.
8.

---

### **Part 2: Optimized Project Timeline & Task Sequencing**

This timeline is structured in **Phases**. Each phase represents a logical chunk of work that delivers a testable, coherent set of functionalities and unlocks the next phase. This is more effective than a strict epic-by-epic approach.

#### **Phase 1: The Foundation (Weeks 1-3)**

_Goal: Establish a secure, running, and testable application shell. No business logic, just the core infrastructure._

1. **Task 0.1:** Initialize NestJS Project & Configure Core Tooling
2. **Task 0.2:** Dockerize the Development Environment (MySQL \+ App)
3. **Task 0.3:** Integrate Sequelize & Create Initial Migration
4. **Task 0.4:** Implement Centralized Logging Service
5. **Task 0.5:** Implement Global Exception Filter
6. **Task 0.6:** Implement Base CI/CD Pipeline (Lint, Build, Test)
7. **Task 1.1:** Create Authorization Data Models (Roles, Permissions) & Seed Data
8. **Task 1.2:** Implement Auth0 JWT Validation Guard (JwtAuthGuard)
9. **Task 1.3:** Develop User Permission Caching Service (PermissionsService)
10. **Task 1.4:** Implement PermissionsGuard

**Phase 1 Outcome:** A secure application that can authenticate users and check for permissions, but has no features yet. All foundational work is done, unblocking parallel development in the next phase.

---

#### **Phase 2: Core User & Company Management (Weeks 4-6)**

_Goal: Implement the ability to manage users, companies, and teams. This brings the application to life with its primary actors._

1. **Task 1.5 & 1.6:** Implement Custom User Signup & Auth0 Management Service
2. **Task 2.1 & 2.2:** Create Company, Team, User Models & Implement GET /users/me
3. **Task 2.3 & 2.4:** Implement User Invitation APIs (NN_ADMIN & VENDOR_ADMIN)
4. **Task 2.5:** Implement Company Registration & Management APIs
5. **Task 2.6:** Implement Team CRUD APIs
6. **Task 5.5 (Partial):** Implement the AuditModule & AuditService skeleton. Begin integrating audit calls for all user/company/team management actions.
7. **Task 6.2 (Partial):** Implement the basic structure for the internal petition/task list APIs, focusing only on filtering by User, Company, and Team. The task/petition-specific filters will be added later.

**Phase 2 Outcome:** A usable (via API) system for managing all users, companies, and teams. The permissions system is fully tested. We can now create the admins who will eventually build templates.

---

#### **Phase 3: The Template Engine (Weeks 7-11)**

_Goal: Build the entire complex backend engine for admins to define petition workflows. This is the most complex phase._

1. **Task 3.1:** Implement All Template Engine Data Models (This is a large task and a prerequisite for this entire phase).
2. **Task 3.2:** Implement ContentBlocks and DataPoints CRUD (foundational lookup data).
3. **Task 3.4:** Implement Condition Evaluation Service (jexl).
4. **Task 3.3:** Implement Template & Tab Management APIs.
5. **Task 3.5:** Implement Template Criteria & Condition Management APIs.
6. **Task 3.6:** Implement Plan, Benefit & Addon Management APIs.
7. **Task 3.7:** Implement Task Model & Document/Task Association APIs.
8. **Task 3.8:** Implement Template Validation Service & Publish Endpoint (The capstone of this phase).

**Phase 3 Outcome:** The "factory" is built. An admin can now, via API, create a complete, valid, and logically sound PetitionTemplate and transition it to a PUBLISHED state. This is the critical unblocker for all client-facing features.

---

#### **Phase 4: Client Petition Lifecycle & Core Integrations (Weeks 12-15)**

_Goal: Implement the "happy path" for a client to start a petition and complete tasks. This involves wiring up major integrations like Payments and File Uploads._

1. **Task 4.1:** Implement Petition & Task Instance Data Models.
2. **Task 5.1 & 5.2:** Implement Secure File Management Module & Upload Endpoint (Prerequisite for any task involving file uploads).
3. **Task 5.3:** Implement Secure File Download Endpoint.
4. **Task 4.2:** Implement Stripe Integration Service.
5. **Task 4.3:** Implement Client-Side Checkout Endpoint (/checkout).
6. **Task 4.4:** Implement Stripe Webhook Handler & Petition Creation Logic.
7. **Task 4.5:** Implement Root Form Submission & Task Graph Instantiation Logic.
8. **Task 4.6:** Implement General Task Interaction APIs (/start, /submit-input, etc.).
9. **Task 4.7:** Implement Task Status Progression Service (TaskLifecycleService).
10. **Task 2.7:** **(Revisit)** Fully Implement User Deactivation Logic. Now that TaskInstances exist, the check for active tasks can be completed.

**Phase 4 Outcome:** A fully functional end-to-end "happy path". A client can select a plan, pay for it, start a petition, submit the root form, see their tasks, and submit data/files for those tasks. The system correctly progresses the workflow state.

---

#### **Phase 5: Supporting Services & Advanced Features (Weeks 16-18)**

_Goal: Layer on the remaining features that enhance the user experience and provide advanced functionality like upgrades and notifications._

1. **Task 5.4:** Implement the full NotificationModule and integrate notification triggers into the TaskLifecycleService.
2. **Task 6.1:** Implement the Client Dashboard API.
3. **Task 6.2 (Full):** Enhance the internal list APIs with all remaining petition/task-specific filters.
4. **Task 6.3:** Implement Task Reassignment API.
5. **Task 7.1, 7.2, 7.3:** Implement the entire Add-on Purchase & Task Upgrade flow, including enhancing the Stripe webhook handler.
6. **Task 5.6:** Implement the AI Gateway Service. Integrate it with the TaskLifecycleService for AI-driven steps.

**Phase 5 Outcome:** The application is feature-complete in terms of core user-facing functionality. Users are notified of changes, managers can manage workloads, and upsell paths are available.

---

#### **Phase 6: Finalization & Polish (Weeks 19-20)**

_Goal: Implement the final petition completion steps and conduct end-to-end testing and performance tuning._

1. **Task 8.1:** Implement PDF Compilation Service (as an async job).
2. **Task 8.2:** Implement Compilation Trigger & Download Endpoint.
3. **Task 8.3:** Implement Filing Step Management & Post-Completion Updates.
4. **Full System Review:** Conduct a thorough review of all permissions, ensuring no gaps exist.
5. **Performance Tuning:** Analyze and optimize slow database queries, especially in the dashboard/list APIs.
6. **Documentation Cleanup:** Ensure the OpenAPI specification is complete, accurate, and has descriptions for all endpoints and DTOs.

**Phase 6 Outcome:** A feature-complete, tested, and polished V1 of the backend, ready for launch.
