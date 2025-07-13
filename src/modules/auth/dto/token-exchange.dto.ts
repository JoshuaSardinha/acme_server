import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TokenExchangeDto {
  @ApiProperty({ description: 'Authorization code from OAuth flow' })
  @IsNotEmpty()
  @IsString()
  code: string;
}
