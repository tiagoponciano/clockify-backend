import { ForbiddenException } from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryTag } from './time-entry-tag.entity';
import { Tag } from '../tags/tag.entity';
import {
  TimeEntriesServiceFixture,
  createTimeEntriesServiceFixture,
  otherProjectId,
  projectId,
  userId,
} from './time-entries.service.fixture';

describe('TimeEntriesService.update', () => {
  let service: TimeEntriesService;
  let timeEntriesRepository: TimeEntriesServiceFixture['timeEntriesRepository'];
  let tagsService: TimeEntriesServiceFixture['tagsService'];
  let transactionManager: TimeEntriesServiceFixture['transactionManager'];

  beforeEach(() => {
    ({ service, timeEntriesRepository, tagsService, transactionManager } =
      createTimeEntriesServiceFixture());
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
