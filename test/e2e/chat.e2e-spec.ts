import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as path from 'path';
import * as fs from 'fs';

// Core modules
import { AppModule } from '../../src/app.module';

/**
 * POST /chat/eb-2 E2E Tests
 *
 * Tests the chat endpoint functionality including:
 * - Simple questions without documents
 * - Questions with document uploads (PDF, DOCX, TXT)
 * - File validation (type and size limits)
 * - Error handling for invalid requests
 * - Multi-format document processing
 *
 * Note: Authentication is temporarily disabled for this demo test
 */
describe('POST /chat/eb-2 (E2E)', () => {
  let app: INestApplication;

  // Test files
  const testFilesDir = path.join(__dirname, '../fixtures/chat');
  const testPdfPath = path.join(testFilesDir, 'test-resume.pdf');
  const testDocxPath = path.join(testFilesDir, 'test-cover-letter.docx');
  const testTxtPath = path.join(testFilesDir, 'test-statement.txt');
  const invalidFilePath = path.join(testFilesDir, 'invalid-file.exe');
  const largeFilePath = path.join(testFilesDir, 'large-file.pdf');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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
    // Create a small PDF-like file (just for testing file handling)
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n180\n%%EOF');
    fs.writeFileSync(testPdfPath, pdfContent);

    // Create a small DOCX-like file (minimal ZIP structure)
    const docxContent = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00!\x00');
    fs.writeFileSync(testDocxPath, docxContent);

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

    // Create a large file (>10MB)
    const largeContent = Buffer.alloc(11 * 1024 * 1024, 'x'); // 11MB
    fs.writeFileSync(largeFilePath, largeContent);
  }

  // Authentication tests skipped for demo - authentication temporarily disabled

  describe('Simple Questions (No Documents)', () => {
    it('should process a basic EB-2 question', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What are the basic requirements for EB-2 NIW?')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        success: true,
        payload: {
          response: expect.any(String),
          confidence: expect.any(Number),
          sources: expect.arrayContaining([expect.any(String)]),
        },
      });

      expect(response.body.payload.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.payload.confidence).toBeLessThanOrEqual(1);
      expect(response.body.payload.response.length).toBeGreaterThan(10);
    });

    it('should process questions with context', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Do I qualify for EB-2 NIW?')
        .field('context', 'I have a PhD in Artificial Intelligence with 10 publications and 3 patents.')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        success: true,
        payload: {
          response: expect.any(String),
          confidence: expect.any(Number),
          sources: expect.any(Array),
        },
      });
    });

    it('should handle questions about specific EB-2 categories', async () => {
      const questions = [
        'What is the difference between EB-2A and EB-2B?',
        'How do I prove exceptional ability for EB-2B?',
        'What is the Matter of Dhanasar test?',
        'What documents are required for EB-2 NIW?',
      ];

      for (const question of questions) {
        const response = await request(app.getHttpServer())
          .post('/chat/eb-2')
            .field('question', question)
          .expect(HttpStatus.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.payload.response).toBeTruthy();
        expect(response.body.payload.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('Document Upload Tests', () => {
    it('should process a question with PDF document', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Does this resume meet EB-2 requirements?')
        .attach('document', testPdfPath)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        success: true,
        payload: {
          response: expect.any(String),
          confidence: expect.any(Number),
          sources: expect.any(Array),
          documentValidation: {
            isValid: expect.any(Boolean),
            issues: expect.any(Array),
            suggestions: expect.any(Array),
          },
        },
      });
    });

    it('should process a question with DOCX document', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Please review this cover letter for EB-2 application')
        .attach('document', testDocxPath)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.payload.documentValidation).toBeDefined();
    });

    it('should process a question with TXT document', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Evaluate my qualifications for EB-2 NIW')
        .attach('document', testTxtPath)
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.payload.documentValidation).toBeDefined();
      expect(response.body.payload.response).toContain('AI'); // Should mention AI from the content
    });

    it('should include document validation results', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Validate this document for EB-2 application')
        .attach('document', testTxtPath)
        .expect(HttpStatus.OK);

      const { documentValidation } = response.body.payload;
      expect(documentValidation).toMatchObject({
        isValid: expect.any(Boolean),
        issues: expect.any(Array),
        suggestions: expect.any(Array),
      });

      expect(Array.isArray(documentValidation.issues)).toBe(true);
      expect(Array.isArray(documentValidation.suggestions)).toBe(true);
    });
  });

  describe('File Validation Tests', () => {
    it('should reject invalid file types', async () => {
      await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Test question')
        .attach('document', invalidFilePath)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject files over 10MB', async () => {
      await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Test question')
        .attach('document', largeFilePath)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should accept requests without documents', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What is EB-2?')
        .expect(HttpStatus.OK);

      expect(response.body.payload.documentValidation).toBeUndefined();
    });
  });

  describe('Input Validation Tests', () => {
    it('should require question field', async () => {
      await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('context', 'Some context')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject empty question', async () => {
      await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', '')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should accept optional context field', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What is EB-2?')
        .field('context', 'I am a software engineer')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle AI service unavailable gracefully', async () => {
      // This test assumes the AI service might not be configured in test environment
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What is EB-2 NIW?')
        .expect(HttpStatus.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.payload.response).toBeTruthy();
      
      // Should either have a real AI response or a fallback
      expect(
        response.body.payload.response.includes('EB-2') ||
        response.body.payload.response.includes('technical difficulties')
      ).toBe(true);
    });

    it('should handle malformed file uploads', async () => {
      // Create a file that claims to be PDF but isn't
      const malformedPdfPath = path.join(testFilesDir, 'malformed.pdf');
      fs.writeFileSync(malformedPdfPath, 'This is not a real PDF file');

      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'Review this document')
        .attach('document', malformedPdfPath)
        .expect(HttpStatus.OK);

      // Should handle gracefully even if document processing fails
      expect(response.body.success).toBe(true);
      expect(response.body.payload.response).toBeTruthy();

      // Clean up
      fs.unlinkSync(malformedPdfPath);
    });
  });

  describe('Response Format Tests', () => {
    it('should return consistent response structure', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What are EB-2 categories?')
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        success: true,
        code: expect.any(String),
        message: expect.any(String),
        payload: {
          response: expect.any(String),
          confidence: expect.any(Number),
          sources: expect.any(Array),
        },
      });

      // Validate confidence is within valid range
      expect(response.body.payload.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.payload.confidence).toBeLessThanOrEqual(1);

      // Validate sources array
      expect(Array.isArray(response.body.payload.sources)).toBe(true);
      expect(response.body.payload.sources.length).toBeGreaterThan(0);
    });

    it('should include appropriate sources', async () => {
      const response = await request(app.getHttpServer())
        .post('/chat/eb-2')
        .field('question', 'What regulations govern EB-2?')
        .expect(HttpStatus.OK);

      const sources = response.body.payload.sources;
      expect(sources).toContain(expect.stringMatching(/knowledge|base|fallback/i));
    });
  });
});