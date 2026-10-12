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
import { ClockifyApiClient } from './clockify-api.client';
import { importClients } from './importers/clients.importer';
import { importProjects } from './importers/projects.importer';
import { importTimeEntries } from './importers/time-entries.importer';
import { importUsers } from './importers/users.importer';

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
    const userMap = await importUsers(client, this.usersRepository, allowedDomain, this.logger);

    this.logger.log('Importing clients…');
    const clientMap = await importClients(client, this.clientsRepository, this.logger);

    this.logger.log('Importing projects…');
    const projectMap = await importProjects(
      client,
      this.projectsRepository,
      clientMap,
      this.logger,
    );

    this.logger.log('Loading workspace tags…');
    const clockifyTags = await client.listTags();
    const tagsByClockifyId = new Map(clockifyTags.map((tag) => [tag.id, tag]));

    this.logger.log('Importing time entries (from 2015-01-01, 31-day windows)…');
    const entryCounters = await importTimeEntries(
      client,
      {
        timeEntriesRepository: this.timeEntriesRepository,
        tagsRepository: this.tagsRepository,
        timeEntryTagsRepository: this.timeEntryTagsRepository,
        userMap,
        projectMap,
        tagsByClockifyId,
      },
      this.logger,
    );

    this.logger.log(
      `Done. Users mapped=${userMap.size}; clients=${clientMap.size}; projects=${projectMap.size}; ` +
        `entries created=${entryCounters.created} updated=${entryCounters.updated} skipped=${entryCounters.skipped}`,
    );
  }
}
