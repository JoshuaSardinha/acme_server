import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { TeamCategory } from '../entities/team.entity';

/**
 * Defines the public-facing shape of a Team object.
 * Use with ClassSerializerInterceptor to prevent leaking sensitive data.
 * @Exclude() by default denies all properties.
 * @Expose() explicitly marks properties as safe to be included in the response.
 */
@Exclude()
export class TeamResponseDto {
  @ApiProperty({
    description: 'The unique identifier for the team',
    example: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'The company this team belongs to',
    example: 'c4a8f4b0-8d2a-4b6d-8f9c-1e2b3d4a5f6g',
  })
  @Expose()
  companyId: string;

  @ApiProperty({
    description: 'The name of the team',
    example: 'Legal Team Alpha',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'The description for the team',
    example: 'Handles all high-profile litigation cases',
  })
  @Expose()
  description: string;

  @ApiProperty({
    description: 'The category of the team',
    enum: TeamCategory,
  })
  @Expose()
  category: TeamCategory;

  @ApiProperty({
    description: 'The UUID of the user who owns the team',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @Expose()
  ownerUserId: string;

  @ApiProperty({
    description: 'The active status of the team',
    example: true,
  })
  @Expose()
  isActive: boolean;

  @ApiProperty({
    description: 'When the team was created',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty({
    description: 'When the team was last updated',
    example: '2023-12-01T10:00:00Z',
  })
  @Expose()
  @Type(() => Date)
  updatedAt: Date;

  // Team owner information (nested object)
  @ApiProperty({
    description: 'Team owner details',
    type: 'object',
  })
  @Expose()
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  // Team members information (array of nested objects)
  @ApiProperty({
    description: 'Team members',
    type: 'array',
  })
  @Expose()
  members?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isLawyer: boolean;
  }>;

  // Company information (nested object)
  @ApiProperty({
    description: 'Company details',
    type: 'object',
  })
  @Expose()
  company?: {
    id: string;
    name: string;
  };

  // Sensitive fields that should never be exposed:
  // - Internal audit notes
  // - Database metadata
  // - Relations that might contain sensitive user data
}
