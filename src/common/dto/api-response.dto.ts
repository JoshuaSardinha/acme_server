import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({
    description: 'Indicates if the request was successful.',
    example: true,
  })
  readonly success: boolean;

  @ApiProperty({
    description: 'A unique code for the response status.',
    example: 'USER_FOUND',
  })
  readonly code: string;

  @ApiProperty({
    description: 'A human-readable message.',
    example: 'User found successfully.',
  })
  readonly message: string;

  @ApiProperty({
    description: 'The data payload of the response.',
    nullable: true,
    required: false,
  })
  readonly payload?: T;

  constructor(success: boolean, code: string, message: string, payload?: T) {
    this.success = success;
    this.code = code;
    this.message = message;
    this.payload = payload;
  }
}
