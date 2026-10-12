import { BadRequestException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntry } from './time-entry.entity';
import { Tag } from '../tags/tag.entity';
import {
  TimeEntriesServiceFixture,
  createTimeEntriesServiceFixture,
  projectId,
  userId,
} from './time-entries.service.fixture';

describe('TimeEntriesService', () => {
  let service: TimeEntriesService;
  let timeEntriesRepository: TimeEntriesServiceFixture['timeEntriesRepository'];
  let tagsService: TimeEntriesServiceFixture['tagsService'];
  let dataSource: TimeEntriesServiceFixture['dataSource'];
  let transactionManager: TimeEntriesServiceFixture['transactionManager'];

  beforeEach(() => {
    ({ service, timeEntriesRepository, tagsService, dataSource, transactionManager } =
      createTimeEntriesServiceFixture());
  });

  describe('rule 1: start closes previous open entry', () => {
    it('closes the open entry and creates a new one in the same transaction', async () => {
      const openEntry = {
        id: 'open-1',
        userId,
        endedAt: null,
      } as TimeEntry;
      const newEntry = {
        id: 'new-1',
        userId,
        projectId,
        description: '',
        startedAt: expect.any(Date),
        endedAt: null,
      } as TimeEntry;

      transactionManager.findOne.mockResolvedValueOnce(openEntry);
      transactionManager.save.mockImplementation(async (_entity, value) => value as TimeEntry);
      // EntityManager.create is overloaded; the mock only needs the single-object form.
      (transactionManager.create as jest.Mock).mockImplementation(
        (_entity: unknown, data: Partial<TimeEntry>) => ({ id: 'new-1', ...data }),
      );
      timeEntriesRepository.findOne.mockResolvedValue({
        ...newEntry,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntryTags: [],
        project: null,
      } as unknown as TimeEntry);

      await service.start(userId, { projectId });

      expect(transactionManager.findOne).toHaveBeenCalledWith(TimeEntry, {
        where: { userId, endedAt: IsNull() },
      });
      expect(openEntry.endedAt).toBeInstanceOf(Date);
      expect(transactionManager.save).toHaveBeenCalledWith(TimeEntry, openEntry);
      expect(transactionManager.create).toHaveBeenCalledWith(
        TimeEntry,
        expect.objectContaining({ userId, projectId, endedAt: null }),
      );
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('rule 3: tags must belong to the entry project', () => {
    it('throws BadRequestException listing invalid tag ids', async () => {
      tagsService.findByIdsForProject.mockResolvedValue([
        { id: 'tag-1', projectId } as Tag,
      ]);

      await expect(
        service.createManual(userId, {
          projectId,
          startedAt: new Date().toISOString(),
          endedAt: new Date(Date.now() + 3600000).toISOString(),
          tagIds: ['tag-1', 'tag-invalid'],
        }),
      ).rejects.toThrow(new BadRequestException('Invalid tags for project: tag-invalid'));
    });

    it('throws when projectId is missing on manual create', async () => {
      await expect(
        service.createManual(userId, {
          projectId: '',
          startedAt: new Date().toISOString(),
          endedAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      ).rejects.toThrow(new BadRequestException('projectId is required'));
    });
  });

  describe('rule 6: retroactive window', () => {
    it('rejects startedAt older than 10 days', async () => {
      const oldStart = new Date();
      oldStart.setDate(oldStart.getDate() - 11);

      await expect(
        service.createManual(userId, {
          projectId,
          startedAt: oldStart.toISOString(),
          endedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects startedAt in the future', async () => {
      const futureStart = new Date(Date.now() + 3600000);

      await expect(
        service.createManual(userId, {
          projectId,
          startedAt: futureStart.toISOString(),
          endedAt: new Date(futureStart.getTime() + 3600000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rule 7: max 24h manual duration', () => {
    it('rejects manual entries longer than 24 hours', async () => {
      const startedAt = new Date();
      startedAt.setDate(startedAt.getDate() - 1);
      const endedAt = new Date(startedAt.getTime() + 25 * 60 * 60 * 1000);

      await expect(
        service.createManual(userId, {
          projectId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
        }),
      ).rejects.toThrow(
        new BadRequestException('Manual time entries cannot exceed 24 hours'),
      );
    });
  });
});
