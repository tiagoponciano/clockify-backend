import { Client } from '../../clients/client.entity';
import { Project } from '../project.entity';
import { toIsoUtc } from '../../common/utils/timezone';

export class ProjectClientDto {
  id: string;
  name: string;
  color: string;

  static fromEntity(client: Client): ProjectClientDto {
    return {
      id: client.id,
      name: client.name,
      color: client.color,
    };
  }
}

export class ProjectResponseDto {
  id: string;
  clientId: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  client: ProjectClientDto;

  static fromEntity(project: Project): ProjectResponseDto {
    if (!project.client) {
      throw new Error('Project client relation must be loaded');
    }
    return {
      id: project.id,
      clientId: project.clientId,
      name: project.name,
      isArchived: project.isArchived,
      createdAt: toIsoUtc(project.createdAt)!,
      client: ProjectClientDto.fromEntity(project.client),
    };
  }
}
