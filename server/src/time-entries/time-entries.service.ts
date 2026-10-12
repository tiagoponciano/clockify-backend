import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
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
import { buildSkipTake } from '../common/pagination';
import { isWithinRetroactiveWindow } from '../common/utils/timezone';
import { MAX_MANUAL_ENTRY_DURATION_MS } from '../common/constants';
import { canManageResources } from '../types';
import { User } from '../users/user.entity';

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

  private assertOwnership(entry: TimeEntry, userId: string): void {
    if (entry.userId !== userId) {
      throw new ForbiddenException('You can only modify your own time entries');
    }
  }

  private assertEndedAfterStarted(startedAt: Date, endedAt: Date | null): void {
    if (endedAt && endedAt <= startedAt) {
      throw new BadRequestException('endedAt must be greater than startedAt');
    }
  }

  private assertRetroactiveWindow(startedAt: Date): void {
    if (!isWithinRetroactiveWindow(startedAt)) {
      throw new BadRequestException(
        'startedAt must be within the last 10 days and cannot be in the future',
      );
    }
  }

  private assertMaxManualDuration(startedAt: Date, endedAt: Date | null): void {
    if (!endedAt) {
      return;
    }
    const durationMs = endedAt.getTime() - startedAt.getTime();
    if (durationMs > MAX_MANUAL_ENTRY_DURATION_MS) {
      throw new BadRequestException('Manual time entries cannot exceed 24 hours');
    }
  }

  private assertProjectRequired(
    projectId: string | null | undefined,
  ): asserts projectId is string {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
  }

  private async validateTagsForProject(projectId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) {
      return;
    }
    const tags = await this.tagsService.findByIdsForProject(projectId, tagIds);
    const foundIds = new Set(tags.map((tag) => tag.id));
    const invalid = tagIds.filter((id) => !foundIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid tags for project: ${invalid.join(', ')}`);
    }
  }

  private async saveTagLinks(
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

  private async removeTagLinks(manager: EntityManager, timeEntryId: string): Promise<void> {
    await manager.delete(TimeEntryTag, { timeEntryId });
  }

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

    this.assertProjectRequired(dto.projectId);
    await this.projectsService.assertProjectNotArchived(dto.projectId);
    await this.validateTagsForProject(dto.projectId, tagIds);

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
      await this.saveTagLinks(manager, saved, tagIds);
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

    this.assertRetroactiveWindow(startedAt);
    this.assertEndedAfterStarted(startedAt, endedAt);
    this.assertMaxManualDuration(startedAt, endedAt);

    this.assertProjectRequired(dto.projectId);
    await this.projectsService.assertProjectNotArchived(dto.projectId);
    await this.validateTagsForProject(dto.projectId, tagIds);

    const entryId = await this.dataSource.transaction(async (manager) => {
      const entry = manager.create(TimeEntry, {
        userId,
        projectId: dto.projectId,
        description: dto.description ?? '',
        startedAt,
        endedAt,
      });
      const saved = await manager.save(TimeEntry, entry);
      await this.saveTagLinks(manager, saved, tagIds);
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

    const { skip, take } = buildSkipTake(query.page, query.limit);

    const qb = this.timeEntriesRepository
      .createQueryBuilder('te')
      .leftJoinAndSelect('te.project', 'project')
      .leftJoinAndSelect('project.client', 'client')
      .leftJoinAndSelect('te.timeEntryTags', 'tet')
      .leftJoinAndSelect('tet.tag', 'tag')
      .orderBy('te.startedAt', 'DESC')
      .skip(skip)
      .take(take);

    if (query.userId) {
      qb.andWhere('te.userId = :userId', { userId: query.userId });
    } else if (!canSeeTeam) {
      qb.andWhere('te.userId = :userId', { userId: currentUser.id });
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
    this.assertOwnership(entry, userId);

    if (dto.projectId === null) {
      throw new BadRequestException('projectId is required');
    }

    const projectChanging =
      dto.projectId !== undefined && dto.projectId !== entry.projectId;
    const targetProjectId =
      dto.projectId !== undefined ? dto.projectId : entry.projectId;
    this.assertProjectRequired(targetProjectId);
    const targetStartedAt = dto.startedAt ? new Date(dto.startedAt) : entry.startedAt;
    const targetEndedAt =
      dto.endedAt !== undefined
        ? dto.endedAt === null
          ? null
          : new Date(dto.endedAt)
        : entry.endedAt;

    if (dto.startedAt !== undefined) {
      this.assertRetroactiveWindow(targetStartedAt);
    }

    await this.projectsService.assertProjectNotArchived(targetProjectId);

    this.assertEndedAfterStarted(targetStartedAt, targetEndedAt);
    this.assertMaxManualDuration(targetStartedAt, targetEndedAt);

    let tagIds: string[] | undefined = dto.tagIds;
    if (projectChanging) {
      tagIds = dto.tagIds ?? [];
    }

    if (tagIds !== undefined) {
      await this.validateTagsForProject(targetProjectId, tagIds);
    } else if (!projectChanging && entry.timeEntryTags?.length) {
      const existingTagIds = entry.timeEntryTags.map((link) => link.tagId);
      await this.validateTagsForProject(targetProjectId, existingTagIds);
    }

    await this.dataSource.transaction(async (manager) => {
      if (dto.description !== undefined) {
        entry.description = dto.description ?? '';
      }
      if (dto.projectId !== undefined) {
        entry.projectId = dto.projectId;
      }
      if (dto.startedAt !== undefined) {
        entry.startedAt = targetStartedAt;
      }
      if (dto.endedAt !== undefined) {
        entry.endedAt = targetEndedAt;
      }

      await manager.save(TimeEntry, entry);

      if (projectChanging) {
        await this.removeTagLinks(manager, entry.id);
        if (tagIds && tagIds.length > 0) {
          await this.saveTagLinks(manager, entry, tagIds);
        }
      } else if (dto.tagIds !== undefined) {
        await this.removeTagLinks(manager, entry.id);
        await this.saveTagLinks(manager, entry, dto.tagIds);
      }
    });

    return TimeEntryResponseDto.fromEntity(await this.loadEntry(id));
  }

  async remove(id: string, userId: string): Promise<void> {
    const entry = await this.timeEntriesRepository.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException(`Time entry ${id} not found`);
    }
    this.assertOwnership(entry, userId);
    await this.timeEntriesRepository.remove(entry);
  }
}
