import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TimeEntry } from '../../time-entries/time-entry.entity';
import { ClockifyApiClient, ClockifyDetailedEntry, ClockifyTag } from '../clockify-api.client';
import { EntryTagRepositories, syncEntryTags } from './entry-tags.importer';
import { Counters, UpsertResult, emptyCounters } from './import-counters';

const IMPORT_FLOOR = new Date(Date.UTC(2015, 0, 1, 0, 0, 0, 0));
const WINDOW_DAYS = 31;
const PAGE_SIZE = 200;

export type TimeEntryImportContext = EntryTagRepositories & {
  timeEntriesRepository: Repository<TimeEntry>;
  userMap: Map<string, string>;
  projectMap: Map<string, string>;
  tagsByClockifyId: Map<string, ClockifyTag>;
};

/** Walks the detailed report from 2015-01-01 to now in 31-day windows, page by page. */
export async function importTimeEntries(
  api: ClockifyApiClient,
  context: TimeEntryImportContext,
  logger: Logger,
): Promise<Counters> {
  const counters = emptyCounters();
  const now = new Date();
  let windowStart = new Date(IMPORT_FLOOR);

  while (windowStart < now) {
    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + (WINDOW_DAYS - 1));
    windowEnd.setUTCHours(23, 59, 59, 999);
    if (windowEnd > now) {
      windowEnd.setTime(now.getTime());
    }

    const dateRangeStart = windowStart.toISOString();
    const dateRangeEnd = windowEnd.toISOString();
    logger.log(`Entries window ${dateRangeStart.slice(0, 10)} → ${dateRangeEnd.slice(0, 10)}`);

    let page = 1;
    while (true) {
      const entries = await api.detailedReportPage({
        dateRangeStart,
        dateRangeEnd,
        page,
        pageSize: PAGE_SIZE,
      });

      for (const entry of entries) {
        const result = await upsertEntry(entry, context);
        counters[result] += 1;
      }

      if (entries.length < PAGE_SIZE) {
        break;
      }
      page += 1;
    }

    windowStart = new Date(windowEnd);
    windowStart.setUTCDate(windowStart.getUTCDate() + 1);
    windowStart.setUTCHours(0, 0, 0, 0);
  }

  return counters;
}

async function upsertEntry(
  entry: ClockifyDetailedEntry,
  context: TimeEntryImportContext,
): Promise<UpsertResult> {
  const { timeEntriesRepository, userMap, projectMap, tagsByClockifyId } = context;
  const localUserId = userMap.get(entry.userId);
  if (!localUserId) {
    return 'skipped';
  }

  const startedAt = entry.timeInterval?.start
    ? new Date(entry.timeInterval.start)
    : null;
  const endedAt = entry.timeInterval?.end
    ? new Date(entry.timeInterval.end)
    : null;

  if (!startedAt || !endedAt || Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return 'skipped';
  }
  if (endedAt <= startedAt) {
    return 'skipped';
  }

  const localProjectId = entry.projectId
    ? projectMap.get(entry.projectId) ?? null
    : null;

  let local = await timeEntriesRepository.findOne({
    where: { clockifyId: entry._id },
  });

  if (local) {
    local.userId = localUserId;
    local.projectId = localProjectId;
    local.description = entry.description ?? '';
    local.startedAt = startedAt;
    local.endedAt = endedAt;
    await timeEntriesRepository.save(local);
    if (localProjectId) {
      await syncEntryTags(context, local, entry, localProjectId, tagsByClockifyId);
    }
    return 'updated';
  }

  local = timeEntriesRepository.create({
    clockifyId: entry._id,
    userId: localUserId,
    projectId: localProjectId,
    description: entry.description ?? '',
    startedAt,
    endedAt,
  });
  await timeEntriesRepository.save(local);
  if (localProjectId) {
    await syncEntryTags(context, local, entry, localProjectId, tagsByClockifyId);
  }
  return 'created';
}
