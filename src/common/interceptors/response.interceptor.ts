import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponseDto } from '../dto/api-response.dto';
import { RESPONSE_CODE_KEY, RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseDto<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseDto<T>> {
    const customMessage = this.reflector.get<string>(RESPONSE_MESSAGE_KEY, context.getHandler());
    const customCode = this.reflector.get<string>(RESPONSE_CODE_KEY, context.getHandler());

    return next.handle().pipe(
      map((data) => {
        // If the response is already in our standard format, return it directly
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'code' in data &&
          'message' in data
        ) {
          return data;
        }

        return new ApiResponseDto<T>(
          true,
          customCode || 'SUCCESS',
          customMessage || 'Operation successful',
          data
        );
      })
    );
  }
}
