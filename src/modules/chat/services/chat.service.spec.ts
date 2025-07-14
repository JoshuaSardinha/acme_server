import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { LangChainService } from './langchain.service';
import { DocumentProcessorService } from './document-processor.service';
import { VectorStoreService } from './vector-store.service';
import { ChatEb2Dto } from '../dto/chat-eb2.dto';
import { User } from '../../auth/entities/user.entity';
import { Readable } from 'stream';

describe('ChatService', () => {
  let service: ChatService;
  let langChainService: jest.Mocked<LangChainService>;
  let documentProcessor: jest.Mocked<DocumentProcessorService>;
  let vectorStore: jest.Mocked<VectorStoreService>;

  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'test@example.com',
    company_id: 'company-123',
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'document',
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1000,
    destination: './uploads',
    filename: 'test.pdf',
    path: './uploads/test.pdf',
    buffer: Buffer.from('test'),
    stream: new Readable(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: LangChainService,
          useValue: {
            generateEb2Response: jest.fn(),
            validateDocument: jest.fn(),
          },
        },
        {
          provide: DocumentProcessorService,
          useValue: {
            extractText: jest.fn(),
          },
        },
        {
          provide: VectorStoreService,
          useValue: {
            similaritySearch: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    langChainService = module.get(LangChainService);
    documentProcessor = module.get(DocumentProcessorService);
    vectorStore = module.get(VectorStoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEb2Query', () => {
    const dto: ChatEb2Dto = {
      question: 'What are the requirements for EB-2 NIW?',
      context: 'I have a PhD in Computer Science',
    };

    it('should process a query without a document', async () => {
      const mockDocuments = [
        { pageContent: 'EB-2 NIW requires substantial merit...', metadata: {} },
        { pageContent: 'National importance must be demonstrated...', metadata: {} },
      ];

      const mockResponse = {
        answer: 'The EB-2 NIW requires meeting the three-prong test...',
        confidence: 0.85,
        context: 'Retrieved context',
      };

      vectorStore.similaritySearch.mockResolvedValue(mockDocuments);
      langChainService.generateEb2Response.mockResolvedValue(mockResponse);

      const result = await service.processEb2Query(mockUser as User, dto);

      expect(result).toEqual({
        response: mockResponse.answer,
        confidence: mockResponse.confidence,
        sources: ['EB-2 Visa Knowledge Base'],
        documentValidation: undefined,
      });

      expect(vectorStore.similaritySearch).toHaveBeenCalledWith(dto.question, 5);
      expect(langChainService.generateEb2Response).toHaveBeenCalledWith(
        dto.question,
        expect.any(String),
        null,
      );
    });

    it('should process a query with a document', async () => {
      const mockDocumentContent = 'This is my resume content...';
      const mockDocuments = [
        { pageContent: 'EB-2 NIW requirements...', metadata: {} },
      ];

      const mockResponse = {
        answer: 'Based on your resume, you appear to meet the requirements...',
        confidence: 0.9,
        context: 'Retrieved context with INA 203(b)(2)',
      };

      const mockValidation = {
        issues: [],
        suggestions: ['Consider adding more publications'],
      };

      documentProcessor.extractText.mockResolvedValue(mockDocumentContent);
      vectorStore.similaritySearch.mockResolvedValue(mockDocuments);
      langChainService.generateEb2Response.mockResolvedValue(mockResponse);
      langChainService.validateDocument.mockResolvedValue(mockValidation);

      const result = await service.processEb2Query(
        mockUser as User,
        dto,
        mockFile,
      );

      expect(result).toEqual({
        response: mockResponse.answer,
        confidence: mockResponse.confidence,
        sources: ['EB-2 Visa Knowledge Base', 'INA 203(b)(2)'],
        documentValidation: {
          isValid: true,
          issues: [],
          suggestions: ['Consider adding more publications'],
        },
      });

      expect(documentProcessor.extractText).toHaveBeenCalledWith(mockFile);
      expect(langChainService.validateDocument).toHaveBeenCalledWith(
        mockDocumentContent,
      );
    });

    it('should handle errors gracefully', async () => {
      vectorStore.similaritySearch.mockRejectedValue(
        new Error('Vector store error'),
      );

      const result = await service.processEb2Query(mockUser as User, dto);

      expect(result).toEqual({
        response: expect.stringContaining('technical difficulties'),
        confidence: 0.1,
        sources: ['Fallback response'],
        documentValidation: undefined,
      });
    });

    it('should extract regulation references from context', async () => {
      const mockDocuments = [
        { pageContent: 'According to 8 CFR 204.5...', metadata: {} },
      ];

      const mockResponse = {
        answer: 'The regulations state...',
        confidence: 0.8,
        context: 'Per USCIS Form I-140 instructions and 8 CFR 204.5(k)(2)...',
      };

      vectorStore.similaritySearch.mockResolvedValue(mockDocuments);
      langChainService.generateEb2Response.mockResolvedValue(mockResponse);

      const result = await service.processEb2Query(mockUser as User, dto);

      expect(result.sources).toContain('EB-2 Visa Knowledge Base');
      expect(result.sources).toContain('8 CFR 204.5(k)(2)');
      expect(result.sources).toContain('Form I-140');
    });
  });
});