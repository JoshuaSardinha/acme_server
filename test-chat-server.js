const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { Module } = require('@nestjs/common');
const { ConfigModule } = require('@nestjs/config');
const { MulterModule } = require('@nestjs/platform-express');

// Import chat module components
const { ChatController } = require('./dist/src/modules/chat/chat.controller');
const { ChatService } = require('./dist/src/modules/chat/services/chat.service');
const { LangChainService } = require('./dist/src/modules/chat/services/langchain.service');
const { DocumentProcessorService } = require('./dist/src/modules/chat/services/document-processor.service');
const { VectorStoreService } = require('./dist/src/modules/chat/services/vector-store.service');

// Create minimal test module
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
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
})
class TestChatModule {}

async function bootstrap() {
  const app = await NestFactory.create(TestChatModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  await app.listen(3001);
  console.log('Test chat server running on http://localhost:3001');
  console.log('Try: curl -X POST http://localhost:3001/chat/eb-2 -F "question=Test" -F "document=@your-file.pdf"');
}

bootstrap().catch(console.error);