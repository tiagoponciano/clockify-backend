import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  ReportDateRangeQueryDto,
  SummaryReportQueryDto,
  SummaryReportResponseDto,
  UserReportResponseDto,
} from './dto/report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Query() query: SummaryReportQueryDto): Promise<SummaryReportResponseDto> {
    return this.reportsService.getSummary(query.from, query.to, query.groupBy, {
      projectId: query.projectId,
      clientId: query.clientId,
      userId: query.userId,
    });
  }

  @Get('user/:userId')
  getUserReport(
    @Param('userId') userId: string,
    @Query() query: ReportDateRangeQueryDto,
  ): Promise<UserReportResponseDto> {
    return this.reportsService.getUserReport(userId, query.from, query.to);
  }
}
