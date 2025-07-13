# Team Validation Guards

This directory contains NestJS guards that provide identical validation logic to the Express middleware in `src/middleware/team/teamValidator.js`. These guards maintain full API compatibility with the Express implementation, ensuring a seamless migration.

## Overview

All guards throw custom exceptions that return Express-compatible error responses with the same HTTP status codes and error messages. They also attach validated data to the request object for use in controllers, exactly like the Express middleware.

## Available Guards

### 1. ValidateTeamFromCompanyGuard
**Express equivalent:** `validateIsTeamFromCompany`  
**Purpose:** Ensures a team belongs to the user's company  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateTeamFromCompanyGuard)
@Get(':teamId')
getTeam(@Param('teamId') teamId: string) {
  // Team is guaranteed to belong to user's company
}
```

### 2. ValidateUserPartOfTeamGuard
**Express equivalent:** `validateIsUserPartOfTeam`  
**Purpose:** Checks if the current user is a member of the specified team  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUserPartOfTeamGuard)
@Get(':teamId/member-only-action')
memberOnlyAction(@Param('teamId') teamId: string) {
  // User is guaranteed to be a member of this team
}
```

### 3. ValidateUserManagerOrAdminGuard
**Express equivalent:** `validateIsUserManagerOfTeamOrAdminOfCompany`  
**Purpose:** Validates if user is team manager or company admin  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUserManagerOrAdminGuard)
@Put(':teamId/manage')
manageTeam(@Param('teamId') teamId: string) {
  // User is guaranteed to be team manager or company admin
}
```

### 4. ValidateUserToAddNotInTeamGuard
**Express equivalent:** `validateUserToBeAddedIsNotInThisTeam`  
**Purpose:** Validates single user addition (user exists, same company, not already in team)  
**Attaches:** `req.userToBeAdded`  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUserToAddNotInTeamGuard)
@Post(':teamId/users')
addUser(@Param('teamId') teamId: string, @Body() body: { userId: string }, @Req() req) {
  const userToAdd = req.userToBeAdded; // Validated user object
}
```

### 5. ValidateUserToRemoveInTeamGuard
**Express equivalent:** `validateUserToBeRemovedIsInThisTeam`  
**Purpose:** Validates single user removal (user exists, same company, is in team)  
**Attaches:** `req.userToBeRemoved`  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUserToRemoveInTeamGuard)
@Delete(':teamId/users/:userId')
removeUser(@Param('teamId') teamId: string, @Param('userId') userId: string, @Req() req) {
  const userToRemove = req.userToBeRemoved; // Validated user object
}
```

### 6. ValidateCanDeleteTeamGuard
**Express equivalent:** `validateCanDeleteTeam`  
**Purpose:** Validates team deletion permissions (team exists, user is manager or admin)  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateCanDeleteTeamGuard)
@Delete(':teamId')
deleteTeam(@Param('teamId') teamId: string) {
  // User is guaranteed to have permission to delete this team
}
```

### 7. ValidateUserAdminGuard
**Express equivalent:** `validateIsUserAdminOfCompany`  
**Purpose:** Validates if user is company admin  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUserAdminGuard)
@Post('admin-only-action')
adminAction() {
  // User is guaranteed to be company admin
}
```

### 8. ValidateNewManagerFromCompanyGuard
**Express equivalent:** `validateNewManagerIsFromCompany`  
**Purpose:** Validates manager change (new manager exists, same company as team)  
**Attaches:** `req.newManager`, `req.team`  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateNewManagerFromCompanyGuard)
@Put(':teamId/manager')
changeManager(@Param('teamId') teamId: string, @Body() body: { userId: string }, @Req() req) {
  const newManager = req.newManager; // Validated manager object
  const team = req.team; // Team object
}
```

### 9. ValidateUsersToAddNotInTeamGuard
**Express equivalent:** `validateUsersToBeAddedAreNotInThisTeam`  
**Purpose:** Validates bulk user addition (all users exist, same company, none in team)  
**Attaches:** `req.usersToBeAdded`  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUsersToAddNotInTeamGuard)
@Post(':teamId/users/bulk')
addUsers(@Param('teamId') teamId: string, @Body() body: { userIds: string[] }, @Req() req) {
  const usersToAdd = req.usersToBeAdded; // Array of validated user objects
}
```

### 10. ValidateUsersToRemoveInTeamGuard
**Express equivalent:** `validateUsersToBeRemovedAreInThisTeam`  
**Purpose:** Validates bulk user removal (all users exist, same company, all in team)  
**Attaches:** `req.usersToBeRemoved`  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUsersToRemoveInTeamGuard)
@Delete(':teamId/users/bulk')
removeUsers(@Param('teamId') teamId: string, @Body() body: { userIds: string[] }, @Req() req) {
  const usersToRemove = req.usersToBeRemoved; // Array of validated user objects
}
```

### 11. ValidateUsersToReplaceFromCompanyGuard
**Express equivalent:** `validateUsersToBeReplacedAreFromCompany`  
**Purpose:** Validates user replacement (userIds array valid, all users exist, same company)  
**Attaches:** `req.usersToBeAdded`  
**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ValidateUsersToReplaceFromCompanyGuard)
@Put(':teamId/users')
replaceUsers(@Param('teamId') teamId: string, @Body() body: { userIds: string[] }, @Req() req) {
  const usersToAdd = req.usersToBeAdded; // Array of validated user objects
}
```

## Error Responses

All guards throw exceptions that return Express-compatible error responses:

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "Error message"
}
```

### HTTP Status Codes
- **400 Bad Request:** Invalid input data (e.g., invalid userIds array)
- **403 Forbidden:** Permission denied or validation failed
- **404 Not Found:** Resource not found (team, user)
- **500 Internal Server Error:** Unexpected server errors

## Security Considerations

1. **Multi-tenant Security:** All guards respect company boundaries
2. **Role-based Access:** Guards check user roles and team membership
3. **Data Validation:** Input validation prevents malicious data
4. **Request Attachment:** Validated objects are safely attached to request

## Migration Notes

- Guards maintain exact Express middleware behavior
- Error codes and messages are identical
- HTTP status codes match Express responses
- Request object attachments work the same way
- Database queries follow the same patterns

## Dependencies

Guards require these models to be available via dependency injection:
- `User` entity
- `Team` entity  
- `TeamMember` entity

Make sure these are imported in the module where guards are used.