import { Injectable, Logger } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ConfigService } from '@nestjs/config';

interface Eb2Response {
  answer: string;
  confidence: number;
  context: string;
}

interface DocumentValidation {
  issues: string[];
  suggestions: string[];
}

@Injectable()
export class LangChainService {
  private readonly logger = new Logger(LangChainService.name);
  private readonly model: ChatGoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_GEMINI_API_KEY');
    
    if (apiKey) {
      this.model = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash-exp',
        apiKey,
        temperature: 0.3,
        maxOutputTokens: 2048,
      });
    } else {
      this.logger.warn('GOOGLE_GEMINI_API_KEY is not configured - LangChain functionality will be limited');
    }
  }

  async generateEb2Response(
    question: string,
    context: string,
    documentContent: string | null,
  ): Promise<Eb2Response> {
    if (!this.model) {
      return {
        answer: 'AI service is not configured. Please contact support.',
        confidence: 0,
        context: '',
      };
    }
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert immigration attorney specializing in EB-2 visa applications, particularly the National Interest Waiver (NIW) category. 
You have extensive knowledge of USCIS regulations, requirements, and best practices.

Context from EB-2 knowledge base:
{context}

{documentContext}

User Question: {question}

Instructions:
1. Provide a comprehensive and accurate answer based on the context provided
2. Reference specific regulations or requirements when applicable
3. If the question involves document review, analyze it against EB-2 requirements
4. Be specific and actionable in your recommendations
5. If you're not certain about something, indicate that clearly
6. Format your response in a clear, professional manner

Response:
    `);

    const chain = RunnableSequence.from([
      promptTemplate,
      this.model,
      new StringOutputParser(),
    ]);

    try {
      const documentContext = documentContent
        ? `Uploaded Document Content:\n${documentContent}\n`
        : '';

      const response = await chain.invoke({
        question,
        context,
        documentContext,
      });

      // Calculate confidence based on context relevance
      const confidence = this.calculateConfidence(context, question);

      return {
        answer: response,
        confidence,
        context,
      };
    } catch (error) {
      this.logger.error(`Error generating EB-2 response: ${error.message}`, error.stack);
      throw error;
    }
  }

  async validateDocument(content: string): Promise<DocumentValidation> {
    if (!this.model) {
      return {
        issues: ['AI service is not configured'],
        suggestions: ['Please contact support for document validation'],
      };
    }
    const validationPrompt = PromptTemplate.fromTemplate(`
You are an expert immigration attorney reviewing a document for EB-2 visa application compliance.

Document Content:
{content}

Task: Analyze this document against EB-2 visa requirements and provide:
1. A list of specific issues or missing elements (if any)
2. Actionable suggestions for improvement

Format your response as JSON with the following structure:
{{
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}}

Response:
    `);

    const chain = RunnableSequence.from([
      validationPrompt,
      this.model,
      new StringOutputParser(),
    ]);

    try {
      const response = await chain.invoke({ content });
      
      // Parse JSON response
      const validation = JSON.parse(response);
      
      return {
        issues: validation.issues || [],
        suggestions: validation.suggestions || [],
      };
    } catch (error) {
      this.logger.error(`Error validating document: ${error.message}`, error.stack);
      
      // Return a safe default if parsing fails
      return {
        issues: ['Unable to validate document'],
        suggestions: ['Please ensure document is properly formatted'],
      };
    }
  }

  private calculateConfidence(context: string, question: string): number {
    // Simple confidence calculation based on context relevance
    const questionWords = question.toLowerCase().split(/\s+/);
    const contextLower = context.toLowerCase();
    
    let matchCount = 0;
    for (const word of questionWords) {
      if (word.length > 3 && contextLower.includes(word)) {
        matchCount++;
      }
    }

    const relevanceScore = matchCount / questionWords.length;
    
    // Base confidence of 0.7 + up to 0.3 based on relevance
    return Math.min(0.7 + (relevanceScore * 0.3), 1.0);
  }
}