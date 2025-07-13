import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToClass } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../core/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/guards/permissions.guard';
import { SuperAdminBypassGuard } from '../../core/guards/super-admin-bypass.guard';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamResponseDto } from './dto/team-response.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { TeamService } from './team.service';

/**
 * @description Controller responsible for all team-related operations.
 * All endpoints are protected by JWT authentication.
 * Versioned under /v1.
 */
@ApiBearerAuth() // Indicates that all endpoints in this controller require a bearer token.
@ApiTags('Teams') // Groups endpoints under the "Teams" tag in Swagger UI.
@UseGuards(JwtAuthGuard, SuperAdminBypassGuard, PermissionsGuard) // Applies authentication and permission checks to all endpoints in this controller.
@UseInterceptors(ClassSerializerInterceptor) // Applies response serialization to prevent data leaks
@Controller('teams')
export class TeamController {
  private readonly logger = new Logger(TeamController.name);

  constructor(private readonly teamService: TeamService) {}

  /**
   * @description Creates a new team. The user who creates the team becomes its owner.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('teams:create:own', 'teams:create:any')
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({
    status: 201,
    description: 'The team has been successfully created.',
    type: TeamResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Conflict. Team name already exists.' })
  async create(
    @Body() createTeamDto: CreateTeamDto,
    @CurrentUser() user: any
  ): Promise<TeamResponseDto> {
    this.logger.log(`Creating team: ${createTeamDto.name} by user: ${user.id}`);

    const team = await this.teamService.create(createTeamDto, user);
    return plainToClass(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * @description Retrieves a paginated list of teams.
   * Can be filtered by query parameters.
   */
  @Get()
  @RequirePermissions('teams:read:own', 'teams:read:any')
  @ApiOperation({ summary: 'List all teams with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved list of teams.',
    type: 'PaginatedTeamResponseDto',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async findAll(
    @Query() paginationQuery: PaginationDto,
    @CurrentUser() user: any
  ): Promise<PaginatedResponseDto<TeamResponseDto>> {
    this.logger.log(`Fetching teams for user: ${user.id} with pagination`);

    const result = await this.teamService.findAllPaginated(paginationQuery, user);

    return {
      data: result.data.map((team) =>
        plainToClass(TeamResponseDto, team, { excludeExtraneousValues: true })
      ),
      meta: result.meta,
    };
  }

  /**
   * @description Retrieves the details of a specific team by its ID.
   * Access is restricted based on user permissions and team membership.
   */
  @Get(':teamId')
  @RequirePermissions('teams:read:own', 'teams:read:any')
  @ApiOperation({ summary: 'Get team details by ID' })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    format: 'uuid',
    description: 'The ID of the team',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved team details.',
    type: TeamResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have access to this team.',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found. Team with the specified ID does not exist.',
  })
  async findOne(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: any
  ): Promise<TeamResponseDto> {
    this.logger.log(`Fetching team: ${teamId} for user: ${user.id}`);

    const team = await this.teamService.findOneForUser(teamId, user);

    return plainToClass(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * @description Updates a team's details.
   * Access is restricted to team administrators.
   */
  @Patch(':teamId')
  @RequirePermissions('teams:update:own', 'teams:update:any')
  @ApiOperation({ summary: 'Update a team' })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    format: 'uuid',
    description: 'The ID of the team to update',
  })
  @ApiResponse({
    status: 200,
    description: 'The team has been successfully updated.',
    type: TeamResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have permission to update this team.',
  })
  @ApiResponse({ status: 404, description: 'Not Found. Team not found.' })
  async update(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() updateTeamDto: UpdateTeamDto,
    @CurrentUser() user: any
  ): Promise<TeamResponseDto> {
    this.logger.log(`Updating team: ${teamId} by user: ${user.id}`);

    const team = await this.teamService.update(user, teamId, updateTeamDto);
    return plainToClass(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * @description Deletes a team.
   * Access is restricted to team administrators/owners.
   */
  @Delete(':teamId')
  @HttpCode(HttpStatus.NO_CONTENT) // Correct HTTP status for successful deletion with no body.
  @RequirePermissions('teams:delete:own', 'teams:delete:any')
  @ApiOperation({ summary: 'Delete a team' })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    format: 'uuid',
    description: 'The ID of the team to delete',
  })
  @ApiResponse({ status: 204, description: 'The team has been successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have permission to delete this team.',
  })
  @ApiResponse({ status: 404, description: 'Not Found. Team not found.' })
  async remove(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser() user: any
  ): Promise<void> {
    this.logger.log(`Deleting team: ${teamId} by user: ${user.id}`);

    // Return type is Promise<void> to enforce no response body, aligning with 204 status.
    await this.teamService.remove(user, teamId);
  }

  /**
   * @description Adds one or more members to a team.
   * Access is restricted to team administrators.
   */
  @Post(':teamId/members')
  @RequirePermissions('teams:manage-members:own', 'teams:manage-members:any')
  @ApiOperation({ summary: 'Add members to a team' })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    format: 'uuid',
    description: 'The ID of the team',
  })
  @ApiBody({ type: AddMembersDto })
  @ApiResponse({
    status: 200,
    description: 'Members successfully added.',
    type: TeamResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid user IDs provided.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have permission to manage this team.',
  })
  async addMembers(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() addMembersDto: AddMembersDto,
    @CurrentUser() user: any
  ): Promise<TeamResponseDto> {
    this.logger.log(`Adding members to team: ${teamId} by user: ${user.id}`);

    const team = await this.teamService.addMembers(teamId, addMembersDto.userIds, user);
    return plainToClass(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * @description Removes a member from a team.
   * Access is restricted to team administrators.
   */
  @Delete(':teamId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('teams:manage-members:own', 'teams:manage-members:any')
  @ApiOperation({ summary: 'Remove a member from a team' })
  @ApiParam({
    name: 'teamId',
    type: 'string',
    format: 'uuid',
    description: 'The ID of the team',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'The ID of the user to remove',
  })
  @ApiResponse({ status: 204, description: 'The member has been successfully removed.' })
  @ApiResponse({ status: 400, description: 'Bad Request. Cannot remove this member.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User does not have permission to manage this team.',
  })
  @ApiResponse({ status: 404, description: 'Not Found. Team or User not found.' })
  async removeMember(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: any
  ): Promise<void> {
    this.logger.log(`Removing member: ${userId} from team: ${teamId} by user: ${user.id}`);

    await this.teamService.removeMember(user, teamId, userId);
  }
}
