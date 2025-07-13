import { IsNotEmpty, IsUUID } from 'class-validator';

export class ChangeTeamManagerDto {
  @IsUUID('4', { message: 'Valid user ID is required' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}
