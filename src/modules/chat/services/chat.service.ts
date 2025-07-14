import { Injectable, Logger } from '@nestjs/common';
import { ChatEb2Dto, ChatEb2ResponseDto } from '../dto/chat-eb2.dto';
import { User } from '../../auth/entities/user.entity';
import { LangChainService } from './langchain.service';
import { DocumentProcessorService } from './document-processor.service';
import { VectorStoreService } from './vector-store.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly langChainService: LangChainService,
    private readonly documentProcessor: DocumentProcessorService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async processEb2Query(
    user: User,
    dto: ChatEb2Dto,
    file?: Express.Multer.File,
  ): Promise<ChatEb2ResponseDto> {
    this.logger.log(`Processing EB-2 query for user ${user.id}`);

    let documentContent: string | null = null;
    let documentValidation: {
      isValid: boolean;
      issues: string[];
      suggestions: string[];
    } | undefined = undefined;

    try {
      // Process uploaded document if provided
      if (file) {
        this.logger.log(`Processing uploaded document: ${file.originalname}`);
        documentContent = await this.documentProcessor.extractText(file);
        
        // Validate document against EB-2 requirements
        documentValidation = await this.validateEb2Document(documentContent);
      }

      // Build context from knowledge base and user inputs
      const context = await this.buildContext(dto, documentContent);

      // Generate response using LangChain with Gemini
      const response = await this.langChainService.generateEb2Response(
        dto.question,
        context,
        documentContent,
      );

      // Extract sources from the response
      const sources = await this.extractSources(response.context);

      return {
        response: response.answer,
        confidence: response.confidence,
        sources,
        documentValidation,
      };
    } catch (error) {
      this.logger.error(`Error processing EB-2 query: ${error.message}`, error.stack);
      
      // Return a fallback response instead of throwing
      return {
        response: `I apologize, but I'm experiencing technical difficulties. However, I can tell you that EB-2 is an employment-based immigration category for professionals with advanced degrees or exceptional ability. For specific guidance, please consult with an immigration attorney.`,
        confidence: 0.1,
        sources: ['Fallback response'],
        documentValidation,
      };
    }
  }

  private async buildContext(
    dto: ChatEb2Dto,
    documentContent: string | null,
  ): Promise<string> {
    // Retrieve relevant context from vector store
    const relevantDocs = await this.vectorStore.similaritySearch(
      dto.question,
      5, // Top 5 most relevant documents
    );

    // Combine all context sources
    const contextParts = [
      ...relevantDocs.map(doc => doc.pageContent),
      dto.context || '',
      documentContent || '',
    ].filter(Boolean);

    return contextParts.join('\n\n');
  }

  private async validateEb2Document(content: string): Promise<{
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    // Use LangChain to validate document against EB-2 requirements
    const validation = await this.langChainService.validateDocument(content);

    return {
      isValid: validation.issues.length === 0,
      issues: validation.issues,
      suggestions: validation.suggestions,
    };
  }

  private async extractSources(context: string): Promise<string[]> {
    // Extract source references from the context
    const sources = new Set<string>();
    
    // Add knowledge base reference
    sources.add('EB-2 Visa Knowledge Base');
    
    // Add any specific regulation references found in the context
    const regulationPattern = /\b(INA\s+\d+(?:\([a-z0-9()]+\))?|8\s+CFR\s+[\d.]+(?:\([a-z0-9()]+\))?|Form\s+I-\d+|USCIS\s+Form\s+I-\d+)/g;
    const matches = context.match(regulationPattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up USCIS Form references to just Form
        if (match.startsWith('USCIS Form')) {
          sources.add(match.replace('USCIS ', ''));
        } else {
          sources.add(match);
        }
      });
    }

    return Array.from(sources);
  }
}