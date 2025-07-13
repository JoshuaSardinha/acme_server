import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TeamMember } from './entities/team-member.entity';
import { Team } from './entities/team.entity';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamValidationService } from './services/team-validation.service';
import { MembershipValidationService } from './services/membership-validation.service';
import { User } from '../auth/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { TeamAccessGuard, TeamManagerGuard } from '../../core/guards/team-access.guard';
import { CompanyAdminGuard } from '../../core/guards/company-admin.guard';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [SequelizeModule.forFeature([Team, TeamMember, User, Company]), RoleModule],
  controllers: [TeamController],
  providers: [
    TeamService,
    TeamValidationService,
    MembershipValidationService,
    TeamAccessGuard,
    TeamManagerGuard,
    CompanyAdminGuard,
  ],
  exports: [
    TeamService,
    TeamValidationService,
    MembershipValidationService,
    TeamAccessGuard,
    TeamManagerGuard,
    CompanyAdminGuard,
  ],
})
export class TeamModule {}
