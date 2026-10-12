import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryTag } from './time-entry-tag.entity';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesQueryDto } from './dto/list-time-entries-query.dto';
import {
  PaginatedTimeEntriesResponseDto,
  TimeEntryResponseDto,
} from './dto/time-entry-response.dto';
import { ProjectsService } from '../projects/projects.service';
import { TagsService } from '../tags/tags.service';
import { canManageResources } from '../types';
import { User } from '../users/user.entity';
import {
  assertEndedAfterStarted,
  assertMaxManualDuration,
  assertOwnership,
  assertProjectRequired,
  assertRetroactiveWindow,
} from './time-entry.rules';
import { assertTagsBelongToProject, saveTagLinks } from './time-entry-tag-links';
import { persistUpdate, prepareUpdate } from './time-entry-update';
import { buildListQuery } from './time-entries.query';

const ENTRY_RELATIONS = {
  project: { client: true },
  timeEntryTags: { tag: true },
} as const;

@Injectable()
export class TimeEntriesService {
  constructor(
    @InjectRepository(TimeEntry)
    private readonly timeEntriesRepository: Repository<TimeEntry>,
    @InjectRepository(TimeEntryTag)
    private readonly timeEntryTagsRepository: Repository<TimeEntryTag>,
    private readonly projectsService: ProjectsService,
    private readonly tagsService: TagsService,
    private readonly dataSource: DataSource,
  ) {}

  private async loadEntry(id: string): Promise<TimeEntry> {
    const entry = await this.timeEntriesRepository.findOne({
      where: { id },
      relations: ENTRY_RELATIONS,
    });
    if (!entry) {
      throw new NotFoundException(`Time entry ${id} not found`);
    }
    return entry;
  }

  async start(userId: string, dto: StartTimerDto): Promise<TimeEntryResponseDto> {
    const tagIds = dto.tagIds ?? [];

    assertProjectRequired(dto.projectId);
    await this.projectsService.assertProjectNotArchived(dto.projectId);
    await assertTagsBelongToProject(this.tagsService, dto.projectId, tagIds);

    const entryId = await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const openEntry = await manager.findOne(TimeEntry, {
        where: { userId, endedAt: IsNull() },
      });
      if (openEntry) {
        openEntry.endedAt = now;
        await manager.save(TimeEntry, openEntry);
      }

      const entry = manager.create(TimeEntry, {
        userId,
        projectId: dto.projectId,
        description: dto.description ?? '',
        startedAt: now,
        endedAt: null,
      });
      const saved = await manager.save(TimeEntry, entry);
      await saveTagLinks(manager, saved, tagIds);
      return saved.id;
    });

    return TimeEntryResponseDto.fromEntity(await this.loadEntry(entryId));
  }

  async stop(userId: string): Promise<TimeEntryResponseDto> {
    const openEntry = await this.timeEntriesRepository.findOne({
      where: { userId, endedAt: IsNull() },
    });
    if (!openEntry) {
      throw new BadRequestException('No open time entry found');
    }

    openEntry.endedAt = new Date();
    await this.timeEntriesRepository.save(openEntry);
    return TimeEntryResponseDto.fromEntity(await this.loadEntry(openEntry.id));
  }

  async getCurrent(userId: string): Promise<TimeEntryResponseDto | null> {
    const entry = await this.timeEntriesRepository.findOne({
      where: { userId, endedAt: IsNull() },
      relations: ENTRY_RELATIONS,
    });
    return entry ? TimeEntryResponseDto.fromEntity(entry) : null;
  }

  async createManual(userId: string, dto: CreateTimeEntryDto): Promise<TimeEntryResponseDto> {
    const startedAt = new Date(dto.startedAt);
    const endedAt = new Date(dto.endedAt);
    const tagIds = dto.tagIds ?? [];

    assertRetroactiveWindow(startedAt);
    assertEndedAfterStarted(startedAt, endedAt);
    assertMaxManualDuration(startedAt, endedAt);

    assertProjectRequired(dto.projectId);
    await this.projectsService.assertProjectNotArchived(dto.projectId);
    await assertTagsBelongToProject(this.tagsService, dto.projectId, tagIds);

    const entryId = await this.dataSource.transaction(async (manager) => {
      const entry = manager.create(TimeEntry, {
        userId,
        projectId: dto.projectId,
        description: dto.description ?? '',
        startedAt,
        endedAt,
      });
      const saved = await manager.save(TimeEntry, entry);
      await saveTagLinks(manager, saved, tagIds);
      return saved.id;
    });

    return TimeEntryResponseDto.fromEntity(await this.loadEntry(entryId));
  }

  async findAll(
    currentUser: User,
    query: ListTimeEntriesQueryDto,
  ): Promise<PaginatedTimeEntriesResponseDto> {
    const canSeeTeam = canManageResources(currentUser.role);
    if (query.userId && query.userId !== currentUser.id && !canSeeTeam) {
      throw new ForbiddenException('You can only list your own time entries');
    }

    const ownerId = query.userId || (canSeeTeam ? null : currentUser.id);
    const qb = buildListQuery(this.timeEntriesRepository, query, ownerId);

    const [entries, total] = await qb.getManyAndCount();

    return {
      items: entries.map(TimeEntryResponseDto.fromEntity),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string): Promise<TimeEntryResponseDto> {
    return TimeEntryResponseDto.fromEntity(await this.loadEntry(id));
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    const entry = await this.timeEntriesRepository.findOne({
      where: { id },
      relations: ENTRY_RELATIONS,
    });
    if (!entry) {
      throw new NotFoundException(`Time entry ${id} not found`);
    }
    assertOwnership(entry, userId);

    const prepared = await prepareUpdate(entry, dto, this.projectsService, this.tagsService);
    await this.dataSource.transaction((manager) => persistUpdate(manager, entry, dto, prepared));

    return TimeEntryResponseDto.fromEntity(await this.loadEntry(id));
  }

  async remove(id: string, userId: string): Promise<void> {
    const entry = await this.timeEntriesRepository.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Time entry ${id} not found`);
    }
    assertOwnership(entry, userId);
    await this.timeEntriesRepository.remove(entry);
  }
}
