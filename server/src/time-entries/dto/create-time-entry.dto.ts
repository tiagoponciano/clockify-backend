import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTimeEntryDto {
  @ApiProperty({ description: 'Project to track time against (e.g. BL008 under client Balancer)' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsDateString()
  startedAt: string;

  @ApiProperty()
  @IsDateString()
  endedAt: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];
}
