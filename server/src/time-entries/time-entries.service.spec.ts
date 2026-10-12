import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryTag } from './time-entry-tag.entity';
import { ProjectsService } from '../projects/projects.service';
import { TagsService } from '../tags/tags.service';
import { Tag } from '../tags/tag.entity';

describe('TimeEntriesService', () => {
  let service: TimeEntriesService;
  let timeEntriesRepository: jest.Mocked<Repository<TimeEntry>>;
  let projectsService: jest.Mocked<ProjectsService>;
  let tagsService: jest.Mocked<TagsService>;
  let dataSource: jest.Mocked<DataSource>;
  let transactionManager: jest.Mocked<EntityManager>;

  const userId = 'user-1';
  const projectId = 'project-1';
  const otherProjectId = 'project-2';

  beforeEach(() => {
    timeEntriesRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<TimeEntry>>;

    projectsService = {
      assertProjectNotArchived: jest.fn(),
    } as unknown as jest.Mocked<ProjectsService>;

    tagsService = {
      findByIdsForProject: jest.fn(),
    } as unknown as jest.Mocked<TagsService>;

    transactionManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<EntityManager>;

    dataSource = {
      transaction: jest.fn(async (cb: (manager: EntityManager) => Promise<unknown>) =>
        cb(transactionManager),
      ),
    } as unknown as jest.Mocked<DataSource>;

    service = new TimeEntriesService(
      timeEntriesRepository,
      {} as Repository<TimeEntryTag>,
      projectsService,
      tagsService,
      dataSource,
    );
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
      transactionManager.create.mockImplementation((_entity, data) => ({ id: 'new-1', ...data }));
      timeEntriesRepository.findOne.mockResolvedValue({
        ...newEntry,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        timeEntryTags: [],
        project: null,
      } as TimeEntry);

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

  describe('rule 4: changing project removes old tag links', () => {
    it('removes existing tags and saves new ones from the new project', async () => {
      const entry = {
        id: 'entry-1',
        userId,
        projectId,
        startedAt: new Date(),
        endedAt: new Date(Date.now() + 3600000),
        description: '',
        timeEntryTags: [{ tagId: 'old-tag', projectId }],
      } as TimeEntry;

      timeEntriesRepository.findOne
        .mockResolvedValueOnce(entry)
        .mockResolvedValueOnce({
          ...entry,
          projectId: otherProjectId,
          timeEntryTags: [{ tagId: 'new-tag', tag: { id: 'new-tag', projectId: otherProjectId } }],
          project: null,
        } as TimeEntry);

      tagsService.findByIdsForProject.mockResolvedValue([
        { id: 'new-tag', projectId: otherProjectId } as Tag,
      ]);

      transactionManager.save.mockResolvedValue(entry);

      await service.update(entry.id, userId, {
        projectId: otherProjectId,
        tagIds: ['new-tag'],
      });

      expect(transactionManager.delete).toHaveBeenCalledWith(TimeEntryTag, {
        timeEntryId: entry.id,
      });
      expect(transactionManager.create).toHaveBeenCalledWith(
        TimeEntryTag,
        expect.objectContaining({
          timeEntryId: entry.id,
          tagId: 'new-tag',
          projectId: otherProjectId,
        }),
      );
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

  describe('ownership', () => {
    it('throws ForbiddenException when updating another users entry', async () => {
      timeEntriesRepository.findOne.mockResolvedValue({
        id: 'entry-1',
        userId: 'other-user',
      } as TimeEntry);

      await expect(service.update('entry-1', userId, { description: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
