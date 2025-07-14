import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { Document } from 'langchain/document';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private vectorStore: FaissStore;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private readonly vectorStorePath = './vector-store/eb2-knowledge';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    
    if (apiKey) {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: 'embedding-001',
      });
    } else {
      this.logger.warn('GOOGLE_GEMINI_API_KEY is not configured - Vector store functionality will be limited');
    }
  }

  async onModuleInit() {
    await this.initializeVectorStore();
  }

  private async initializeVectorStore() {
    if (!this.embeddings) {
      this.logger.warn('Skipping vector store initialization - embeddings not configured');
      return;
    }
    
    try {
      // Check if vector store already exists
      const vectorStoreExists = await this.checkVectorStoreExists();
      
      if (vectorStoreExists) {
        this.logger.log('Loading existing vector store...');
        this.vectorStore = await FaissStore.load(
          this.vectorStorePath,
          this.embeddings,
        );
      } else {
        this.logger.log('Creating new vector store from knowledge base...');
        await this.createVectorStore();
      }
    } catch (error) {
      this.logger.error(`Error initializing vector store: ${error.message}`, error.stack);
      // Create an empty vector store as fallback
      try {
        this.vectorStore = await FaissStore.fromDocuments([], this.embeddings);
      } catch (fallbackError) {
        this.logger.error('Failed to create fallback vector store', fallbackError.stack);
      }
    }
  }

  private async checkVectorStoreExists(): Promise<boolean> {
    try {
      await fs.access(`${this.vectorStorePath}.faiss`);
      return true;
    } catch {
      return false;
    }
  }

  private async createVectorStore() {
    // Use process.cwd() to get the project root, then navigate to src folder
    const knowledgeBasePath = path.join(
      process.cwd(),
      'src/modules/chat/knowledge-base/eb2-visa-knowledge.md',
    );

    try {
      this.logger.log(`Loading knowledge base from: ${knowledgeBasePath}`);
      
      // Check if file exists before trying to load
      try {
        await fs.access(knowledgeBasePath);
      } catch (error) {
        this.logger.error(`Knowledge base file not found at: ${knowledgeBasePath}`);
        throw new Error(`Knowledge base file not found: ${knowledgeBasePath}`);
      }
      
      // Load the knowledge base document
      const loader = new TextLoader(knowledgeBasePath);
      const docs = await loader.load();

      // Split the document into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ['\n## ', '\n### ', '\n\n', '\n', ' ', ''],
      });

      const splitDocs = await textSplitter.splitDocuments(docs);

      // Add metadata to each chunk
      const docsWithMetadata = splitDocs.map((doc, index) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            source: 'EB-2 Visa Knowledge Base',
            chunk: index,
            ...doc.metadata,
          },
        });
      });

      // Create vector store from documents
      this.vectorStore = await FaissStore.fromDocuments(
        docsWithMetadata,
        this.embeddings,
      );

      // Save the vector store
      await this.saveVectorStore();
      
      this.logger.log(`Vector store created with ${docsWithMetadata.length} documents`);
    } catch (error) {
      this.logger.error(`Error creating vector store: ${error.message}`, error.stack);
      throw error;
    }
  }

  async similaritySearch(query: string, k: number = 5): Promise<Document[]> {
    if (!this.vectorStore) {
      this.logger.warn('Vector store not initialized - returning empty results');
      return [];
    }
    
    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      
      this.logger.debug(
        `Found ${results.length} similar documents for query: "${query.substring(0, 50)}..."`,
      );
      
      return results;
    } catch (error) {
      this.logger.error(`Error performing similarity search: ${error.message}`, error.stack);
      return [];
    }
  }

  async addDocument(content: string, metadata: Record<string, any> = {}) {
    try {
      const document = new Document({
        pageContent: content,
        metadata: {
          source: 'User Upload',
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });

      await this.vectorStore.addDocuments([document]);
      await this.saveVectorStore();
      
      this.logger.log('Document added to vector store');
    } catch (error) {
      this.logger.error(`Error adding document to vector store: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async saveVectorStore() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.vectorStorePath);
      await fs.mkdir(dir, { recursive: true });
      
      await this.vectorStore.save(this.vectorStorePath);
      this.logger.debug('Vector store saved successfully');
    } catch (error) {
      this.logger.error(`Error saving vector store: ${error.message}`, error.stack);
    }
  }

  async updateKnowledgeBase() {
    this.logger.log('Updating knowledge base vector store...');
    await this.createVectorStore();
  }
}