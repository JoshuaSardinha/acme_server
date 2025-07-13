import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { RoleDto } from './user-profile.dto';

export class AuthResponseDto {
  @ApiProperty()
  @Expose()
  success: boolean;

  @ApiProperty()
  @Expose()
  code: string;

  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty()
  @Expose()
  payload: any;
}

export class UserDataResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  auth0Id: string;

  @ApiProperty()
  @Expose()
  firstName: string;

  @ApiProperty()
  @Expose()
  lastName: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty({ type: RoleDto })
  @Expose()
  @Type(() => RoleDto)
  role: RoleDto;

  @ApiProperty()
  @Expose()
  isLawyer: boolean;

  @ApiProperty()
  @Expose()
  companyId?: string;
}

export class TokenResponseDto {
  @ApiProperty()
  @Expose()
  accessToken: string;

  @ApiProperty()
  @Expose()
  refreshToken: string;

  @ApiProperty()
  @Expose()
  expiresIn: number;
}
