import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { TagsService } from '../tags/tags.service';
import { TimeEntry } from './time-entry.entity';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import {
  UpdateTarget,
  applyUpdate,
  assertEndedAfterStarted,
  assertMaxManualDuration,
  assertProjectRequired,
  assertRetroactiveWindow,
  resolveUpdateTarget,
} from './time-entry.rules';
import { assertTagsBelongToProject, removeTagLinks, saveTagLinks } from './time-entry-tag-links';

export type PreparedUpdate = {
  target: UpdateTarget;
  /** Tags the entry ends up with; undefined keeps the current links. */
  tagIds: string[] | undefined;
};

/**
 * Checks that `dto` can be applied to `entry`: project required and not archived,
 * dates valid, and every tag (new or kept) belonging to the target project.
 */
export async function prepareUpdate(
  entry: TimeEntry,
  dto: UpdateTimeEntryDto,
  projectsService: ProjectsService,
  tagsService: TagsService,
): Promise<PreparedUpdate> {
  if (dto.projectId === null) {
    throw new BadRequestException('projectId is required');
  }

  const target = resolveUpdateTarget(entry, dto);
  const projectId = target.projectId;
  assertProjectRequired(projectId);

  if (dto.startedAt !== undefined) {
    assertRetroactiveWindow(target.startedAt);
  }

  await projectsService.assertProjectNotArchived(projectId);

  assertEndedAfterStarted(target.startedAt, target.endedAt);
  assertMaxManualDuration(target.startedAt, target.endedAt);

  let tagIds: string[] | undefined = dto.tagIds;
  if (target.projectChanging) {
    tagIds = dto.tagIds ?? [];
  }

  if (tagIds !== undefined) {
    await assertTagsBelongToProject(tagsService, projectId, tagIds);
  } else if (!target.projectChanging && entry.timeEntryTags?.length) {
    const existingTagIds = entry.timeEntryTags.map((link) => link.tagId);
    await assertTagsBelongToProject(tagsService, projectId, existingTagIds);
  }

  return { target, tagIds };
}

/** Saves the updated entry; a project change replaces all tag links. */
export async function persistUpdate(
  manager: EntityManager,
  entry: TimeEntry,
  dto: UpdateTimeEntryDto,
  { target, tagIds }: PreparedUpdate,
): Promise<void> {
  applyUpdate(entry, dto, target);
  await manager.save(TimeEntry, entry);

  if (target.projectChanging) {
    await removeTagLinks(manager, entry.id);
    if (tagIds && tagIds.length > 0) {
      await saveTagLinks(manager, entry, tagIds);
    }
  } else if (dto.tagIds !== undefined) {
    await removeTagLinks(manager, entry.id);
    await saveTagLinks(manager, entry, dto.tagIds);
  }
}
