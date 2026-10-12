import { Repository, SelectQueryBuilder } from 'typeorm';
import { buildSkipTake } from '../common/pagination';
import { TimeEntry } from './time-entry.entity';
import { ListTimeEntriesQueryDto } from './dto/list-time-entries-query.dto';

/**
 * Paginated list query with project, client and tags joined, newest first.
 * `ownerId` restricts the list to one user; null lists the whole team.
 */
export function buildListQuery(
  repository: Repository<TimeEntry>,
  query: ListTimeEntriesQueryDto,
  ownerId: string | null,
): SelectQueryBuilder<TimeEntry> {
  const { skip, take } = buildSkipTake(query.page, query.limit);

  const qb = repository
    .createQueryBuilder('te')
    .leftJoinAndSelect('te.project', 'project')
    .leftJoinAndSelect('project.client', 'client')
    .leftJoinAndSelect('te.timeEntryTags', 'tet')
    .leftJoinAndSelect('tet.tag', 'tag')
    .orderBy('te.startedAt', 'DESC')
    .skip(skip)
    .take(take);

  if (ownerId) {
    qb.andWhere('te.userId = :userId', { userId: ownerId });
  }
  if (query.from) {
    qb.andWhere('te.startedAt >= :from', { from: new Date(query.from) });
  }
  if (query.to) {
    qb.andWhere('te.startedAt <= :to', { to: new Date(query.to) });
  }
  if (query.projectId) {
    qb.andWhere('te.projectId = :projectId', { projectId: query.projectId });
  }
  if (query.tagId) {
    qb.andWhere(
      'EXISTS (SELECT 1 FROM time_entry_tags tet_filter WHERE tet_filter.time_entry_id = te.id AND tet_filter.tag_id = :tagId)',
      { tagId: query.tagId },
    );
  }

  return qb;
}
