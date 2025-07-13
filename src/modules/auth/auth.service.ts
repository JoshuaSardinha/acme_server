import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import axios from 'axios';
import { SignUpDto } from './dto/signup.dto';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  private managementApiToken: string | null = null;
  private tokenExpirationTime: number = 0;

  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private configService: ConfigService
  ) {}

  private getAuth0Config() {
    const env = process.env.NODE_ENV || 'development';

    // You might want to move this to a dedicated config file
    const config = {
      development: {
        auth0IssuerBaseUrl: this.configService.get('AUTH0_ISSUER_BASE_URL'),
        auth0ClientId: this.configService.get('AUTH0_CLIENT_ID'),
        auth0ClientSecret: this.configService.get('AUTH0_CLIENT_SECRET'),
        auth0ManagementClientSecret: this.configService.get('AUTH0_MANAGEMENT_CLIENT_SECRET'),
        auth0ManagementClientId: this.configService.get('AUTH0_MANAGEMENT_CLIENT_ID'),
        auth0ManagementAudience: this.configService.get('AUTH0_MANAGEMENT_AUDIENCE'),
        apiAudience: this.configService.get('AUTH0_AUDIENCE'),
      },
      production: {
        auth0IssuerBaseUrl: this.configService.get('AUTH0_ISSUER_BASE_URL'),
        auth0ClientId: this.configService.get('AUTH0_CLIENT_ID'),
        auth0ClientSecret: this.configService.get('AUTH0_CLIENT_SECRET'),
        auth0ManagementClientSecret: this.configService.get('AUTH0_MANAGEMENT_CLIENT_SECRET'),
        auth0ManagementClientId: this.configService.get('AUTH0_MANAGEMENT_CLIENT_ID'),
        auth0ManagementAudience: this.configService.get('AUTH0_MANAGEMENT_AUDIENCE'),
        apiAudience: this.configService.get('AUTH0_AUDIENCE'),
      },
      test: {
        auth0IssuerBaseUrl: this.configService.get('AUTH0_ISSUER_BASE_URL'),
        auth0ClientId: this.configService.get('AUTH0_CLIENT_ID'),
        auth0ClientSecret: this.configService.get('AUTH0_CLIENT_SECRET'),
        auth0ManagementClientSecret: this.configService.get('AUTH0_MANAGEMENT_CLIENT_SECRET'),
        auth0ManagementClientId: this.configService.get('AUTH0_MANAGEMENT_CLIENT_ID'),
        auth0ManagementAudience: this.configService.get('AUTH0_MANAGEMENT_AUDIENCE'),
        apiAudience: this.configService.get('AUTH0_AUDIENCE'),
      },
      local: {
        auth0IssuerBaseUrl: this.configService.get('AUTH0_ISSUER_BASE_URL'),
        auth0ClientId: this.configService.get('AUTH0_CLIENT_ID'),
        auth0ClientSecret: this.configService.get('AUTH0_CLIENT_SECRET'),
        auth0ManagementClientSecret: this.configService.get('AUTH0_MANAGEMENT_CLIENT_SECRET'),
        auth0ManagementClientId: this.configService.get('AUTH0_MANAGEMENT_CLIENT_ID'),
        auth0ManagementAudience: this.configService.get('AUTH0_MANAGEMENT_AUDIENCE'),
        apiAudience: this.configService.get('AUTH0_AUDIENCE'),
      },
    };

    return config[env] || config.development;
  }

  async createUser(
    firstName: string,
    lastName: string,
    email: string,
    auth0UserId: string
  ): Promise<User> {
    try {
      const user = await this.userModel.create({
        first_name: firstName,
        last_name: lastName,
        email,
        auth0_user_id: auth0UserId,
      });
      return user;
    } catch (error) {
      throw error;
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.userModel.findOne({ where: { email } });
      return user;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findUserById(userId: string): Promise<User | null> {
    try {
      const user = await this.userModel.findOne({ where: { id: userId } });
      return user;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  async findUserByAuth0Id(auth0UserId: string): Promise<User | null> {
    try {
      const user = await this.userModel.findOne({ where: { auth0_user_id: auth0UserId } });
      return user;
    } catch (error) {
      console.error('Error finding user by Auth0 ID:', error);
      throw error;
    }
  }

  async getManagementApiToken(): Promise<string | null> {
    // Check if token exists and is still valid
    if (this.managementApiToken && Date.now() < this.tokenExpirationTime) {
      return this.managementApiToken;
    }

    try {
      const envConfig = this.getAuth0Config();

      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: envConfig.auth0ManagementClientId,
          client_secret: envConfig.auth0ManagementClientSecret,
          audience: envConfig.auth0ManagementAudience,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      this.managementApiToken = auth0Response.data.access_token;
      this.tokenExpirationTime = Date.now() + (auth0Response.data.expires_in - 60) * 1000;

      return this.managementApiToken;
    } catch (error) {
      if (error.response) {
        console.error('Error getting Management API token:', error.response.data);
        throw new InternalServerErrorException('Failed to get Management API token');
      }
      throw error;
    }
  }

  async signUpWithAuth0(signUpDto: SignUpDto): Promise<any> {
    try {
      const { firstName, lastName, email, password } = signUpDto;
      const token = await this.getManagementApiToken();
      const envConfig = this.getAuth0Config();

      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/api/v2/users`,
        {
          connection: 'Acme-DB',
          email,
          password,
          user_metadata: {
            firstName,
            lastName,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return auth0Response;
    } catch (error) {
      if (error.response) {
        console.error('Error signing up with Auth0:', error.response.data);
        if (error.response.status === 409) {
          throw new BadRequestException('Email already exists');
        }
        if (error.response.data.message?.includes('PasswordStrengthError')) {
          throw new BadRequestException('Password is too weak');
        }
        throw new BadRequestException('Failed to create user in Auth0');
      }
      throw error;
    }
  }

  async refreshWithAuth0(refreshToken: string): Promise<any> {
    try {
      const envConfig = this.getAuth0Config();

      const auth0Response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/oauth/token`,
        {
          grant_type: 'refresh_token',
          client_id: envConfig.auth0ClientId,
          client_secret: this.configService.get('AUTH0_CLIENT_SECRET'),
          refresh_token: refreshToken,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return auth0Response;
    } catch (error) {
      if (error.response) {
        console.error('Error refreshing token with Auth0:', error.response.data);
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw error;
    }
  }

  async exchangeCodeForTokens(code: string): Promise<any> {
    try {
      const envConfig = this.getAuth0Config();

      const tokenResponse = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/oauth/token`,
        {
          grant_type: 'authorization_code',
          client_id: envConfig.auth0ClientId,
          client_secret: this.configService.get('AUTH0_CLIENT_SECRET'),
          code: code,
          redirect_uri: 'com.acme.acmeapp://auth',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return tokenResponse;
    } catch (error) {
      if (error.response) {
        console.error('Error exchanging code for tokens:', error.response.data);
        throw new BadRequestException('Failed to exchange code for tokens');
      }
      throw error;
    }
  }

  async createAuth0User(userData: {
    email: string;
    name: string;
    user_metadata: any;
  }): Promise<any> {
    try {
      const token = await this.getManagementApiToken();
      const envConfig = this.getAuth0Config();

      const response = await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/api/v2/users`,
        {
          email: userData.email,
          name: userData.name,
          connection: 'Acme-DB',
          password: this.generateTemporaryPassword(),
          user_metadata: userData.user_metadata,
          verify_email: false, // We'll send custom invitation
          email_verified: false,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        throw new BadRequestException({
          success: false,
          code: 'USER_EXISTS_AUTH0',
          message: 'User already exists in Auth0',
        });
      }
      console.error('Auth0 user creation failed:', error.response?.data || error.message);
      throw new InternalServerErrorException({
        success: false,
        code: 'AUTH0_ERROR',
        message: 'Failed to create user in authentication system',
      });
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      const token = await this.getManagementApiToken();
      const envConfig = this.getAuth0Config();

      await axios.post(
        `${envConfig.auth0IssuerBaseUrl}/api/v2/tickets/password-change`,
        {
          email: email,
          connection_id: 'con_XYZ', // You'll need to get your actual connection ID
          mark_email_as_verified: true,
          ttl_sec: 604800, // 7 days
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Failed to send password reset email:', error.response?.data || error.message);
      throw new InternalServerErrorException({
        success: false,
        code: 'EMAIL_ERROR',
        message: 'Failed to send invitation email',
      });
    }
  }

  private generateTemporaryPassword(): string {
    // Generate a secure temporary password that meets Auth0 requirements
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }
}
