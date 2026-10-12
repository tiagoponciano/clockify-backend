import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum ReportGroupBy {
  PROJECT = 'project',
  USER = 'user',
  CLIENT = 'client',
  DAY = 'day',
}

export class ReportDateRangeQueryDto {
  @ApiProperty()
  @IsDateString()
  from: string;

  @ApiProperty()
  @IsDateString()
  to: string;
}

export class SummaryReportQueryDto extends ReportDateRangeQueryDto {
  @ApiProperty({ enum: ReportGroupBy })
  @IsEnum(ReportGroupBy)
  groupBy: ReportGroupBy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class SummaryReportItemDto {
  @ApiPropertyOptional()
  id?: string | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional({ description: 'Present when groupBy=day (YYYY-MM-DD in America/Sao_Paulo)' })
  day?: string;

  @ApiProperty()
  totalSeconds: number;
}

export class SummaryReportResponseDto {
  @ApiProperty({ enum: ReportGroupBy })
  groupBy: ReportGroupBy;

  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;

  @ApiProperty({ type: [SummaryReportItemDto] })
  items: SummaryReportItemDto[];
}

export class UserReportItemDto {
  @ApiPropertyOptional()
  projectId: string | null;

  @ApiPropertyOptional()
  projectName: string | null;

  @ApiProperty()
  totalSeconds: number;
}

export class UserReportResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  from: string;

  @ApiProperty()
  to: string;

  @ApiProperty()
  totalSeconds: number;

  @ApiProperty({ type: [UserReportItemDto] })
  byProject: UserReportItemDto[];
}
