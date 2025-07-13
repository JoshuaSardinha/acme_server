import { IsOptional, IsString } from 'class-validator';

export class SearchTeamUsersDto {
  @IsOptional()
  @IsString()
  searchValue?: string;
}
