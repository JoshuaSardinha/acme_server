import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DbCleanerService } from './db-cleaner.service';

// Import all models for E2E testing
import { User } from '../../src/modules/auth/entities/user.entity';
import { Company } from '../../src/modules/company/entities/company.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { TeamMember } from '../../src/modules/team/entities/team-member.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { Permission } from '../../src/modules/role/entities/permission.entity';
import { RolePermission } from '../../src/modules/role/entities/role-permission.entity';
import { UserRole } from '../../src/modules/role/entities/user-role.entity';
import { UserPermission } from '../../src/modules/role/entities/user-permission.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        dialect: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USER', 'root'),
        password: configService.get('DB_PASS', ''),
        database: configService.get('DB_NAME', 'national_niner_test'),
        autoLoadModels: false,
        synchronize: true,
        logging: false, // Disable logging for cleaner test output
        models: [
          User,
          Company,
          Team,
          TeamMember,
          Role,
          Permission,
          RolePermission,
          UserRole,
          UserPermission,
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [DbCleanerService],
  exports: [DbCleanerService, SequelizeModule],
})
export class TestUtilModule {}
