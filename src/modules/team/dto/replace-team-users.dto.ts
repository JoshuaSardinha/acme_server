import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class ReplaceTeamUsersDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one user ID must be provided' })
  @IsUUID('4', { each: true, message: 'All user IDs must be valid UUIDs' })
  userIds: string[];
}
