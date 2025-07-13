import { ApiProperty } from '@nestjs/swagger';

export class ClientConfigDto {
  @ApiProperty({
    example: 'dev-3jngnvbb08dw5nhq.us.auth0.com',
    description: 'Auth0 domain for authentication',
  })
  auth0Domain: string;

  @ApiProperty({
    example: 'https://api.nationalniner.com',
    description: 'API audience for Auth0',
  })
  apiAudience: string;

  @ApiProperty({
    example: 'vGxKHocnGDiFKqO4kbnltEO0ZP7fawWc',
    description: 'Auth0 client ID for the application',
  })
  auth0ClientId: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Minimum supported iOS version',
  })
  minIosVersion: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Minimum supported Android version',
  })
  minAndroidVersion: string;

  @ApiProperty({
    example: '1.0.0',
    description: 'Minimum supported web version',
  })
  minWebVersion: string;

  @ApiProperty({
    example: true,
    description: 'Whether the client should perform health checks on the server',
  })
  shouldHealthCheckServer: boolean;
}
