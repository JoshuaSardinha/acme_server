import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { CommonModule } from './common/common.module';
import { CoreModule } from './core/core.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { AuthModule } from './modules/auth/auth.module';
import { User } from './modules/auth/entities/user.entity';
import { CompanyModule } from './modules/company/company.module';
import { CompanyAuditLog } from './modules/company/entities/company-audit-log.entity';
import { Company } from './modules/company/entities/company.entity';
import { ConfigsModule } from './modules/config/config.module';
import { HealthModule } from './modules/health/health.module';
import { Permission } from './modules/role/entities/permission.entity';
import { RolePermission } from './modules/role/entities/role-permission.entity';
import { Role } from './modules/role/entities/role.entity';
import { UserPermission } from './modules/role/entities/user-permission.entity';
import { UserRole } from './modules/role/entities/user-role.entity';
import { RoleModule } from './modules/role/role.module';
import { TeamMember } from './modules/team/entities/team-member.entity';
import { Team } from './modules/team/entities/team.entity';
import { TeamModule } from './modules/team/team.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile:
        process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      cache: true,
      expandVariables: true,
    }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const env = process.env.NODE_ENV || 'development';

        // Database configuration mapping
        const dbConfig = {
          development: {
            host: configService.get<string>('DB_HOST', 'localhost'),
            port: configService.get<number>('DB_PORT', 3306),
            username: configService.get<string>('DB_USER', 'root'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_NAME', 'acme_dev'),
          },
          production: {
            host: configService.get<string>('DB_HOST'),
            port: configService.get<number>('DB_PORT', 3306),
            username: configService.get<string>('DB_USER'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_NAME'),
          },
          test: {
            host: configService.get<string>('DB_HOST', 'test_db'),
            port: configService.get<number>('DB_PORT', 3306),
            username: configService.get<string>('DB_USER', 'root'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_NAME', 'acme_test_db'),
          },
        };

        const config = dbConfig[env] || dbConfig.development;

        return {
          dialect: 'mysql',
          dialectModule: require('mysql2'),
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.database,
          models: [
            User,
            Company,
            CompanyAuditLog,
            Team,
            TeamMember,
            Role,
            Permission,
            RolePermission,
            UserPermission,
            UserRole,
          ],
          autoLoadModels: true,
          synchronize: false,
          logging: env === 'development' ? console.log : false,
          define: {
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        };
      },
      inject: [ConfigService],
    }),
    CommonModule,
    CoreModule,
    AuthModule,
    CompanyModule,
    TeamModule,
    RoleModule,
    AccessControlModule,
    HealthModule,
    ConfigsModule,
    ChatModule,
  ],
  controllers: [],
  providers: [
    // Global guards can be added here if needed
  ],
})
export class AppModule {}
