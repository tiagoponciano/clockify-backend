import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Project } from '../projects/project.entity';
import { Tag } from '../tags/tag.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { TimeEntryTag } from '../time-entries/time-entry-tag.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../types';
import {
  ClockifyApiClient,
  ClockifyDetailedEntry,
  ClockifyTag,
} from './clockify-api.client';

const NO_CLIENT_CLOCKIFY_ID = '__no_client__';
const IMPORT_FLOOR = new Date(Date.UTC(2015, 0, 1, 0, 0, 0, 0));
const WINDOW_DAYS = 31;
const PAGE_SIZE = 200;

type Counters = {
  created: number;
  updated: number;
  skipped: number;
};

@Injectable()
export class ClockifyImportService {
  private readonly logger = new Logger(ClockifyImportService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    @InjectRepository(TimeEntry)
    private readonly timeEntriesRepository: Repository<TimeEntry>,
    @InjectRepository(TimeEntryTag)
    private readonly timeEntryTagsRepository: Repository<TimeEntryTag>,
  ) {}

  async run(): Promise<void> {
    const apiKey = this.configService.get<string>('clockify.apiKey') ?? '';
    const workspaceId = this.configService.get<string>('clockify.workspaceId') ?? '';
    const allowedDomain = (
      this.configService.get<string>('allowedEmailDomain') ?? 'certi.org.br'
    ).toLowerCase();

    if (!apiKey || !workspaceId) {
      throw new Error(
        'CLOCKIFY_API_KEY and CLOCKIFY_WORKSPACE_ID must be set in the environment',
      );
    }

    const client = new ClockifyApiClient(apiKey, workspaceId);

    this.logger.log('Importing users…');
    const userMap = await this.importUsers(client, allowedDomain);

    this.logger.log('Importing clients…');
    const clientMap = await this.importClients(client);

    this.logger.log('Importing projects…');
    const projectMap = await this.importProjects(client, clientMap);

    this.logger.log('Loading workspace tags…');
    const clockifyTags = await client.listTags();
    const tagsByClockifyId = new Map(clockifyTags.map((tag) => [tag.id, tag]));

    this.logger.log('Importing time entries (from 2015-01-01, 31-day windows)…');
    const entryCounters = await this.importTimeEntries(
      client,
      userMap,
      projectMap,
      tagsByClockifyId,
    );

    this.logger.log(
      `Done. Users mapped=${userMap.size}; clients=${clientMap.size}; projects=${projectMap.size}; ` +
        `entries created=${entryCounters.created} updated=${entryCounters.updated} skipped=${entryCounters.skipped}`,
    );
  }

  private async importUsers(
    api: ClockifyApiClient,
    allowedDomain: string,
  ): Promise<Map<string, string>> {
    const counters: Counters = { created: 0, updated: 0, skipped: 0 };
    const map = new Map<string, string>();
    const users = await api.listUsers();

    for (const remote of users) {
      const email = (remote.email ?? '').trim().toLowerCase();
      if (!email.endsWith(`@${allowedDomain}`)) {
        this.logger.warn(`Skipping user without @${allowedDomain} email: ${remote.name} <${email || 'none'}>`);
        counters.skipped += 1;
        continue;
      }

      const acronym = email.split('@')[0];
      const displayName = (remote.name ?? '').trim() || acronym;
      const avatarUrl = remote.profilePicture?.trim() ? remote.profilePicture : null;
      const isActive = (remote.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
      let local = await this.usersRepository.findOne({
        where: { clockifyId: remote.id },
      });

      if (!local) {
        local = await this.usersRepository.findOne({ where: { email } });
      }

      if (local) {
        local.clockifyId = remote.id;
        local.email = email;
        local.acronym = acronym;
        local.name = displayName;
        local.isActive = isActive;
        if (avatarUrl) {
          local.avatarUrl = avatarUrl;
        }
        if (!local.googleSub) {
          local.googleSub = `clockify:${remote.id}`;
        }
        await this.usersRepository.save(local);
        counters.updated += 1;
      } else {
        local = this.usersRepository.create({
          clockifyId: remote.id,
          googleSub: `clockify:${remote.id}`,
          email,
          acronym,
          name: displayName,
          avatarUrl,
          role: UserRole.MEMBER,
          isActive,
        });
        await this.usersRepository.save(local);
        counters.created += 1;
      }

      map.set(remote.id, local.id);
    }

    this.logger.log(
      `Users created=${counters.created} updated=${counters.updated} skipped=${counters.skipped}`,
    );
    return map;
  }

  private async importClients(
    api: ClockifyApiClient,
  ): Promise<Map<string, string>> {
    const counters: Counters = { created: 0, updated: 0, skipped: 0 };
    const map = new Map<string, string>();
    const remotes = await api.listClients();

    for (const remote of remotes) {
      let local = await this.clientsRepository.findOne({
        where: { clockifyId: remote.id },
      });
      if (!local) {
        local = await this.clientsRepository.findOne({
          where: { name: remote.name },
        });
      }

      if (local) {
        local.clockifyId = remote.id;
        local.name = remote.name;
        local.isActive = !(remote.archived ?? false);
        await this.clientsRepository.save(local);
        counters.updated += 1;
      } else {
        local = this.clientsRepository.create({
          clockifyId: remote.id,
          name: remote.name,
          color: '#4A90D9',
          isActive: !(remote.archived ?? false),
        });
        await this.clientsRepository.save(local);
        counters.created += 1;
      }

      map.set(remote.id, local.id);
    }

    const noClient = await this.ensureNoClient();
    map.set(NO_CLIENT_CLOCKIFY_ID, noClient.id);

    this.logger.log(
      `Clients created=${counters.created} updated=${counters.updated}`,
    );
    return map;
  }

  private async ensureNoClient(): Promise<Client> {
    let local = await this.clientsRepository.findOne({
      where: { clockifyId: NO_CLIENT_CLOCKIFY_ID },
    });
    if (local) {
      return local;
    }
    local = await this.clientsRepository.findOne({ where: { name: 'No Client' } });
    if (local) {
      local.clockifyId = NO_CLIENT_CLOCKIFY_ID;
      return this.clientsRepository.save(local);
    }
    return this.clientsRepository.save(
      this.clientsRepository.create({
        clockifyId: NO_CLIENT_CLOCKIFY_ID,
        name: 'No Client',
        color: '#9CA3AF',
        isActive: true,
      }),
    );
  }

  private async importProjects(
    api: ClockifyApiClient,
    clientMap: Map<string, string>,
  ): Promise<Map<string, string>> {
    const counters: Counters = { created: 0, updated: 0, skipped: 0 };
    const map = new Map<string, string>();
    const remotes = await api.listProjects();
    const fallbackClientId = clientMap.get(NO_CLIENT_CLOCKIFY_ID)!;

    for (const remote of remotes) {
      const localClientId =
        (remote.clientId && clientMap.get(remote.clientId)) || fallbackClientId;

      let local = await this.projectsRepository.findOne({
        where: { clockifyId: remote.id },
      });
      if (!local) {
        local = await this.projectsRepository.findOne({
          where: { clientId: localClientId, name: remote.name },
        });
      }

      if (local) {
        local.clockifyId = remote.id;
        local.clientId = localClientId;
        local.name = remote.name;
        local.isArchived = remote.archived ?? false;
        await this.projectsRepository.save(local);
        counters.updated += 1;
      } else {
        local = this.projectsRepository.create({
          clockifyId: remote.id,
          clientId: localClientId,
          name: remote.name,
          isArchived: remote.archived ?? false,
        });
        await this.projectsRepository.save(local);
        counters.created += 1;
      }

      map.set(remote.id, local.id);
    }

    this.logger.log(
      `Projects created=${counters.created} updated=${counters.updated}`,
    );
    return map;
  }

  private async importTimeEntries(
    api: ClockifyApiClient,
    userMap: Map<string, string>,
    projectMap: Map<string, string>,
    tagsByClockifyId: Map<string, ClockifyTag>,
  ): Promise<Counters> {
    const counters: Counters = { created: 0, updated: 0, skipped: 0 };
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
      this.logger.log(`Entries window ${dateRangeStart.slice(0, 10)} → ${dateRangeEnd.slice(0, 10)}`);

      let page = 1;
      while (true) {
        const entries = await api.detailedReportPage({
          dateRangeStart,
          dateRangeEnd,
          page,
          pageSize: PAGE_SIZE,
        });

        for (const entry of entries) {
          const result = await this.upsertEntry(
            entry,
            userMap,
            projectMap,
            tagsByClockifyId,
          );
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

  private async upsertEntry(
    entry: ClockifyDetailedEntry,
    userMap: Map<string, string>,
    projectMap: Map<string, string>,
    tagsByClockifyId: Map<string, ClockifyTag>,
  ): Promise<'created' | 'updated' | 'skipped'> {
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

    let local = await this.timeEntriesRepository.findOne({
      where: { clockifyId: entry._id },
    });

    if (local) {
      local.userId = localUserId;
      local.projectId = localProjectId;
      local.description = entry.description ?? '';
      local.startedAt = startedAt;
      local.endedAt = endedAt;
      await this.timeEntriesRepository.save(local);
      if (localProjectId) {
        await this.syncEntryTags(local, entry, localProjectId, tagsByClockifyId);
      }
      return 'updated';
    }

    local = this.timeEntriesRepository.create({
      clockifyId: entry._id,
      userId: localUserId,
      projectId: localProjectId,
      description: entry.description ?? '',
      startedAt,
      endedAt,
    });
    await this.timeEntriesRepository.save(local);
    if (localProjectId) {
      await this.syncEntryTags(local, entry, localProjectId, tagsByClockifyId);
    }
    return 'created';
  }

  private async syncEntryTags(
    entry: TimeEntry,
    remote: ClockifyDetailedEntry,
    localProjectId: string,
    tagsByClockifyId: Map<string, ClockifyTag>,
  ): Promise<void> {
    const tagIds = remote.tagIds ?? [];
    if (tagIds.length === 0) {
      return;
    }

    await this.timeEntryTagsRepository.delete({ timeEntryId: entry.id });

    for (const tagId of tagIds) {
      const remoteTag = tagsByClockifyId.get(tagId);
      if (!remoteTag) {
        continue;
      }

      const compositeClockifyId = `${tagId}:${localProjectId}`;
      let localTag = await this.tagsRepository.findOne({
        where: { clockifyId: compositeClockifyId },
      });
      if (!localTag) {
        localTag = await this.tagsRepository.findOne({
          where: { projectId: localProjectId, name: remoteTag.name },
        });
      }

      if (localTag) {
        localTag.clockifyId = compositeClockifyId;
        localTag.name = remoteTag.name;
        await this.tagsRepository.save(localTag);
      } else {
        localTag = await this.tagsRepository.save(
          this.tagsRepository.create({
            clockifyId: compositeClockifyId,
            projectId: localProjectId,
            name: remoteTag.name,
          }),
        );
      }

      await this.timeEntryTagsRepository.save(
        this.timeEntryTagsRepository.create({
          timeEntryId: entry.id,
          tagId: localTag.id,
          projectId: localProjectId,
        }),
      );
    }
  }
}
