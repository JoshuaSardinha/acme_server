import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersController } from './users.controller';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { Role } from '../role/entities/role.entity';
import { RoleModule } from '../role/role.module';
import { JwtStrategy } from './jwt.strategy';
import { MockJwtStrategy } from './mock-jwt.strategy';

@Module({
  imports: [
    SequelizeModule.forFeature([User, Company, Role]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    RoleModule,
    ConfigModule, // Ensure ConfigModule is available for environment detection
  ],
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    UserService,
    // Conditional JWT strategy provider based on environment
    {
      provide: JwtStrategy,
      useClass: process.env.NODE_ENV === 'test' ? MockJwtStrategy : JwtStrategy,
    },
  ],
  exports: [AuthService, UserService, PassportModule],
})
export class AuthModule {}
