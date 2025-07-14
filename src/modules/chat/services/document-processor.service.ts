import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);

  async extractText(file: Express.Multer.File): Promise<string> {
    this.logger.log(`Extracting text from ${file.originalname} (${file.mimetype})`);

    try {
      const buffer = await fs.readFile(file.path);

      switch (file.mimetype) {
        case 'application/pdf':
          return await this.extractPdfText(buffer);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await this.extractDocxText(buffer);
        
        case 'text/plain':
          return buffer.toString('utf-8');
        
        default:
          throw new Error(`Unsupported file type: ${file.mimetype}`);
      }
    } catch (error) {
      this.logger.error(`Error extracting text: ${error.message}`, error.stack);
      throw error;
    } finally {
      // Clean up uploaded file
      try {
        await fs.unlink(file.path);
      } catch (error) {
        this.logger.warn(`Failed to delete uploaded file: ${error.message}`);
      }
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      return data.text.trim();
    } catch (error) {
      this.logger.error(`Error parsing PDF: ${error.message}`);
      throw new Error('Failed to extract text from PDF document');
    }
  }

  private async extractDocxText(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.messages.length > 0) {
        this.logger.warn('DOCX extraction warnings:', result.messages);
      }
      
      return result.value.trim();
    } catch (error) {
      this.logger.error(`Error parsing DOCX: ${error.message}`);
      throw new Error('Failed to extract text from Word document');
    }
  }

  async preprocessText(text: string): Promise<string> {
    // Clean and normalize text for better processing
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
      .trim();
  }
}