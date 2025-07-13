import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoleModule } from '../modules/role/role.module';
import { User } from '../modules/auth/entities/user.entity';
import { Company } from '../modules/company/entities/company.entity';
import { Team } from '../modules/team/entities/team.entity';
import { TeamMember } from '../modules/team/entities/team-member.entity';
import { ClientVersionGuard } from './guards/client-version.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TeamAccessGuard, TeamManagerGuard } from './guards/team-access.guard';
import { CompanyAdminGuard } from './guards/company-admin.guard';
import { BypassableGuard } from './guards/bypassable.guard';
import { SuperAdminBypassGuard } from './guards/super-admin-bypass.guard';
import { PermissionsGuard } from './guards/permissions.guard';
// Team validation guards
import {
  ValidateTeamFromCompanyGuard,
  ValidateUserPartOfTeamGuard,
  ValidateUserManagerOrAdminGuard,
  ValidateUserToAddNotInTeamGuard,
  ValidateUserToRemoveInTeamGuard,
  ValidateCanDeleteTeamGuard,
  ValidateUserAdminGuard,
  ValidateNewManagerFromCompanyGuard,
  ValidateUsersToAddNotInTeamGuard,
  ValidateUsersToRemoveInTeamGuard,
  ValidateUsersToReplaceFromCompanyGuard,
} from './guards/team';

@Module({
  imports: [SequelizeModule.forFeature([User, Company, Team, TeamMember]), RoleModule],
  providers: [
    JwtAuthGuard,
    ClientVersionGuard,
    RolesGuard,
    TeamAccessGuard,
    TeamManagerGuard,
    CompanyAdminGuard,
    BypassableGuard,
    SuperAdminBypassGuard,
    PermissionsGuard,
    // Team validation guards
    ValidateTeamFromCompanyGuard,
    ValidateUserPartOfTeamGuard,
    ValidateUserManagerOrAdminGuard,
    ValidateUserToAddNotInTeamGuard,
    ValidateUserToRemoveInTeamGuard,
    ValidateCanDeleteTeamGuard,
    ValidateUserAdminGuard,
    ValidateNewManagerFromCompanyGuard,
    ValidateUsersToAddNotInTeamGuard,
    ValidateUsersToRemoveInTeamGuard,
    ValidateUsersToReplaceFromCompanyGuard,
  ],
  exports: [
    JwtAuthGuard,
    ClientVersionGuard,
    RolesGuard,
    TeamAccessGuard,
    TeamManagerGuard,
    CompanyAdminGuard,
    BypassableGuard,
    SuperAdminBypassGuard,
    PermissionsGuard,
    // Team validation guards
    ValidateTeamFromCompanyGuard,
    ValidateUserPartOfTeamGuard,
    ValidateUserManagerOrAdminGuard,
    ValidateUserToAddNotInTeamGuard,
    ValidateUserToRemoveInTeamGuard,
    ValidateCanDeleteTeamGuard,
    ValidateUserAdminGuard,
    ValidateNewManagerFromCompanyGuard,
    ValidateUsersToAddNotInTeamGuard,
    ValidateUsersToRemoveInTeamGuard,
    ValidateUsersToReplaceFromCompanyGuard,
  ],
})
export class CoreModule {}
