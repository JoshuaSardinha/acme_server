/**
 * Team Validation Guards
 *
 * These guards provide identical validation logic to the Express middleware
 * in src/middleware/team/teamValidator.js, maintaining full API compatibility.
 */

export { ValidateTeamFromCompanyGuard } from './validate-team-from-company.guard';
export { ValidateUserPartOfTeamGuard } from './validate-user-part-of-team.guard';
export { ValidateUserManagerOrAdminGuard } from './validate-user-manager-or-admin.guard';
export { ValidateUserToAddNotInTeamGuard } from './validate-user-to-add-not-in-team.guard';
export { ValidateUserToRemoveInTeamGuard } from './validate-user-to-remove-in-team.guard';
export { ValidateCanDeleteTeamGuard } from './validate-can-delete-team.guard';
export { ValidateUserAdminGuard } from './validate-user-admin.guard';
export { ValidateNewManagerFromCompanyGuard } from './validate-new-manager-from-company.guard';
export { ValidateUsersToAddNotInTeamGuard } from './validate-users-to-add-not-in-team.guard';
export { ValidateUsersToRemoveInTeamGuard } from './validate-users-to-remove-in-team.guard';
export { ValidateUsersToReplaceFromCompanyGuard } from './validate-users-to-replace-from-company.guard';
