import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RoleController } from './role.controller';
import { PermissionsController } from './permissions.controller';
import { RoleService } from './role.service';
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { User } from '../auth/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { CompanyAdminGuard } from '../../core/guards/company-admin.guard';
import { Role, Permission, RolePermission, UserRole, UserPermission } from './entities';

@Module({
  imports: [
    SequelizeModule.forFeature([
      User,
      Company,
      Role,
      Permission,
      RolePermission,
      UserRole,
      UserPermission,
    ]),
  ],
  controllers: [RoleController, PermissionsController],
  providers: [RoleService, PermissionsService, PermissionsGuard, CompanyAdminGuard],
  exports: [RoleService, PermissionsService, PermissionsGuard, CompanyAdminGuard],
})
export class RoleModule {}
