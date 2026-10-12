import { TimeEntry } from '../time-entry.entity';
import { toIsoUtc } from '../../common/utils/timezone';
import { TagResponseDto } from '../../tags/dto/tag-response.dto';
import { ProjectClientDto } from '../../projects/dto/project-response.dto';

export class TimeEntryProjectDto {
  id: string;
  name: string;
  client: ProjectClientDto;
}

export class TimeEntryResponseDto {
  id: string;
  userId: string;
  projectId: string | null;
  description: string;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: TimeEntryProjectDto | null;
  tags: TagResponseDto[];

  static fromEntity(entry: TimeEntry): TimeEntryResponseDto {
    const tags =
      entry.timeEntryTags
        ?.map((link) => link.tag)
        .filter((tag): tag is NonNullable<typeof tag> => tag != null)
        .map(TagResponseDto.fromEntity) ?? [];

    let project: TimeEntryProjectDto | null = null;
    if (entry.project && entry.project.client) {
      project = {
        id: entry.project.id,
        name: entry.project.name,
        client: ProjectClientDto.fromEntity(entry.project.client),
      };
    }

    return {
      id: entry.id,
      userId: entry.userId,
      projectId: entry.projectId,
      description: entry.description,
      startedAt: toIsoUtc(entry.startedAt)!,
      endedAt: toIsoUtc(entry.endedAt),
      createdAt: toIsoUtc(entry.createdAt)!,
      updatedAt: toIsoUtc(entry.updatedAt)!,
      project,
      tags,
    };
  }
}

export class PaginatedTimeEntriesResponseDto {
  items: TimeEntryResponseDto[];
  total: number;
  page: number;
  limit: number;
}
