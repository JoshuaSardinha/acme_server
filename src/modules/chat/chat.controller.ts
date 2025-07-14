import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChatService } from './services/chat.service';
import { ChatEb2Dto, ChatEb2ResponseDto } from './dto/chat-eb2.dto';

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('eb-2')
  @UseInterceptors(FileInterceptor('document'))
  @ApiOperation({
    summary: 'Ask questions about EB-2 visa or validate documents',
    description:
      'Submit questions about EB-2 visa requirements, process, or upload documents for validation using AI-powered analysis',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['question'],
      properties: {
        question: {
          type: 'string',
          description: 'Question about EB-2 visa process or document validation',
        },
        context: {
          type: 'string',
          description: 'Additional context for the question',
        },
        document: {
          type: 'string',
          format: 'binary',
          description: 'Optional document to validate (PDF, DOCX, TXT)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'AI-generated response with sources',
    type: ChatEb2ResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or unsupported file type',
  })
  async chatEb2(
    @Body() dto: ChatEb2Dto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ChatEb2ResponseDto> {
    try {
      if (file) {
        const allowedMimeTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          throw new BadRequestException(
            'Invalid file type. Only PDF, DOCX, and TXT files are allowed.',
          );
        }

        if (file.size > 10 * 1024 * 1024) {
          throw new BadRequestException('File size must not exceed 10MB.');
        }
      }

      // Mock user for demo (authentication disabled)
      const mockUser = { id: 'demo-user', email: 'demo@example.com', company_id: 'demo-company' };
      return await this.chatService.processEb2Query(mockUser as any, dto, file);
    } catch (error) {
      console.error('Chat controller error:', error);
      throw error;
    }
  }
}