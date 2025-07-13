import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { TeamModule } from '../team/team.module';
import { BusinessValidationGuard } from './guards/business-validation.guard';

@Module({
  imports: [CompanyModule, TeamModule],
  providers: [BusinessValidationGuard],
  exports: [BusinessValidationGuard],
})
export class AccessControlModule {}
