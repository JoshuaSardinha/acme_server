import {
  Controller,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { UpdateRoleDto } from './dto';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { CompanyAdminGuard } from '../../core/guards/company-admin.guard';

@ApiTags('role')
@Controller('role')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Put(':userId')
  @UseGuards(CompanyAdminGuard)
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req: any
  ) {
    try {
      const { role } = updateRoleDto;
      const userToUpdate = req.userToUpdate;

      await this.roleService.updateUserRole(userToUpdate.id, role);

      return {
        success: true,
        code: 'UPDATE_ROLE_SUCCESS',
        message: 'User role updated successfully',
      };
    } catch (error) {
      console.error('Error updating user role:', error);
      throw new InternalServerErrorException({
        success: false,
        code: 'ROLE_500',
        message: 'Internal server error',
      });
    }
  }
}
