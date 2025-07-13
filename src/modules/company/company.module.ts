import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Company } from './entities/company.entity';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyValidationService } from './services/company-validation.service';
import { AcmeProtectionService } from './services/acme-protection.service';
import { User } from '../auth/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Team } from '../team/entities/team.entity';
import { CompanyAdminGuard } from '../../core/guards/company-admin.guard';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [SequelizeModule.forFeature([Company, User, Role, Team]), RoleModule],
  controllers: [CompanyController],
  providers: [CompanyService, CompanyValidationService, CompanyAdminGuard, AcmeProtectionService],
  exports: [CompanyService, CompanyValidationService, CompanyAdminGuard, AcmeProtectionService],
})
export class CompanyModule {}
