import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel, getConnectionToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Company } from '../company/entities/company.entity';
import { Role } from '../role/entities/role.entity';
import { PermissionsService } from '../role/permissions.service';
import { AuthService } from './auth.service';
import { AcmeInviteDto } from './dto/acme-invite.dto';
import { VendorInviteDto, VendorRole } from './dto/vendor-invite.dto';
import { User, UserRole, UserStatus } from './entities/user.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
    @InjectModel(Role)
    private readonly roleModel: typeof Role,
    private readonly permissionsService: PermissionsService,
    private readonly authService: AuthService,
    @Inject(getConnectionToken())
    private readonly sequelize: Sequelize
  ) {}

  /**
   * Maps VendorRole to UserRole for database storage.
   * This ensures consistent role mapping when creating vendor employees.
   * @param role - The vendor role to map
   * @returns The corresponding UserRole enum value
   * @throws Error when an unhandled role is provided
   */
  private mapVendorRoleToUserRole(role: VendorRole): UserRole {
    switch (role) {
      case VendorRole.VENDOR_EMPLOYEE:
        return UserRole.VENDOR_EMPLOYEE;
      case VendorRole.VENDOR_MANAGER:
        return UserRole.VENDOR_MANAGER;
      default:
        const _exhaustiveCheck: never = role;
        throw new Error(`Unhandled vendor role: ${_exhaustiveCheck}`);
    }
  }

  /**
   * Get role ID by UserRole enum
   * Maps UserRole enum values to their corresponding role IDs in the database
   */
  private async getRoleIdByEnum(roleEnum: UserRole): Promise<string> {
    const roleCodeMap: Record<UserRole, string> = {
      [UserRole.CLIENT]: 'client',
      [UserRole.VENDOR_EMPLOYEE]: 'vendor_employee',
      [UserRole.VENDOR_ADMIN]: 'vendor_admin',
      [UserRole.ACME_EMPLOYEE]: 'acme_employee',
      [UserRole.ACME_ADMIN]: 'acme_admin',
      [UserRole.VENDOR_MANAGER]: 'vendor_manager',
      [UserRole.ACME_MANAGER]: 'acme_manager',
      [UserRole.TEAM_MEMBER]: 'team_member',
      [UserRole.SUPER_ADMIN]: 'super_admin',
    };

    const roleCode = roleCodeMap[roleEnum];
    if (!roleCode) {
      throw new Error(`Unknown role enum: ${roleEnum}`);
    }

    const role = await this.roleModel.findOne({
      where: { code: roleCode },
      attributes: ['id'],
    });

    if (!role) {
      throw new Error(`Role not found for code: ${roleCode}`);
    }

    return role.id;
  }

  /**
   * Get user's own profile with all sensitive data for /users/me endpoint
   * Includes auth0 ID, permissions, and other sensitive information
   */
  async getOwnProfile(auth0UserId: string): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    company?: {
      id: string;
      name: string;
      address?: string;
      email?: string;
      phoneNumber?: string;
      type: string;
      status: string;
      subdomain?: string;
    };
    role?: {
      id: string;
      name: string;
      code: string;
    } | null;
    permissions: string[];
    auth0id: string;
    status: string;
  }> {
    try {
      // Single optimized query with all required associations
      const user = await this.userModel.findOne({
        where: {
          auth0_user_id: auth0UserId,
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: [
              'id',
              'name',
              'address',
              'email',
              'phone_number',
              'type',
              'status',
              'subdomain',
            ],
            required: false,
          },
          {
            model: Role,
            as: 'role',
            attributes: ['id', 'name', 'code'],
            required: false,
          },
        ],
        attributes: ['id', 'email', 'first_name', 'last_name', 'company_id', 'role_id', 'status'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get user's effective permissions using the existing PermissionsService
      const userPermissions = await this.permissionsService.getEffectivePermissionsForUser(
        user.id,
        user.company_id
      );

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company?.name,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              address: user.company.address,
              email: user.company.email,
              phoneNumber: user.company.phone_number,
              type: user.company.type,
              status: user.company.status,
              subdomain: user.company.subdomain,
            }
          : undefined,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
            }
          : null,
        permissions: userPermissions.permission_names,
        auth0id: auth0UserId,
        status: user.status,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Error fetching user profile:', error);
      throw new InternalServerErrorException('Failed to fetch user profile');
    }
  }

  /**
   * Get another user's profile without sensitive data
   * Used when viewing other users' profiles within the same company
   * Excludes auth0 ID, permissions, and other sensitive information
   */
  async getOtherUserProfile(
    userId: string,
    requestingUserCompanyId: string
  ): Promise<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    company?: {
      id: string;
      name: string;
      address?: string;
      email?: string;
      phoneNumber?: string;
      type: string;
      status: string;
      subdomain?: string;
    };
    role?: {
      id: string;
      name: string;
      code: string;
    } | null;
    status: string;
  }> {
    try {
      // Single optimized query with all required associations
      const user = await this.userModel.findOne({
        where: {
          id: userId,
          company_id: requestingUserCompanyId, // Ensure same company access only
        },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: [
              'id',
              'name',
              'address',
              'email',
              'phone_number',
              'type',
              'status',
              'subdomain',
            ],
            required: false,
          },
          {
            model: Role,
            as: 'role',
            attributes: ['id', 'name', 'code'],
            required: false,
          },
        ],
        attributes: ['id', 'email', 'first_name', 'last_name', 'company_id', 'role_id', 'status'],
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        companyName: user.company?.name,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              address: user.company.address,
              email: user.company.email,
              phoneNumber: user.company.phone_number,
              type: user.company.type,
              status: user.company.status,
              subdomain: user.company.subdomain,
            }
          : undefined,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
            }
          : null,
        status: user.status,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error('Error fetching user profile:', error);
      throw new InternalServerErrorException('Failed to fetch user profile');
    }
  }

  /**
   * Find user by Auth0 ID with minimal data for authentication
   */
  async findByAuth0Id(auth0UserId: string): Promise<User | null> {
    try {
      return await this.userModel.findOne({
        where: {
          auth0_user_id: auth0UserId,
        },
        attributes: ['id', 'email', 'first_name', 'last_name', 'company_id', 'role_id'],
      });
    } catch (error) {
      console.error('Error finding user by Auth0 ID:', error);
      throw new InternalServerErrorException('Failed to find user');
    }
  }

  /**
   * Find user by ID with full data including company
   */
  async findById(userId: string): Promise<User | null> {
    try {
      return await this.userModel.findOne({
        where: { id: userId },
        include: [
          {
            model: Company,
            as: 'company',
            attributes: ['id', 'name'],
          },
        ],
        attributes: ['id', 'email', 'first_name', 'last_name', 'company_id', 'role_id'],
      });
    } catch (error) {
      this.logger.error('Error finding user by ID:', error);
      throw new InternalServerErrorException('Failed to find user');
    }
  }

  /**
   * Invite a new Acme user
   * Only accessible by ACME_ADMIN users
   */
  async acmeInvite(inviteDto: AcmeInviteDto, inviterId: string): Promise<User> {
    try {
      // Check if user already exists first
      const existingUser = await this.userModel.findOne({
        where: { email: inviteDto.email },
      });

      if (existingUser) {
        throw new ConflictException({
          success: false,
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
        });
      }

      // Get Acme company
      const acmeCompany = await this.companyModel.findOne({
        where: { name: 'Acme' },
      });

      if (!acmeCompany) {
        throw new UnprocessableEntityException({
          success: false,
          code: 'ACME_COMPANY_NOT_FOUND',
          message: 'Acme company not found',
        });
      }

      // Create Auth0 user FIRST to get the auth0_user_id
      let auth0User;
      try {
        auth0User = await this.authService.createAuth0User({
          email: inviteDto.email,
          name: `${inviteDto.first_name} ${inviteDto.last_name}`,
          user_metadata: {
            companyId: acmeCompany.id,
            role: inviteDto.role,
          },
        });
      } catch (auth0Error) {
        this.logger.error('Auth0 user creation failed', auth0Error);
        throw new UnprocessableEntityException({
          success: false,
          code: 'AUTH0_ERROR',
          message: 'Failed to create user in authentication system',
        });
      }

      // Get the role ID for the specified role
      const roleId = await this.getRoleIdByEnum(inviteDto.role);

      // Now create local user with auth0_user_id in a transaction
      const newUser = await this.sequelize.transaction(async (transaction) => {
        return await this.userModel.create(
          {
            auth0_user_id: auth0User.user_id,
            email: inviteDto.email,
            first_name: inviteDto.first_name,
            last_name: inviteDto.last_name,
            role_id: roleId,
            is_lawyer: inviteDto.is_lawyer,
            company_id: acmeCompany.id,
            status: UserStatus.PENDING,
          },
          { transaction }
        );
      });

      // Send invitation email via Auth0
      await this.authService.sendPasswordResetEmail(inviteDto.email);

      this.logger.log(`Acme user invited successfully: ${inviteDto.email}`);

      // Add role code directly to the user object for controller to access
      (newUser as any).role = { code: inviteDto.role };

      return newUser;
    } catch (error) {
      this.logger.error('Failed to invite Acme user', error);
      throw error;
    }
  }

  /**
   * Invite a new vendor user to the inviter's company
   * Only accessible by VENDOR_ADMIN users
   * CRITICAL: Uses inviter's company_id for security
   */
  async vendorInvite(inviteDto: VendorInviteDto, inviter: User): Promise<User> {
    try {
      // CRITICAL: Get company ID from inviter, not from request
      const companyId = inviter.company_id;

      if (!companyId) {
        throw new UnprocessableEntityException({
          success: false,
          code: 'NO_COMPANY',
          message: 'Inviter must belong to a company',
        });
      }

      // Check if user already exists first
      const existingUser = await this.userModel.findOne({
        where: { email: inviteDto.email },
      });

      if (existingUser) {
        throw new ConflictException({
          success: false,
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
        });
      }

      // Create Auth0 user FIRST to get the auth0_user_id
      let auth0User;
      try {
        auth0User = await this.authService.createAuth0User({
          email: inviteDto.email,
          name: `${inviteDto.first_name} ${inviteDto.last_name}`,
          user_metadata: {
            companyId: companyId,
            role: inviteDto.role,
          },
        });
      } catch (auth0Error) {
        this.logger.error('Auth0 user creation failed', auth0Error);
        throw new UnprocessableEntityException({
          success: false,
          code: 'AUTH0_ERROR',
          message: 'Failed to create user in authentication system',
        });
      }

      // Get the role ID for the specified vendor role
      const userRole = this.mapVendorRoleToUserRole(inviteDto.role);
      const roleId = await this.getRoleIdByEnum(userRole);

      // Now create local user with auth0_user_id in a transaction
      const newUser = await this.sequelize.transaction(async (transaction) => {
        return await this.userModel.create(
          {
            auth0_user_id: auth0User.user_id,
            email: inviteDto.email,
            first_name: inviteDto.first_name,
            last_name: inviteDto.last_name,
            role_id: roleId,
            is_lawyer: inviteDto.is_lawyer,
            company_id: companyId, // CRITICAL: Use inviter's company
            status: UserStatus.PENDING,
          },
          { transaction }
        );
      });

      // Send invitation email via Auth0
      await this.authService.sendPasswordResetEmail(inviteDto.email);

      this.logger.log(
        `Vendor user invited successfully: ${inviteDto.email} to company ${companyId}`
      );

      // Add role code directly to the user object for controller to access
      (newUser as any).role = { code: inviteDto.role };

      return newUser;
    } catch (error) {
      this.logger.error('Failed to invite vendor user', error);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({
      where: { email },
      include: [Company],
    });
  }

  async findByCompany(companyId: string): Promise<User[]> {
    return this.userModel.findAll({
      where: { company_id: companyId },
      include: [Company],
    });
  }

  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    const user = await this.userModel.findByPk(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [_affectedCount, updatedUsers] = await this.userModel.update(
      { status },
      { where: { id: userId }, returning: true }
    );

    return updatedUsers[0];
  }
}
