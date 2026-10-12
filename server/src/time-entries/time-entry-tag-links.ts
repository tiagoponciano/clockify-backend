import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TagsService } from '../tags/tags.service';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryTag } from './time-entry-tag.entity';

export async function assertTagsBelongToProject(
  tagsService: TagsService,
  projectId: string,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }
  const tags = await tagsService.findByIdsForProject(projectId, tagIds);
  const foundIds = new Set(tags.map((tag) => tag.id));
  const invalid = tagIds.filter((id) => !foundIds.has(id));
  if (invalid.length > 0) {
    throw new BadRequestException(`Invalid tags for project: ${invalid.join(', ')}`);
  }
}

export async function saveTagLinks(
  manager: EntityManager,
  entry: TimeEntry,
  tagIds: string[],
): Promise<void> {
  if (tagIds.length === 0 || !entry.projectId) {
    return;
  }
  const links = tagIds.map((tagId) =>
    manager.create(TimeEntryTag, {
      timeEntryId: entry.id,
      tagId,
      projectId: entry.projectId!,
    }),
  );
  await manager.save(TimeEntryTag, links);
}

export async function removeTagLinks(manager: EntityManager, timeEntryId: string): Promise<void> {
  await manager.delete(TimeEntryTag, { timeEntryId });
}
