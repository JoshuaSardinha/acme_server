import { Global, Module } from '@nestjs/common';
import { BusinessErrorService } from './services/business-error.service';
import { BusinessTransactionService } from './services/business-transaction.service';

@Global()
@Module({
  providers: [BusinessErrorService, BusinessTransactionService],
  exports: [BusinessErrorService, BusinessTransactionService],
})
export class CommonModule {}
