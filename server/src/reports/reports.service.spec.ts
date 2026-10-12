import { Repository, SelectQueryBuilder } from 'typeorm';
import { ReportsService } from './reports.service';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { User } from '../users/user.entity';
import { ReportGroupBy } from './dto/report.dto';
import { APP_TIMEZONE } from '../common/constants';

describe('ReportsService', () => {
  let service: ReportsService;
  let timeEntriesRepository: jest.Mocked<Repository<TimeEntry>>;
  let usersRepository: jest.Mocked<Repository<User>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<TimeEntry>>;

  beforeEach(() => {
    queryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<TimeEntry>>;

    timeEntriesRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as jest.Mocked<Repository<TimeEntry>>;

    usersRepository = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    service = new ReportsService(timeEntriesRepository, usersRepository);
  });

  describe('getSummary', () => {
    it('aggregates duration with TIMESTAMPDIFF and open entries use UTC_TIMESTAMP', async () => {
      queryBuilder.getRawMany.mockResolvedValue([
        { id: 'p1', name: 'Project A', totalSeconds: '3600' },
      ]);

      const result = await service.getSummary(
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T23:59:59.999Z',
        ReportGroupBy.PROJECT,
      );

      expect(timeEntriesRepository.createQueryBuilder).toHaveBeenCalledWith('te');
      expect(queryBuilder.select).toHaveBeenCalledWith(
        'SUM(TIMESTAMPDIFF(SECOND, te.started_at, COALESCE(te.ended_at, UTC_TIMESTAMP())))',
        'totalSeconds',
      );
      expect(queryBuilder.leftJoin).toHaveBeenCalledWith('te.project', 'project');
      expect(queryBuilder.groupBy).toHaveBeenCalledWith('te.project_id');
      expect(result.items).toEqual([
        { id: 'p1', name: 'Project A', totalSeconds: 3600 },
      ]);
    });

    it('groups by day using CONVERT_TZ to America/Sao_Paulo', async () => {
      queryBuilder.getRawMany.mockResolvedValue([{ day: '2026-01-15', totalSeconds: '7200' }]);

      const result = await service.getSummary(
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T23:59:59.999Z',
        ReportGroupBy.DAY,
      );

      const dayExpr = `DATE(CONVERT_TZ(te.started_at, '+00:00', '${APP_TIMEZONE}'))`;
      expect(queryBuilder.addSelect).toHaveBeenCalledWith(dayExpr, 'day');
      expect(queryBuilder.groupBy).toHaveBeenCalledWith(dayExpr);
      expect(result.items).toEqual([{ day: '2026-01-15', totalSeconds: 7200 }]);
    });

    it('returns the day as yyyy-MM-dd when the MySQL driver hands back a Date', async () => {
      // mysql2 parses DATE columns into a Date at local midnight.
      queryBuilder.getRawMany.mockResolvedValue([{ day: new Date(2026, 0, 15), totalSeconds: '7200' }]);

      const result = await service.getSummary(
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T23:59:59.999Z',
        ReportGroupBy.DAY,
      );

      expect(result.items).toEqual([{ day: '2026-01-15', totalSeconds: 7200 }]);
    });
  });
});
