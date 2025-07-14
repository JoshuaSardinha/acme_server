import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ChatEb2Dto {
  @ApiProperty({
    description: 'Question about EB-2 visa process or document validation',
    example: 'What are the requirements for EB-2 National Interest Waiver?',
  })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiPropertyOptional({
    description: 'Additional context for the question',
    example: 'I have a PhD in Computer Science and 5 years of experience',
  })
  @IsString()
  @IsOptional()
  context?: string;
}

export class ChatEb2ResponseDto {
  @ApiProperty({
    description: 'AI-generated response to the question',
  })
  response: string;

  @ApiProperty({
    description: 'Confidence score of the response',
    minimum: 0,
    maximum: 1,
  })
  confidence: number;

  @ApiProperty({
    description: 'Sources used to generate the response',
    type: [String],
  })
  sources: string[];

  @ApiPropertyOptional({
    description: 'Document validation results if a document was uploaded',
  })
  documentValidation?: {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  };
}