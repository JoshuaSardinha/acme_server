import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientVersionGuard } from '../../core/guards/client-version.guard';
import { JwtAuthGuard } from '../../core/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/signup.dto';
import { TokenExchangeDto } from './dto/token-exchange.dto';

// Auth Controller Response Codes (matching the original)
const AuthControllerCodes = {
  TOKEN_EXCHANGE_SUCCESS: {
    code: 'AUTH_TOKEN_EXCHANGE_SUCCESSFUL',
    message: 'Tokens successfully exchanged',
  },
  SIGNUP_SUCCESS: {
    code: 'AUTH_SIGN_UP_SUCCESSFUL',
    message: 'User successfully created',
  },
  LOGIN_SUCCESS: {
    code: 'AUTH_LOGIN_SUCCESSFUL',
    message: 'Login successful',
  },
  TOKEN_REFRESH_SUCCESS: {
    code: 'AUTH_TOKEN_REFRESH_SUCCESSFUL',
    message: 'Token refresh successful',
  },
  GET_USER_SUCCESS: {
    code: 'GET_USER_SUCCESSFUL',
    message: 'Getting user data successful',
  },
  TOKEN_EXCHANGE_FAILED: {
    code: 'AUTH_TOKEN_EXCHANGE_FAILED',
    message: 'Failed to exchange code for tokens',
  },
  SIGNUP_FAILED: {
    code: 'AUTH_FAILED_TO_CREATE_USER',
    message: 'Failed to create user',
  },
  EMAIL_EXISTS: {
    code: 'AUTH_FAILED_EMAIL_EXISTS',
    message: 'Email already exists',
  },
  INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid credentials',
  },
  USER_NOT_FOUND: {
    code: 'AUTH_USER_NOT_FOUND',
    message: 'User not found',
  },
  TOKEN_REFRESH_FAILED: {
    code: 'AUTH_TOKEN_REFRESH_FAILED',
    message: 'Failed to refresh token',
  },
  AUTH0_API_ERROR: {
    code: 'AUTH_0_API_ERROR',
    message: 'Internal server error',
  },
  SERVER_ERROR: {
    code: 'AUTH_500',
    message: 'Internal server error',
  },
  WEAK_PASSWORD: {
    code: 'AUTH_WEAK_PASSWORD',
    message: 'Password is too weak',
  },
};

@ApiTags('auth')
@Controller('auth')
@UseGuards(ClientVersionGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange authorization code for tokens (deprecated)' })
  @ApiResponse({ status: 200, description: 'Token exchange successful', type: AuthResponseDto })
  async exchangeCodeForTokens(
    @Body() tokenExchangeDto: TokenExchangeDto
  ): Promise<AuthResponseDto> {
    try {
      const tokenResponse = await this.authService.exchangeCodeForTokens(tokenExchangeDto.code);

      return {
        success: true,
        ...AuthControllerCodes.TOKEN_EXCHANGE_SUCCESS,
        payload: {
          accessToken: tokenResponse.data.access_token,
          refreshToken: tokenResponse.data.refresh_token,
          expiresIn: tokenResponse.data.expires_in,
        },
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new BadRequestException({
        success: false,
        ...AuthControllerCodes.TOKEN_EXCHANGE_FAILED,
        payload: { error: error.message },
      });
    }
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Sign up a new user' })
  @ApiResponse({ status: 201, description: 'User successfully created', type: AuthResponseDto })
  async signUp(@Body() signUpDto: SignUpDto): Promise<AuthResponseDto> {
    try {
      const { firstName, lastName, email, password } = signUpDto;

      const auth0Response = await this.authService.signUpWithAuth0(signUpDto);
      if (!auth0Response) {
        throw new BadRequestException({
          success: false,
          ...AuthControllerCodes.SIGNUP_FAILED,
          payload: { error: 'Failed to create user in Auth0' },
        });
      }

      // Save user in the local database
      const auth0UserId = auth0Response.data.user_id;
      const user = await this.authService.createUser(firstName, lastName, email, auth0UserId);

      return {
        success: true,
        ...AuthControllerCodes.SIGNUP_SUCCESS,
        payload: {
          id: user.id,
          auth0Id: auth0UserId,
          firstName: firstName,
          lastName: lastName,
          email: email,
        },
      };
    } catch (error) {
      // Handle unique constraint violation (duplicate email)
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new BadRequestException({
          success: false,
          ...AuthControllerCodes.EMAIL_EXISTS,
          payload: { error: 'Email already exists' },
        });
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error(error);
      throw new InternalServerErrorException({
        success: false,
        ...AuthControllerCodes.SERVER_ERROR,
        payload: { error: 'An unexpected error occurred while creating user' },
      });
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (deprecated)' })
  @ApiResponse({ status: 200, description: 'Token refresh successful', type: AuthResponseDto })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      const auth0Response = await this.authService.refreshWithAuth0(refreshTokenDto.refreshToken);

      if (!auth0Response) {
        throw new UnauthorizedException({
          success: false,
          ...AuthControllerCodes.TOKEN_REFRESH_FAILED,
          payload: { error: 'Invalid refresh token' },
        });
      }

      return {
        success: true,
        ...AuthControllerCodes.TOKEN_REFRESH_SUCCESS,
        payload: {
          accessToken: auth0Response.data.access_token,
          refreshToken: auth0Response.data.refresh_token || refreshTokenDto.refreshToken,
          expiresIn: auth0Response.data.expires_in,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      console.error(error);
      throw new InternalServerErrorException({
        success: false,
        ...AuthControllerCodes.SERVER_ERROR,
        payload: { error: 'Error refreshing token' },
      });
    }
  }

  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user data' })
  @ApiResponse({
    status: 200,
    description: 'User data retrieved successfully',
    type: AuthResponseDto,
  })
  async getUserData(@Request() req): Promise<AuthResponseDto> {
    try {
      const user = req.user;

      if (!user) {
        throw new NotFoundException({
          success: false,
          ...AuthControllerCodes.USER_NOT_FOUND,
          payload: { error: 'User not found' },
        });
      }

      return {
        success: true,
        ...AuthControllerCodes.GET_USER_SUCCESS,
        payload: {
          id: user.id,
          auth0Id: user.auth0_user_id,
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          role: user.role,
          isLawyer: user.is_lawyer,
          companyId: user.company_id,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      console.error(error);
      throw new InternalServerErrorException({
        success: false,
        ...AuthControllerCodes.SERVER_ERROR,
        payload: { error: 'Error getting user data' },
      });
    }
  }
}
