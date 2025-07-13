import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../core/decorators/public.decorator';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { ClientVersionGuard } from '../../core/guards/client-version.guard';
import { CompanyAdminGuard } from '../../core/guards/company-admin.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { SuperAdminBypassGuard } from '../../core/guards/super-admin-bypass.guard';
import { CompanyService } from './company.service';
import { AddUserToCompanyDto } from './dto/add-user-to-company.dto';
import { AdminCreateVendorDto } from './dto/admin-create-vendor.dto';
import { AdminListCompaniesDto } from './dto/admin-list-companies.dto';
import { CompanyResponseDto } from './dto/company-response.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { PaginationDto } from './dto/pagination.dto';
import { RegisterVendorDto } from './dto/register-vendor.dto';
import { SearchCompanyUsersDto } from './dto/search-company-users.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';

@ApiTags('Companies')
@Controller()
@UseGuards(ClientVersionGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  // REQ-COMP-002: Public vendor registration endpoint
  @Public()
  @Post('companies/register-vendor')
  @ApiOperation({ summary: 'Register a new vendor company (public endpoint)' })
  @ApiResponse({ status: 201, description: 'Vendor successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 409, description: 'Company name or subdomain already exists' })
  async registerVendor(@Body() registerVendorDto: RegisterVendorDto) {
    const result = await this.companyService.registerVendor(registerVendorDto);
    return {
      message: 'Vendor registration submitted successfully',
      company: {
        id: result.company.id,
        name: result.company.name,
        status: result.company.status,
        subdomain: result.company.subdomain,
      },
      user: {
        id: result.user.id,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        email: result.user.email,
        role: result.user.role,
      },
    };
  }

  // Get basic company info for authenticated non-client users
  @Get('company')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get basic company information for authenticated user',
    description:
      'Returns basic company information for non-client users. Client users will receive a 403 error.',
  })
  @ApiResponse({
    status: 200,
    description: 'Company information retrieved successfully',
    type: CompanyResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Client users cannot access this endpoint',
  })
  @ApiResponse({
    status: 404,
    description: 'User does not belong to any company',
  })
  async getCurrentUserCompany(@Request() req: any) {
    // Check if user is a client using the role code
    if (req.user.role?.code === 'client') {
      throw new ForbiddenException(
        'Client users cannot access company information through this endpoint'
      );
    }

    // Check if user has a company_id
    if (!req.user.company_id) {
      throw new NotFoundException('User does not belong to any company');
    }

    // Get company information
    try {
      const company = await this.companyService.getCompanyById(req.user.company_id);
      return company;
    } catch (e) {
      e;
    }
  }

  // REQ-COMP-003: Admin company listing with filtering
  @Get('admin/companies')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_COMPANIES')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all companies with filtering (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'REJECTED'],
  })
  @ApiQuery({ name: 'type', required: false, enum: ['ACME', 'VENDOR'] })
  @ApiQuery({ name: 'searchTerm', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Companies listed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async listCompanies(@Query() queryDto: AdminListCompaniesDto) {
    return this.companyService.listCompanies(queryDto);
  }

  // REQ-COMP-003: Get specific company details (admin only)
  @Get('admin/companies/:companyId')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_COMPANIES')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get company details (admin only)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company details retrieved' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async getCompanyDetails(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companyService.getCompanyById(companyId);
  }

  // REQ-COMP-003: Approve pending vendor company
  @Patch('admin/companies/:companyId/approve')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('APPROVE_COMPANIES')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending vendor company' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company approved successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async approveCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Request() req: any,
    @Body() body: { reason?: string }
  ) {
    const company = await this.companyService.approveVendor(companyId, req.user.id, body.reason);
    return {
      message: 'Company approved successfully',
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
      },
    };
  }

  // REQ-COMP-003: Reject pending vendor company
  @Patch('admin/companies/:companyId/reject')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('APPROVE_COMPANIES')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending vendor company' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company rejected successfully' })
  @ApiResponse({ status: 400, description: 'Rejection reason is required' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async rejectCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Request() req: any,
    @Body() body: { reason: string }
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    const company = await this.companyService.rejectVendor(companyId, req.user.id, body.reason);
    return {
      message: 'Company rejected successfully',
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
      },
    };
  }

  // REQ-COMP-003: Update company status (suspend/reactivate)
  @Patch('admin/companies/:companyId/status')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_COMPANIES')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update company status (suspend/reactivate)' })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 200, description: 'Company status updated successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({ status: 422, description: 'Invalid status transition' })
  async updateCompanyStatus(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Request() req: any,
    @Body() updateStatusDto: UpdateCompanyStatusDto
  ) {
    let company;

    switch (updateStatusDto.status) {
      case 'SUSPENDED':
        company = await this.companyService.suspendVendor(
          companyId,
          req.user.id,
          updateStatusDto.reason
        );
        break;
      case 'ACTIVE':
        company = await this.companyService.reactivateVendor(
          companyId,
          req.user.id,
          updateStatusDto.reason
        );
        break;
      default:
        throw new BadRequestException(
          'Invalid status. Only SUSPENDED and ACTIVE status updates are allowed through this endpoint.'
        );
    }

    return {
      message: 'Company status updated successfully',
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
      },
    };
  }

  // REQ-COMP-003: Admin-only vendor creation
  @Post('admin/companies/vendor')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('CREATE_COMPANIES')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a vendor company directly (admin only)' })
  @ApiResponse({ status: 201, description: 'Vendor company created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createVendorCompany(
    @Body() adminCreateVendorDto: AdminCreateVendorDto,
    @Request() req: any
  ) {
    // Convert admin DTO to register DTO format
    const registerDto: RegisterVendorDto = {
      companyName: adminCreateVendorDto.companyName,
      address: adminCreateVendorDto.address,
      companyEmail: adminCreateVendorDto.companyEmail,
      phoneNumber: adminCreateVendorDto.phoneNumber,
      subdomain: adminCreateVendorDto.subdomain,
      adminFirstName: adminCreateVendorDto.adminFirstName,
      adminLastName: adminCreateVendorDto.adminLastName,
      adminEmail: adminCreateVendorDto.adminEmail,
      auth0UserId: adminCreateVendorDto.auth0UserId,
      isLawyer: adminCreateVendorDto.isLawyer,
      subscriptionType: adminCreateVendorDto.subscriptionType,
    };

    const result = await this.companyService.registerVendor(registerDto);

    // If admin specified to auto-approve, approve it immediately
    if (adminCreateVendorDto.autoApprove) {
      await this.companyService.approveVendor(
        result.company.id,
        req.user.id,
        'Auto-approved by admin during creation'
      );
    }

    return {
      message: 'Vendor company created successfully',
      company: {
        id: result.company.id,
        name: result.company.name,
        status: result.company.status,
        subdomain: result.company.subdomain,
      },
    };
  }

  // Existing endpoints with improved security
  @Post('companies')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('CREATE_COMPANIES')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new company' })
  async createCompany(@Body() createCompanyDto: CreateCompanyDto, @Request() req: any) {
    const company = await this.companyService.createCompany(createCompanyDto, req.user.id);
    return company;
  }

  @Get('companies/:companyId')
  @UseGuards(JwtAuthGuard, CompanyAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get company by ID' })
  async getCompany(@Param('companyId', ParseUUIDPipe) companyId: string, @Request() req: any) {
    return this.companyService.getCompanyById(companyId);
  }

  @Post('companies/:companyId/users')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_TEAM_MEMBERS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add user to company' })
  async addUserToCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() addUserDto: AddUserToCompanyDto,
    @Request() req: any
  ) {
    return this.companyService.addUserToCompany(companyId, addUserDto.userId, req.user.id);
  }

  @Delete('companies/:companyId/users/:userId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('MANAGE_TEAM_MEMBERS')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove user from company' })
  async removeUserFromCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req: any
  ) {
    await this.companyService.removeUserFromCompany(companyId, userId, req.user.id);
  }

  @Get('companies/:companyId/users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get company users' })
  async getCompanyUsers(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() paginationDto: PaginationDto
  ) {
    return this.companyService.getCompanyUsers(companyId, paginationDto);
  }

  @Get('companies/:companyId/users/search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search company users' })
  async searchCompanyUsers(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() searchDto: SearchCompanyUsersDto
  ) {
    return this.companyService.searchCompanyUsers(companyId, searchDto);
  }

  @Get('companies/:companyId/audit-log')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('VIEW_AUDIT_LOGS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get company audit log' })
  async getCompanyAuditLog(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companyService.getCompanyAuditLog(companyId);
  }

  @Delete('admin/companies/:companyId')
  @UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard)
  @RequirePermissions('DELETE_COMPANIES')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a company (admin only)',
    description: 'Permanently delete a company. The Acme company cannot be deleted.',
  })
  @ApiParam({ name: 'companyId', description: 'Company UUID' })
  @ApiResponse({ status: 204, description: 'Company deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot delete Acme company' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  @ApiResponse({
    status: 400,
    description: 'Company has users or teams that must be removed first',
  })
  async deleteCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Request() req: any,
    @Body() body: { reason: string }
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('Deletion reason is required');
    }

    await this.companyService.deleteCompany(companyId, req.user.id, body.reason);
  }
}
