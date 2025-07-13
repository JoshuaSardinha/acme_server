# Task Completion Checklist

## MANDATORY Validation (EVERY task must satisfy ALL criteria)

### Server Validation
- [ ] Server starts without errors: `npm run start:dev`
- [ ] Health endpoint responds: `curl localhost:3000/health` returns 200 OK
- [ ] Swagger docs load: `http://localhost:3000/api`

### Test Validation
- [ ] All unit tests pass: `npm test`
- [ ] All e2e tests pass: `npm run test:e2e`
- [ ] All integration tests pass: `npm run test:integration`
- [ ] All comprehensive tests pass: `npm run test:all-slow`

### Code Quality
- [ ] TypeScript builds: `npm run build`
- [ ] No linting errors: `npm run lint`
- [ ] Code formatted: `npm run format`

### Database
- [ ] Migrations run successfully: `npx sequelize-cli db:migrate`
- [ ] All queries include company_id for multi-tenant isolation
- [ ] Soft deletes used (paranoid: true)

### Security
- [ ] Authentication implemented (JwtAuthGuard)
- [ ] Authorization validated (PermissionsGuard)
- [ ] Multi-tenant isolation verified
- [ ] Permission patterns follow: resource:action:scope format

### Documentation
- [ ] API documented in Swagger
- [ ] Error handling implemented with proper HTTP status codes
- [ ] Logging added for debugging

### Business Rules
- [ ] Legal teams have at least one lawyer
- [ ] Users with active tasks cannot be removed
- [ ] Audit trail logging implemented

## Remember
No task is complete until the server runs AND all tests pass. Always run the full validation suite before marking any task as complete.