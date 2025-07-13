import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel, getConnectionToken } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { User, UserRole } from '../auth/entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Team } from '../team/entities/team.entity';
import { AdminListCompaniesDto } from './dto/admin-list-companies.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { PaginationDto } from './dto/pagination.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { SearchCompanyUsersDto } from './dto/search-company-users.dto';
import { Company, CompanyStatus, CompanyType } from './entities/company.entity';
import { CompanyValidationService } from './services/company-validation.service';
import { AcmeProtectionService } from './services/acme-protection.service';

export interface AuditLogEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  previousStatus?: CompanyStatus;
  newStatus?: CompanyStatus;
  reason?: string | null;
  details?: any;
}

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Role)
    private roleModel: typeof Role,
    @InjectModel(Team)
    private teamModel: typeof Team,
    private companyValidationService: CompanyValidationService,
    private acmeProtectionService: AcmeProtectionService,
    @Inject(getConnectionToken())
    private sequelize: Sequelize
  ) {}

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
   * REQ-COMP-002: Fully transactional vendor registration
   * Creates Company + initial VENDOR_ADMIN User in a single atomic transaction
   */
  async registerVendor(
    registerVendorDto: RegisterVendorDto
  ): Promise<{ company: Company; user: User }> {
    const transaction = await this.sequelize.transaction();

    try {
      // Validate business rules
      await this.validateVendorRegistration(registerVendorDto, transaction);

      // Create the company with PENDING_APPROVAL status
      const company = await this.companyModel.create(
        {
          name: registerVendorDto.companyName,
          address: registerVendorDto.address,
          email: registerVendorDto.companyEmail,
          phone_number: registerVendorDto.phoneNumber,
          type: CompanyType.VENDOR,
          status: CompanyStatus.PENDING_APPROVAL,
          subdomain: registerVendorDto.subdomain,
          subscription_type: registerVendorDto.subscriptionType || 'starter',
          subscription_status: 'trial',
        },
        { transaction }
      );

      // Create or update the admin user
      let adminUser = await this.userModel.findOne({
        where: { auth0_user_id: registerVendorDto.auth0UserId },
        transaction,
      });

      // Get the role ID for VENDOR_ADMIN
      const vendorAdminRoleId = await this.getRoleIdByEnum(UserRole.VENDOR_ADMIN);

      if (adminUser) {
        // Update existing user
        await adminUser.update(
          {
            first_name: registerVendorDto.adminFirstName,
            last_name: registerVendorDto.adminLastName,
            email: registerVendorDto.adminEmail,
            role_id: vendorAdminRoleId,
            is_lawyer: registerVendorDto.isLawyer || false,
            company_id: company.id,
          },
          { transaction }
        );
      } else {
        // Create new user
        adminUser = await this.userModel.create(
          {
            first_name: registerVendorDto.adminFirstName,
            last_name: registerVendorDto.adminLastName,
            email: registerVendorDto.adminEmail,
            auth0_user_id: registerVendorDto.auth0UserId,
            role_id: vendorAdminRoleId,
            is_lawyer: registerVendorDto.isLawyer || false,
            company_id: company.id,
          },
          { transaction }
        );
      }

      // Link user as company owner and primary contact
      await company.update(
        {
          owner_id: adminUser.id,
          primary_contact_user_id: adminUser.id,
        },
        { transaction }
      );

      // Add audit log
      await this.addAuditLog(company.id, {
        action: 'VENDOR_REGISTERED',
        performedBy: adminUser.id,
        performedAt: new Date(),
        newStatus: CompanyStatus.PENDING_APPROVAL,
        details: { registrationData: registerVendorDto },
      });

      await transaction.commit();

      // TODO: Send notification to ACME_ADMIN about new vendor registration
      // TODO: Send confirmation email to vendor admin

      return { company, user: adminUser };
    } catch (error) {
      await transaction.rollback();
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      console.error('Error in registerVendor transaction:', error);
      throw new BadRequestException('Failed to register vendor company');
    }
  }

  /**
   * REQ-COMP-003: Approve a pending vendor company
   */
  async approveVendor(companyId: string, adminUserId: string, reason?: string): Promise<Company> {
    const transaction = await this.sequelize.transaction();

    try {
      const company = await this.companyModel.findByPk(companyId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (company.status !== CompanyStatus.PENDING_APPROVAL) {
        throw new UnprocessableEntityException(
          `Cannot approve company with status ${company.status}. Only PENDING_APPROVAL companies can be approved.`
        );
      }

      const previousStatus = company.status;
      await company.update({ status: CompanyStatus.ACTIVE }, { transaction });

      await this.addAuditLog(companyId, {
        action: 'VENDOR_APPROVED',
        performedBy: adminUserId,
        performedAt: new Date(),
        previousStatus,
        newStatus: CompanyStatus.ACTIVE,
        reason,
      });

      await transaction.commit();

      // TODO: Send approval notification to vendor admin
      // TODO: Activate billing for the company

      return company;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * REQ-COMP-003: Reject a pending vendor company
   */
  async rejectVendor(companyId: string, adminUserId: string, reason: string): Promise<Company> {
    const transaction = await this.sequelize.transaction();

    try {
      const company = await this.companyModel.findByPk(companyId, { transaction });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (company.status !== CompanyStatus.PENDING_APPROVAL) {
        throw new UnprocessableEntityException(
          `Cannot reject company with status ${company.status}. Only PENDING_APPROVAL companies can be rejected.`
        );
      }

      const previousStatus = company.status;
      await company.update({ status: CompanyStatus.REJECTED }, { transaction });

      await this.addAuditLog(companyId, {
        action: 'VENDOR_REJECTED',
        performedBy: adminUserId,
        performedAt: new Date(),
        previousStatus,
        newStatus: CompanyStatus.REJECTED,
        reason,
      });

      await transaction.commit();

      // TODO: Send rejection notification to vendor admin with reason

      return company;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * REQ-COMP-003: Suspend an active vendor company
   */
  async suspendVendor(
    companyId: string,
    adminUserId: string,
    reason?: string | null
  ): Promise<Company> {
    const transaction = await this.sequelize.transaction();

    try {
      const company = await this.companyModel.findByPk(companyId, { transaction });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (company.status !== CompanyStatus.ACTIVE) {
        throw new UnprocessableEntityException(
          `Cannot suspend company with status ${company.status}. Only ACTIVE companies can be suspended.`
        );
      }

      // Validate Acme company cannot be suspended
      this.acmeProtectionService.validateCompanyStatusChange(companyId, CompanyStatus.SUSPENDED);

      const previousStatus = company.status;
      await company.update({ status: CompanyStatus.SUSPENDED }, { transaction });

      await this.addAuditLog(companyId, {
        action: 'VENDOR_SUSPENDED',
        performedBy: adminUserId,
        performedAt: new Date(),
        previousStatus,
        newStatus: CompanyStatus.SUSPENDED,
        reason,
      });

      await transaction.commit();

      // TODO: Send suspension notification to vendor admin
      // TODO: Disable access for all vendor users

      return company;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * REQ-COMP-003: Reactivate a suspended vendor company
   */
  async reactivateVendor(
    companyId: string,
    adminUserId: string,
    reason?: string
  ): Promise<Company> {
    const transaction = await this.sequelize.transaction();

    try {
      const company = await this.companyModel.findByPk(companyId, { transaction });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (company.status !== CompanyStatus.SUSPENDED) {
        throw new UnprocessableEntityException(
          `Cannot reactivate company with status ${company.status}. Only SUSPENDED companies can be reactivated.`
        );
      }

      const previousStatus = company.status;
      await company.update({ status: CompanyStatus.ACTIVE }, { transaction });

      await this.addAuditLog(companyId, {
        action: 'VENDOR_REACTIVATED',
        performedBy: adminUserId,
        performedAt: new Date(),
        previousStatus,
        newStatus: CompanyStatus.ACTIVE,
        reason,
      });

      await transaction.commit();

      // TODO: Send reactivation notification to vendor admin
      // TODO: Re-enable access for all vendor users

      return company;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * REQ-COMP-003: List companies with advanced filtering and pagination
   */
  async listCompanies(queryDto: AdminListCompaniesDto): Promise<{
    companies: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        type,
        searchTerm,
        sortBy = 'created_at',
        sortOrder = 'DESC',
      } = queryDto;
      const offset = (page - 1) * limit;

      // Build optimized WHERE clause using indexed fields
      const whereClause: any = {};

      if (status && Object.values(CompanyStatus).includes(status as CompanyStatus)) {
        whereClause.status = status;
      }

      if (type && Object.values(CompanyType).includes(type as CompanyType)) {
        whereClause.type = type;
      }

      // Search optimization
      if (searchTerm?.trim()) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${searchTerm.trim()}%` } },
          { email: { [Op.like]: `%${searchTerm.trim()}%` } },
          { subdomain: { [Op.like]: `%${searchTerm.trim()}%` } },
        ];
      }

      // Optimized query with selective includes
      const { count, rows: companies } = await this.companyModel.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'first_name', 'last_name', 'email', 'role_id'],
            include: [
              {
                model: this.roleModel,
                as: 'role',
                attributes: ['id', 'name', 'code'],
              },
            ],
            required: false,
          },
          {
            model: User,
            as: 'primaryContact',
            attributes: ['id', 'first_name', 'last_name', 'email'],
            required: false,
          },
        ],
        attributes: [
          'id',
          'name',
          'email',
          'phone_number',
          'address',
          'type',
          'status',
          'subdomain',
          'subscription_type',
          'subscription_status',
          'created_at',
          'updated_at',
        ],
        limit,
        offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        distinct: true,
      });

      // Format response data
      const formattedCompanies = companies.map((company) => ({
        id: company.id,
        name: company.name,
        email: company.email,
        phoneNumber: company.phone_number,
        address: company.address,
        type: company.type,
        status: company.status,
        subdomain: company.subdomain,
        subscriptionType: company.subscription_type,
        subscriptionStatus: company.subscription_status,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
        owner: company.owner
          ? {
              id: company.owner.id,
              firstName: company.owner.first_name,
              lastName: company.owner.last_name,
              email: company.owner.email,
              role: company.owner.role
                ? {
                    id: company.owner.role.id,
                    name: company.owner.role.name,
                    code: company.owner.role.code,
                  }
                : null,
            }
          : null,
        primaryContact: company.primaryContact
          ? {
              id: company.primaryContact.id,
              firstName: company.primaryContact.first_name,
              lastName: company.primaryContact.last_name,
              email: company.primaryContact.email,
            }
          : null,
      }));

      const totalPages = Math.ceil(count / limit);

      return {
        companies: formattedCompanies,
        totalCount: count,
        totalPages,
        currentPage: page,
      };
    } catch (error) {
      console.error('Error listing companies:', error);
      throw new BadRequestException('Failed to list companies');
    }
  }

  /**
   * Get company audit log for administrative review
   */
  async getCompanyAuditLog(companyId: string): Promise<AuditLogEntry[]> {
    // This would integrate with your audit logging system
    // For now, returning placeholder structure
    return [];
  }

  /**
   * Private method to add audit log entries
   */
  private async addAuditLog(companyId: string, entry: AuditLogEntry): Promise<void> {
    // TODO: Integrate with your audit logging system
    console.log(`Audit Log for Company ${companyId}:`, entry);
  }

  /**
   * Private validation method for vendor registration
   */
  private async validateVendorRegistration(
    dto: RegisterVendorDto,
    transaction: Transaction
  ): Promise<void> {
    // Check for duplicate company name
    const existingCompany = await this.companyModel.findOne({
      where: {
        [Op.or]: [{ name: dto.companyName }, { subdomain: dto.subdomain }],
      },
      transaction,
    });

    if (existingCompany) {
      if (existingCompany.name === dto.companyName) {
        throw new ConflictException('A company with this name already exists');
      }
      if (existingCompany.subdomain === dto.subdomain) {
        throw new ConflictException('This subdomain is already taken');
      }
    }

    // Check for existing user with different email
    const existingUser = await this.userModel.findOne({
      where: { auth0_user_id: dto.auth0UserId },
      transaction,
    });

    if (existingUser && existingUser.email !== dto.adminEmail) {
      throw new ConflictException('User already exists with a different email address');
    }
  }

  async createCompany(createCompanyDto: CreateCompanyDto, userId: string): Promise<Company> {
    const transaction = await this.sequelize.transaction();

    try {
      const user = await this.userModel.findByPk(userId, { transaction });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.hasRoleEnum(UserRole.VENDOR_ADMIN)) {
        throw new ForbiddenException('Only vendor administrators can create companies');
      }

      const ownedCompany = await this.companyModel.findOne({
        where: { owner_id: userId },
        transaction,
      });
      if (ownedCompany) {
        throw new ForbiddenException('User already owns a company, a new company cannot be added.');
      }

      if (user.company_id) {
        throw new ForbiddenException(
          'User already belongs to a company, a new company cannot be added.'
        );
      }

      // Validate Acme company protection rules
      this.acmeProtectionService.validateCompanyCreation({
        type: CompanyType.VENDOR,
      });

      const company = await this.companyModel.create(
        {
          name: createCompanyDto.name,
          address: createCompanyDto.address,
          email: createCompanyDto.email,
          phone_number: createCompanyDto.phoneNumber,
          type: CompanyType.VENDOR,
          status: CompanyStatus.PENDING_APPROVAL,
          subscription_type: createCompanyDto.subscriptionType,
          subscription_status: createCompanyDto.subscriptionStatus,
          owner_id: userId,
          primary_contact_user_id: userId,
        },
        { transaction }
      );

      const vendorAdminRoleId = await this.getRoleIdByEnum(UserRole.VENDOR_ADMIN);

      await this.userModel.update(
        { company_id: company.id, role_id: vendorAdminRoleId },
        { where: { id: userId }, transaction }
      );

      await transaction.commit();
      return company;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Keep existing methods with minor enhancements for consistency
  async getCompanyById(companyId: string): Promise<any> {
    try {
      const company = await this.companyModel.findByPk(companyId, {
        attributes: [
          'id',
          'name',
          'address',
          'email',
          'phone_number',
          'type',
          'status',
          'subdomain',
          'subscription_type',
          'subscription_status',
          'created_at',
          'updated_at',
        ],
        include: [
          {
            model: User,
            as: 'owner',
            attributes: [
              'id',
              'first_name',
              'last_name',
              'email',
              'role_id',
              'is_lawyer',
              'company_id',
            ],
            include: [
              {
                model: this.roleModel,
                as: 'role',
                attributes: ['id', 'name', 'code'],
              },
            ],
          },
          {
            model: User,
            as: 'primaryContact',
            attributes: ['id', 'first_name', 'last_name', 'email'],
          },
        ],
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      return {
        id: company.id,
        name: company.name,
        address: company.address,
        email: company.email,
        phoneNumber: company.phone_number,
        type: company.type,
        status: company.status,
        subdomain: company.subdomain,
        subscription_type: company.subscription_type,
        subscription_status: company.subscription_status,
        created_at: company.created_at,
        updated_at: company.updated_at,
        owner: company.owner
          ? {
              id: company.owner.id,
              firstName: company.owner.first_name,
              lastName: company.owner.last_name,
              email: company.owner.email,
              role: company.owner.role
                ? {
                    id: company.owner.role.id,
                    name: company.owner.role.name,
                    code: company.owner.role.code,
                  }
                : null,
              isLawyer: company.owner.is_lawyer,
              companyId: company.owner.company_id,
            }
          : null,
        primaryContact: company.primaryContact
          ? {
              id: company.primaryContact.id,
              firstName: company.primaryContact.first_name,
              lastName: company.primaryContact.last_name,
              email: company.primaryContact.email,
            }
          : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getting company by ID:', error);
      throw new BadRequestException('Failed to retrieve company');
    }
  }

  async getCompanyUsers(companyId: string, paginationDto: PaginationDto): Promise<any> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const offset = (page - 1) * limit;

      const { count, rows: users } = await this.userModel.findAndCountAll({
        where: { company_id: companyId },
        attributes: [
          'id',
          'first_name',
          'last_name',
          'email',
          'role_id',
          'is_lawyer',
          'company_id',
          'created_at',
        ],
        include: [
          {
            model: this.roleModel,
            as: 'role',
            attributes: ['id', 'name', 'code'],
          },
          {
            model: Team,
            as: 'teams',
            attributes: ['id', 'name'],
            through: { attributes: [] },
          },
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']],
        distinct: true,
      });

      const formattedUsers = users.map((user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
            }
          : null,
        isLawyer: user.is_lawyer,
        companyId: user.company_id,
        createdAt: user.created_at,
        teams:
          user.teams?.map((team) => ({
            id: team.id,
            name: team.name,
          })) || [],
      }));

      return {
        users: formattedUsers,
        totalCount: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
      };
    } catch (error) {
      console.error('Error getting users from company:', error);
      throw new BadRequestException('Failed to retrieve company users');
    }
  }

  async addUserToCompany(
    companyId: string,
    userId: string,
    requestingUserId: string
  ): Promise<any> {
    try {
      await this.companyValidationService.validateUserCanManageCompany(requestingUserId, companyId);

      const user = await this.userModel.findByPk(userId, {
        include: [
          {
            model: this.roleModel,
            as: 'role',
            attributes: ['id', 'name', 'code'],
          },
        ],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.company_id) {
        throw new BadRequestException('User already belongs to a company');
      }

      const company = await this.companyModel.findByPk(companyId);
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      await user.update({ company_id: companyId });

      return {
        message: 'User added to company successfully',
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role
            ? {
                id: user.role.id,
                name: user.role.name,
                code: user.role.code,
              }
            : null,
          companyId: user.company_id,
        },
      };
    } catch (error) {
      console.error('Error adding user to company:', error);
      throw error;
    }
  }

  async removeUserFromCompany(
    companyId: string,
    userId: string,
    requestingUserId: string
  ): Promise<void> {
    try {
      await this.companyValidationService.validateUserCanManageCompany(requestingUserId, companyId);

      const user = await this.userModel.findByPk(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.company_id !== companyId) {
        throw new BadRequestException('User does not belong to this company');
      }

      const company = await this.companyModel.findByPk(companyId);
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      if (company.owner_id === userId) {
        throw new BadRequestException('Cannot remove company owner');
      }

      await user.update({ company_id: null });
    } catch (error) {
      console.error('Error removing user from company:', error);
      throw error;
    }
  }

  async searchCompanyUsers(companyId: string, searchDto: SearchCompanyUsersDto): Promise<any> {
    try {
      const { searchValue: searchTerm, roles, isLawyer } = searchDto;

      const whereClause: any = { company_id: companyId };

      if (searchTerm) {
        whereClause[Op.or] = [
          { first_name: { [Op.like]: `%${searchTerm}%` } },
          { last_name: { [Op.like]: `%${searchTerm}%` } },
          { email: { [Op.like]: `%${searchTerm}%` } },
        ];
      }

      if (roles && roles.length > 0) {
        // Convert UserRole enum values to actual role IDs
        const roleIds = await Promise.all(roles.map((roleEnum) => this.getRoleIdByEnum(roleEnum)));
        whereClause.role_id = { [Op.in]: roleIds };
      }

      if (typeof isLawyer === 'boolean') {
        whereClause.is_lawyer = isLawyer;
      }

      const users = await this.userModel.findAll({
        where: whereClause,
        attributes: [
          'id',
          'first_name',
          'last_name',
          'email',
          'role_id',
          'is_lawyer',
          'company_id',
          'created_at',
        ],
        include: [
          {
            model: this.roleModel,
            as: 'role',
            attributes: ['id', 'name', 'code'],
          },
        ],
        order: [['first_name', 'ASC']],
      });

      const formattedUsers = users.map((user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role
          ? {
              id: user.role.id,
              name: user.role.name,
              code: user.role.code,
            }
          : null,
        isLawyer: user.is_lawyer,
        companyId: user.company_id,
        createdAt: user.created_at,
      }));

      return {
        users: formattedUsers,
        totalCount: users.length,
      };
    } catch (error) {
      console.error('Error searching company users:', error);
      throw new BadRequestException('Failed to search company users');
    }
  }

  async findCompanyByUserId(userId: string): Promise<Company | null> {
    try {
      const company = await this.companyModel.findOne({
        where: { owner_id: userId },
        attributes: ['id', 'name', 'address', 'email', 'type', 'status'],
      });
      return company;
    } catch (error) {
      console.error('Error finding company by user ID:', error);
      throw error;
    }
  }

  /**
   * Delete a company (with National Niner protection)
   */
  async deleteCompany(companyId: string, adminUserId: string, reason: string): Promise<void> {
    const transaction = await this.sequelize.transaction();

    try {
      // Validate Acme company cannot be deleted
      this.acmeProtectionService.validateCompanyDeletion(companyId);

      const company = await this.companyModel.findByPk(companyId, { transaction });
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Additional business logic checks
      const usersCount = await this.userModel.count({
        where: { company_id: companyId },
        transaction,
      });

      if (usersCount > 0) {
        throw new BadRequestException(
          'Cannot delete company with existing users. Remove all users first.'
        );
      }

      const teamsCount = await this.teamModel.count({
        where: { company_id: companyId },
        transaction,
      });

      if (teamsCount > 0) {
        throw new BadRequestException(
          'Cannot delete company with existing teams. Remove all teams first.'
        );
      }

      await this.addAuditLog(companyId, {
        action: 'COMPANY_DELETED',
        performedBy: adminUserId,
        performedAt: new Date(),
        previousStatus: company.status,
        reason,
        details: { companyName: company.name, companyType: company.type },
      });

      await this.companyModel.destroy({
        where: { id: companyId },
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
