import { DataSource, EntityManager, Repository } from 'typeorm';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryTag } from './time-entry-tag.entity';
import { ProjectsService } from '../projects/projects.service';
import { TagsService } from '../tags/tags.service';

export const userId = 'user-1';
export const projectId = 'project-1';
export const otherProjectId = 'project-2';

export type TimeEntriesServiceFixture = {
  service: TimeEntriesService;
  timeEntriesRepository: jest.Mocked<Repository<TimeEntry>>;
  projectsService: jest.Mocked<ProjectsService>;
  tagsService: jest.Mocked<TagsService>;
  dataSource: jest.Mocked<DataSource>;
  transactionManager: jest.Mocked<EntityManager>;
};

/** A TimeEntriesService whose repositories, services and transactions are jest mocks. */
export function createTimeEntriesServiceFixture(): TimeEntriesServiceFixture {
  const timeEntriesRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as jest.Mocked<Repository<TimeEntry>>;

  const projectsService = {
    assertProjectNotArchived: jest.fn(),
  } as unknown as jest.Mocked<ProjectsService>;

  const tagsService = {
    findByIdsForProject: jest.fn(),
  } as unknown as jest.Mocked<TagsService>;

  const transactionManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<EntityManager>;

  const dataSource = {
    transaction: jest.fn(async (cb: (manager: EntityManager) => Promise<unknown>) =>
      cb(transactionManager),
    ),
  } as unknown as jest.Mocked<DataSource>;

  const service = new TimeEntriesService(
    timeEntriesRepository,
    {} as Repository<TimeEntryTag>,
    projectsService,
    tagsService,
    dataSource,
  );

  return {
    service,
    timeEntriesRepository,
    projectsService,
    tagsService,
    dataSource,
    transactionManager,
  };
}
