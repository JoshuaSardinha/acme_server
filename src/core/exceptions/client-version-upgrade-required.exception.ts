import { HttpException } from '@nestjs/common';

export class ClientVersionUpgradeRequiredException extends HttpException {
  constructor() {
    super(
      {
        success: false,
        code: 'FORCE_UPDATE_REQUIRED',
        message: 'Your client is too old. Please update.',
        payload: null,
      },
      426 // HTTP 426 Upgrade Required
    );
  }
}
