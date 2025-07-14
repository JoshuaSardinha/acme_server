import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';

// Create a minimal test module for chat testing
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { ChatController } from '../../src/modules/chat/chat.controller';
import { ChatService } from '../../src/modules/chat/services/chat.service';
import { LangChainService } from '../../src/modules/chat/services/langchain.service';
import { DocumentProcessorService } from '../../src/modules/chat/services/document-processor.service';
import { VectorStoreService } from '../../src/modules/chat/services/vector-store.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true, // Use environment variables directly
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

/**
 * Chat E2E Tests (Simplified)
 *
 * Tests basic chat functionality without database dependencies
 */
describe('Chat E2E (Simple)', () => {
  let app: INestApplication;

  // Test files
  const testFilesDir = path.join(__dirname, '../fixtures/chat');
  const testTxtPath = path.join(testFilesDir, 'test-statement.txt');
  const invalidFilePath = path.join(testFilesDir, 'invalid-file.exe');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestChatModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();

    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create test files
    await createTestFiles();
  });

  afterAll(async () => {
    // Cleanup test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }

    await app.close();
  });

  async function createTestFiles() {
    // Create a text file
    const txtContent = `Education: PhD in Computer Science from MIT
Experience: 10 years in AI research
Publications: 15 peer-reviewed papers
Patents: 3 US patents in machine learning
Awards: Outstanding Researcher Award 2023
Current Role: Senior AI Research Scientist at TechCorp
Proposed Endeavor: Developing next-generation AI algorithms for healthcare applications`;
    fs.writeFileSync(testTxtPath, txtContent);

    // Create an invalid file type
    fs.writeFileSync(invalidFilePath, 'This is not a valid document file');
  }

  describe('Basic Functionality', () => {
    it('should respond to basic EB-2 questions', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What are the basic requirements for EB-2 NIW?')
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('response');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('sources');

      expect(typeof response.body.response).toBe('string');
      expect(typeof response.body.confidence).toBe('number');
      expect(Array.isArray(response.body.sources)).toBe(true);
      
      expect(response.body.response.length).toBeGreaterThan(10);
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle questions with context', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Do I qualify for EB-2 NIW?')
        .field('context', 'I have a PhD in Artificial Intelligence')
        .expect(HttpStatus.CREATED);

      expect(response.body.response).toBeTruthy();
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should process document uploads', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Evaluate my qualifications for EB-2 NIW')
        .attach('document', testTxtPath)
        .expect(HttpStatus.CREATED);

      expect(response.body.response).toBeTruthy();
      expect(response.body.documentValidation).toBeDefined();
      expect(response.body.documentValidation).toHaveProperty('isValid');
      expect(response.body.documentValidation).toHaveProperty('issues');
      expect(response.body.documentValidation).toHaveProperty('suggestions');
    });
  });

  describe('Validation Tests', () => {
    it('should require question field', async () => {
      await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('context', 'Some context')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject invalid file types', async () => {
      await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Test question')
        .attach('document', invalidFilePath)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should accept requests without documents', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What is EB-2?')
        .expect(HttpStatus.CREATED);

      expect(response.body.documentValidation).toBeUndefined();
    });
  });

  describe('Response Format', () => {
    it('should return consistent response structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What are EB-2 categories?')
        .expect(HttpStatus.CREATED);

      expect(response.body).toMatchObject({
        response: expect.any(String),
        confidence: expect.any(Number),
        sources: expect.any(Array),
      });

      // Validate confidence is within valid range
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(1);

      // Validate sources array
      expect(Array.isArray(response.body.sources)).toBe(true);
      expect(response.body.sources.length).toBeGreaterThan(0);
    });
  });
});