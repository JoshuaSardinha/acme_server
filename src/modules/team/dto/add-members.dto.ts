import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class AddMembersDto {
  @ApiProperty({
    description: 'Array of user IDs to add as team members',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one user ID must be provided' })
  @IsUUID('4', { each: true, message: 'All user IDs must be valid UUIDs' })
  userIds: string[];
}
