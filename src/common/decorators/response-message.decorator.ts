import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';
export const RESPONSE_CODE_KEY = 'responseCode';

export const ResponseMessage =
  (message: string, code: string) => (target: any, key: string, descriptor: PropertyDescriptor) => {
    SetMetadata(RESPONSE_MESSAGE_KEY, message)(target, key, descriptor);
    SetMetadata(RESPONSE_CODE_KEY, code)(target, key, descriptor);
  };
