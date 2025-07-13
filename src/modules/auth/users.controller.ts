import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { UpdateRoleDto } from '../role/dto';
import { RoleService } from '../role/role.service';
import { AcmeInviteDto } from './dto/acme-invite.dto';
import { OtherUserProfileDto, OwnUserProfileDto } from './dto/user-profile.dto';
import { VendorInviteDto } from './dto/vendor-invite.dto';
import { User, UserRole } from './entities/user.entity';
import { UserService } from './user.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly roleService: RoleService,
    private readonly userService: UserService
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: OwnUserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found in local database',
    type: ApiResponseDto,
  })
  @ResponseMessage('User retrieved successfully', 'GET_USER_SUCCESSFUL')
  async getProfile(@CurrentUser() currentUser: User): Promise<OwnUserProfileDto> {
    try {
      if (!currentUser || !currentUser.auth0_user_id) {
        throw new NotFoundException({
          success: false,
          code: 'USER_404',
          message: 'User not found',
        });
      }

      const userProfile = await this.userService.getOwnProfile(currentUser.auth0_user_id);

      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error getting user profile:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_500',
        message: 'Internal server error',
      });
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile by ID (same company only)' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: OtherUserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot view users from other companies',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: ApiResponseDto,
  })
  @ResponseMessage('User retrieved successfully', 'GET_USER_SUCCESSFUL')
  async getUserProfile(
    @Param('id') userId: string,
    @CurrentUser() currentUser: User
  ): Promise<OtherUserProfileDto> {
    try {
      if (!currentUser || !currentUser.company_id) {
        throw new ForbiddenException({
          success: false,
          code: 'USER_403',
          message: 'Forbidden',
        });
      }

      const userProfile = await this.userService.getOtherUserProfile(
        userId,
        currentUser.company_id
      );

      return userProfile;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error getting user profile:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'USER_500',
        message: 'Internal server error',
      });
    }
  }

  @Get(':id/role')
  @ApiOperation({ summary: 'Get user role' })
  @ApiResponse({
    status: 200,
    description: 'User role retrieved successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiResponseDto })
  @ResponseMessage('User role retrieved successfully', 'ROLE_GET_SUCCESS')
  async getUserRole(@Param('id') userId: string, @CurrentUser() currentUser: User) {
    try {
      const targetUserId = userId; // Keep as string since we're using UUIDs

      // Check if user can view this role
      // Users can view their own role, admins can view any role in their company
      const canView =
        currentUser.id === targetUserId ||
        currentUser.hasRoleEnum(UserRole.VENDOR_ADMIN) ||
        currentUser.hasRoleEnum(UserRole.VENDOR_MANAGER);

      if (!canView) {
        throw new ForbiddenException({
          success: false,
          code: 'ROLE_403',
          message: 'Forbidden',
        });
      }

      const user = await this.roleService.getUserRole(userId);

      if (!user) {
        throw new NotFoundException({
          success: false,
          code: 'ROLE_404',
          message: 'User not found',
        });
      }

      // For different company users, also return 404 for security
      if (user.company_id !== currentUser.company_id) {
        throw new NotFoundException({
          success: false,
          code: 'ROLE_404',
          message: 'User not found',
        });
      }

      return {
        user_id: user.id,
        role: user.role,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error getting user role:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLE_500',
        message: 'Internal server error',
      });
    }
  }

  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User role updated successfully', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request', type: ApiResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: 'User not found', type: ApiResponseDto })
  @ResponseMessage('User role updated successfully', 'ROLE_UPDATE_SUCCESS')
  async updateUserRole(
    @Param('id') userId: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() currentUser: User
  ) {
    try {
      const targetUserId = userId; // Keep as string since we're using UUIDs
      const { role } = updateRoleDto;

      // Check if user can update roles
      const canUpdate =
        currentUser.hasRoleEnum(UserRole.VENDOR_ADMIN) ||
        currentUser.hasRoleEnum(UserRole.VENDOR_MANAGER);

      if (!canUpdate) {
        throw new ForbiddenException({
          success: false,
          code: 'ROLE_403',
          message: 'Forbidden',
        });
      }

      // Users cannot change their own role
      if (currentUser.id === targetUserId) {
        throw new ForbiddenException({
          success: false,
          code: 'ROLE_403',
          message: 'Forbidden',
        });
      }

      // Get the target user to verify they exist and are in same company
      const targetUser = await this.roleService.getUserRole(userId);

      if (!targetUser) {
        throw new NotFoundException({
          success: false,
          code: 'ROLE_404',
          message: 'User not found',
        });
      }

      // For different company users, return 404 for security
      if (targetUser.company_id !== currentUser.company_id) {
        throw new NotFoundException({
          success: false,
          code: 'ROLE_404',
          message: 'User not found',
        });
      }

      // Role hierarchy checks
      // Company admins cannot promote to vendor admin
      if (currentUser.hasRoleEnum(UserRole.VENDOR_MANAGER) && role === UserRole.VENDOR_ADMIN) {
        throw new ForbiddenException({
          success: false,
          code: 'ROLE_403',
          message: 'Forbidden',
        });
      }

      await this.roleService.updateUserRole(userId, role);

      // Return updated user info
      const updatedUser = await this.roleService.getUserRole(userId);

      if (!updatedUser) {
        throw new NotFoundException({
          success: false,
          code: 'USER_404',
          message: 'User not found after update',
        });
      }

      return {
        user_id: updatedUser.id,
        role: updatedUser.role,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error('Error updating user role:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLE_500',
        message: 'Internal server error',
      });
    }
  }

  @Post('acme-invite')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users:invite:acme')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new Acme user' })
  @ApiResponse({
    status: 201,
    description: 'User invited successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or role',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already exists',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Unprocessable Entity - Auth0 error',
    type: ApiResponseDto,
  })
  @ResponseMessage('User invited successfully', 'INVITATION_201')
  async acmeInvite(@Body() inviteDto: AcmeInviteDto, @CurrentUser() currentUser: User) {
    try {
      const inviterId = currentUser.id;
      const newUser = await this.userService.acmeInvite(inviteDto, inviterId);

      return {
        success: true,
        code: 'INVITATION_201',
        message: 'User invited successfully',
        data: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role?.code || newUser.role,
          status: 'PENDING',
        },
      };
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error.status === 409 ||
        error.status === 422
      ) {
        throw error;
      }

      console.error('Error inviting Acme user:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'INVITATION_500',
        message: 'Internal server error during invitation',
      });
    }
  }

  @Post('vendor-invite')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('users:invite:vendor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new user to your vendor company' })
  @ApiResponse({
    status: 201,
    description: 'User invited successfully',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or role',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User already exists',
    type: ApiResponseDto,
  })
  @ApiResponse({
    status: 422,
    description: 'Unprocessable Entity - Auth0 error or no company',
    type: ApiResponseDto,
  })
  @ResponseMessage('User invited successfully', 'INVITATION_201')
  async vendorInvite(@Body() inviteDto: VendorInviteDto, @CurrentUser() currentUser: User) {
    try {
      // Get full inviter details including company
      const inviter = await this.userService.findById(currentUser.id);

      if (!inviter) {
        throw new NotFoundException({
          success: false,
          code: 'INVITER_NOT_FOUND',
          message: 'Inviter not found',
        });
      }

      const newUser = await this.userService.vendorInvite(inviteDto, inviter);

      return {
        success: true,
        code: 'INVITATION_201',
        message: 'User invited successfully',
        data: {
          id: newUser.id,
          email: newUser.email,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          role: newUser.role?.code || newUser.role,
          company_id: newUser.company_id,
          status: 'PENDING',
        },
      };
    } catch (error) {
      // Re-throw known exceptions
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error.status === 409 ||
        error.status === 422
      ) {
        throw error;
      }

      console.error('Error inviting vendor user:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'INVITATION_500',
        message: 'Internal server error during invitation',
      });
    }
  }
}
