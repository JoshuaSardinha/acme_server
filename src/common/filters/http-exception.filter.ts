import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  ExecutionContext,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Reflector } from '@nestjs/core';
import { ApiResponseDto } from '../dto/api-response.dto';
// Removed express compatibility validation exceptions
import { TEAM_VALIDATION_KEY } from '../decorators/team-validation.decorator';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly reflector?: Reflector) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal server error occurred.';
    const payload: any = null;

    // Check if this is an auth endpoint
    const isAuthEndpoint = this.isAuthEndpoint(request.url);

    // Check if this endpoint uses team validation format
    let useTeamValidation = false;
    if (this.reflector && host.getType() === 'http') {
      try {
        // Try to get handler from execution context
        const executionContext = host as ExecutionContext;
        const handler = executionContext.getHandler?.();
        if (handler) {
          useTeamValidation = this.reflector.get<boolean>(TEAM_VALIDATION_KEY, handler) ?? false;
        }
      } catch (error) {
        // Silently ignore metadata retrieval errors
        useTeamValidation = false;
      }
    }

    // Removed express compatibility validation exception handling

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'object' && errorResponse !== null) {
        const errorObj = errorResponse as any;

        // Handle validation errors from the custom pipe
        if (errorObj.isValidation && errorObj.validationErrors) {
          if (isAuthEndpoint) {
            // Return simple format for auth endpoints
            return response.status(status).json({
              errors: errorObj.validationErrors,
            });
          } else if (useTeamValidation) {
            // Return team validation format
            return response.status(status).json({
              success: false,
              code: 'TEAM_VALIDATION_ERROR',
              message: 'Invalid company data provided',
              errors: errorObj.validationErrors,
            });
          } else {
            // Return standard validation format for other endpoints
            return response.status(status).json({
              success: false,
              code: 'VALIDATION_ERROR',
              message: 'Invalid data provided',
              errors: errorObj.validationErrors,
            });
          }
        }

        // Handle existing error formats (preserve current behavior)
        if (errorObj.success !== undefined) {
          // This is already in the correct format (from controllers)
          return response.status(status).json(errorObj);
        }

        // Handle class-validator responses
        if ('message' in errorObj && 'error' in errorObj) {
          const msgValue = errorObj.message;
          // Return the standard validation error format
          return response.status(status).json({
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Invalid data provided',
            errors: Array.isArray(msgValue) ? msgValue : [msgValue],
          });
        } else {
          message = errorObj.message || exception.message;
          code = errorObj.code || this.getErrorCodeFromStatus(status);
        }
      } else {
        message = errorResponse as string;
        code = this.getErrorCodeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      // Log the full error for debugging, but don't expose stack to the client
      this.logger.error(exception.message, exception.stack);
    }

    const responseBody = new ApiResponseDto<null>(false, code, message, payload);

    response.status(status).json(responseBody);
  }

  private isAuthEndpoint(url: string): boolean {
    // Check if URL starts with /auth/
    return url ? url.startsWith('/auth/') : false;
  }

  private getErrorCodeFromStatus(status: number, error?: string): string {
    if (error) {
      return error.replace(/\s+/g, '_').toUpperCase();
    }
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
