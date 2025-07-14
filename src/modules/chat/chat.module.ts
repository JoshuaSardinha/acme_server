import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ChatController } from './chat.controller';
import { ChatService } from './services/chat.service';
import { LangChainService } from './services/langchain.service';
import { DocumentProcessorService } from './services/document-processor.service';
import { VectorStoreService } from './services/vector-store.service';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads/chat',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    LangChainService,
    DocumentProcessorService,
    VectorStoreService,
  ],
  exports: [ChatService],
})
export class ChatModule {}