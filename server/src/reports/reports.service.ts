import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { User } from '../users/user.entity';
import {
  ReportGroupBy,
  SummaryReportItemDto,
  SummaryReportResponseDto,
  UserReportResponseDto,
} from './dto/report.dto';
import { APP_TIMEZONE } from '../common/constants';

const DURATION_EXPR =
  'TIMESTAMPDIFF(SECOND, te.started_at, COALESCE(te.ended_at, UTC_TIMESTAMP()))';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntriesRepository: Repository<TimeEntry>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getSummary(
    from: string,
    to: string,
    groupBy: ReportGroupBy,
    filters: { projectId?: string; clientId?: string; userId?: string } = {},
  ): Promise<SummaryReportResponseDto> {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const qb = this.timeEntriesRepository
      .createQueryBuilder('te')
      .select(`SUM(${DURATION_EXPR})`, 'totalSeconds')
      .where('te.started_at >= :from', { from: fromDate })
      .andWhere('te.started_at <= :to', { to: toDate });

    if (filters.userId) {
      qb.andWhere('te.user_id = :userId', { userId: filters.userId });
    }
    if (filters.projectId) {
      qb.andWhere('te.project_id = :projectId', { projectId: filters.projectId });
    }
    if (filters.clientId) {
      qb.leftJoin('te.project', 'filterProject');
      qb.andWhere('filterProject.client_id = :clientId', { clientId: filters.clientId });
    }

    let items: SummaryReportItemDto[];

    switch (groupBy) {
      case ReportGroupBy.PROJECT:
        items = await this.aggregateByProject(qb);
        break;
      case ReportGroupBy.USER:
        items = await this.aggregateByUser(qb);
        break;
      case ReportGroupBy.CLIENT:
        items = await this.aggregateByClient(qb);
        break;
      case ReportGroupBy.DAY:
        items = await this.aggregateByDay(qb);
        break;
      default:
        items = [];
    }

    return {
      groupBy,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      items,
    };
  }

  private mapRawRows(
    rows: Array<Record<string, string | number | null>>,
    idKey: string,
    nameKey: string,
  ): SummaryReportItemDto[] {
    return rows.map((row) => ({
      id: row[idKey] != null ? String(row[idKey]) : null,
      name: row[nameKey] != null ? String(row[nameKey]) : null,
      totalSeconds: Number(row.totalSeconds ?? 0),
    }));
  }

  private async aggregateByProject(
    qb: ReturnType<Repository<TimeEntry>['createQueryBuilder']>,
  ): Promise<SummaryReportItemDto[]> {
    const rows = await qb
      .addSelect('te.project_id', 'id')
      .addSelect('project.name', 'name')
      .leftJoin('te.project', 'project')
      .groupBy('te.project_id')
      .addGroupBy('project.name')
      .getRawMany();

    return this.mapRawRows(rows, 'id', 'name');
  }

  private async aggregateByUser(
    qb: ReturnType<Repository<TimeEntry>['createQueryBuilder']>,
  ): Promise<SummaryReportItemDto[]> {
    const rows = await qb
      .addSelect('te.user_id', 'id')
      .addSelect('user.name', 'name')
      .innerJoin('te.user', 'user')
      .groupBy('te.user_id')
      .addGroupBy('user.name')
      .getRawMany();

    return this.mapRawRows(rows, 'id', 'name');
  }

  private async aggregateByClient(
    qb: ReturnType<Repository<TimeEntry>['createQueryBuilder']>,
  ): Promise<SummaryReportItemDto[]> {
    const rows = await qb
      .addSelect('client.id', 'id')
      .addSelect('client.name', 'name')
      .leftJoin('te.project', 'project')
      .leftJoin('project.client', 'client')
      .groupBy('client.id')
      .addGroupBy('client.name')
      .getRawMany();

    return this.mapRawRows(rows, 'id', 'name');
  }

  private async aggregateByDay(
    qb: ReturnType<Repository<TimeEntry>['createQueryBuilder']>,
  ): Promise<SummaryReportItemDto[]> {
    const dayExpr = `DATE(CONVERT_TZ(te.started_at, '+00:00', '${APP_TIMEZONE}'))`;

    const rows = await qb
      .addSelect(dayExpr, 'day')
      .groupBy(dayExpr)
      .orderBy(dayExpr, 'ASC')
      .getRawMany();

    return rows.map((row) => ({
      day: row.day != null ? String(row.day) : undefined,
      totalSeconds: Number(row.totalSeconds ?? 0),
    }));
  }

  async getUserReport(
    userId: string,
    from: string,
    to: string,
  ): Promise<UserReportResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const rows = await this.timeEntriesRepository
      .createQueryBuilder('te')
      .select('te.project_id', 'projectId')
      .addSelect('project.name', 'projectName')
      .addSelect(`SUM(${DURATION_EXPR})`, 'totalSeconds')
      .leftJoin('te.project', 'project')
      .where('te.user_id = :userId', { userId })
      .andWhere('te.started_at >= :from', { from: fromDate })
      .andWhere('te.started_at <= :to', { to: toDate })
      .groupBy('te.project_id')
      .addGroupBy('project.name')
      .getRawMany();

    const byProject = rows.map((row) => ({
      projectId: row.projectId != null ? String(row.projectId) : null,
      projectName: row.projectName != null ? String(row.projectName) : null,
      totalSeconds: Number(row.totalSeconds ?? 0),
    }));

    const totalSeconds = byProject.reduce((sum, item) => sum + item.totalSeconds, 0);

    return {
      userId,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      totalSeconds,
      byProject,
    };
  }
}
