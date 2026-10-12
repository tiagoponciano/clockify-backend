import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Project } from './project.entity';
import { Client } from '../clients/client.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  private async assertClientActive(clientId: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({ where: { id: clientId } });
    if (!client || !client.isActive) {
      throw new BadRequestException(`Client ${clientId} does not exist or is inactive`);
    }
    return client;
  }

  async create(dto: CreateProjectDto): Promise<ProjectResponseDto> {
    await this.assertClientActive(dto.clientId);

    const existing = await this.projectsRepository.findOne({
      where: { clientId: dto.clientId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Project "${dto.name}" already exists for client ${dto.clientId}`,
      );
    }

    const project = this.projectsRepository.create({
      clientId: dto.clientId,
      name: dto.name,
    });
    const saved = await this.projectsRepository.save(project);
    const loaded = await this.findEntityWithClient(saved.id);
    return ProjectResponseDto.fromEntity(loaded);
  }

  async findAll(clientId?: string, includeArchived = false): Promise<ProjectResponseDto[]> {
    const where: FindOptionsWhere<Project> = {};
    if (clientId) {
      where.clientId = clientId;
    }
    if (!includeArchived) {
      where.isArchived = false;
    }

    const projects = await this.projectsRepository.find({
      where,
      relations: { client: true },
      order: { name: 'ASC' },
    });
    return projects.map(ProjectResponseDto.fromEntity);
  }

  async findOne(id: string): Promise<ProjectResponseDto> {
    const project = await this.findEntityWithClient(id);
    return ProjectResponseDto.fromEntity(project);
  }

  async findEntityWithClient(id: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: { client: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    return project;
  }

  async assertProjectNotArchived(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    if (project.isArchived) {
      throw new BadRequestException(`Project ${projectId} is archived`);
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: { client: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    const targetClientId = dto.clientId ?? project.clientId;
    if (dto.clientId !== undefined) {
      await this.assertClientActive(dto.clientId);
      project.clientId = dto.clientId;
    }

    const targetName = dto.name ?? project.name;
    if (dto.name !== undefined || dto.clientId !== undefined) {
      const duplicate = await this.projectsRepository.findOne({
        where: { clientId: targetClientId, name: targetName },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Project "${targetName}" already exists for client ${targetClientId}`,
        );
      }
    }

    if (dto.name !== undefined) {
      project.name = dto.name;
    }
    if (dto.isArchived !== undefined) {
      project.isArchived = dto.isArchived;
    }

    await this.projectsRepository.save(project);
    const loaded = await this.findEntityWithClient(id);
    return ProjectResponseDto.fromEntity(loaded);
  }

  async softDelete(id: string): Promise<void> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }
    project.isArchived = true;
    await this.projectsRepository.save(project);
  }
}
