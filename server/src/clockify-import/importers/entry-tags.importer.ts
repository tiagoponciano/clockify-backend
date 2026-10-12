import { Repository } from 'typeorm';
import { Tag } from '../../tags/tag.entity';
import { TimeEntry } from '../../time-entries/time-entry.entity';
import { TimeEntryTag } from '../../time-entries/time-entry-tag.entity';
import { ClockifyDetailedEntry, ClockifyTag } from '../clockify-api.client';

export type EntryTagRepositories = {
  tagsRepository: Repository<Tag>;
  timeEntryTagsRepository: Repository<TimeEntryTag>;
};

/**
 * Replaces the entry's tag links with its Clockify tags. Clockify tags are
 * workspace-wide, so each is upserted under the entry's project with
 * `clockify_id = <tagId>:<localProjectId>`.
 */
export async function syncEntryTags(
  { tagsRepository, timeEntryTagsRepository }: EntryTagRepositories,
  entry: TimeEntry,
  remote: ClockifyDetailedEntry,
  localProjectId: string,
  tagsByClockifyId: Map<string, ClockifyTag>,
): Promise<void> {
  const tagIds = remote.tagIds ?? [];
  if (tagIds.length === 0) {
    return;
  }

  await timeEntryTagsRepository.delete({ timeEntryId: entry.id });

  for (const tagId of tagIds) {
    const remoteTag = tagsByClockifyId.get(tagId);
    if (!remoteTag) {
      continue;
    }

    const compositeClockifyId = `${tagId}:${localProjectId}`;
    let localTag = await tagsRepository.findOne({
      where: { clockifyId: compositeClockifyId },
    });
    if (!localTag) {
      localTag = await tagsRepository.findOne({
        where: { projectId: localProjectId, name: remoteTag.name },
      });
    }

    if (localTag) {
      localTag.clockifyId = compositeClockifyId;
      localTag.name = remoteTag.name;
      await tagsRepository.save(localTag);
    } else {
      localTag = await tagsRepository.save(
        tagsRepository.create({
          clockifyId: compositeClockifyId,
          projectId: localProjectId,
          name: remoteTag.name,
        }),
      );
    }

    await timeEntryTagsRepository.save(
      timeEntryTagsRepository.create({
        timeEntryId: entry.id,
        tagId: localTag.id,
        projectId: localProjectId,
      }),
    );
  }
}
