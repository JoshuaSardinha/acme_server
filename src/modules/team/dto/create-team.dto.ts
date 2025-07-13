import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ArrayNotEmpty,
  IsOptional,
  MaxLength,
  MinLength,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TeamCategory } from '../entities/team.entity';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Team name (unique within company)',
    example: 'Legal Team Alpha',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  @MinLength(3, { message: 'Team name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Team name cannot exceed 100 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Team description',
    example: 'Handles complex litigation cases',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Team category',
    enum: TeamCategory,
    default: TeamCategory.CONVENTIONAL,
  })
  @IsOptional()
  @IsEnum(TeamCategory, { message: 'Invalid team category' })
  category?: TeamCategory = TeamCategory.CONVENTIONAL;

  @ApiProperty({
    description: 'UUID of the team owner (must be Manager/Admin)',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID('4', { message: 'Valid owner user ID is required' })
  @IsNotEmpty({ message: 'Owner user ID is required' })
  ownerUserId: string;

  @ApiProperty({
    description: 'Array of user IDs to add as team members',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one user must be assigned to the team' })
  @IsUUID('4', { each: true, message: 'All user IDs must be valid UUIDs' })
  memberIds: string[];

  @ApiPropertyOptional({
    description: 'Company ID (only for ACME_ADMIN users)',
    example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Valid company ID is required' })
  companyId?: string;

  // Note: company_id is derived from authenticated user context for security
  // Only ACME_ADMIN can specify companyId directly
}
