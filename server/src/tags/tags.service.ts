import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { Project } from '../projects/project.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  private async assertProjectExists(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
    return project;
  }

  async create(projectId: string, dto: CreateTagDto): Promise<TagResponseDto> {
    await this.assertProjectExists(projectId);

    const existing = await this.tagsRepository.findOne({
      where: { projectId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Tag "${dto.name}" already exists for project ${projectId}`,
      );
    }

    const tag = this.tagsRepository.create({ projectId, name: dto.name });
    const saved = await this.tagsRepository.save(tag);
    return TagResponseDto.fromEntity(saved);
  }

  async findAllByProject(projectId: string): Promise<TagResponseDto[]> {
    await this.assertProjectExists(projectId);

    const tags = await this.tagsRepository.find({
      where: { projectId },
      order: { name: 'ASC' },
    });
    return tags.map(TagResponseDto.fromEntity);
  }

  async update(projectId: string, id: string, dto: UpdateTagDto): Promise<TagResponseDto> {
    const tag = await this.tagsRepository.findOne({ where: { id, projectId } });
    if (!tag) {
      throw new NotFoundException(`Tag ${id} not found in project ${projectId}`);
    }

    if (dto.name !== undefined && dto.name !== tag.name) {
      const duplicate = await this.tagsRepository.findOne({
        where: { projectId, name: dto.name },
      });
      if (duplicate) {
        throw new ConflictException(
          `Tag "${dto.name}" already exists for project ${projectId}`,
        );
      }
      tag.name = dto.name;
    }

    const saved = await this.tagsRepository.save(tag);
    return TagResponseDto.fromEntity(saved);
  }

  async remove(projectId: string, id: string): Promise<void> {
    const tag = await this.tagsRepository.findOne({ where: { id, projectId } });
    if (!tag) {
      throw new NotFoundException(`Tag ${id} not found in project ${projectId}`);
    }
    await this.tagsRepository.remove(tag);
  }

  async findByIdsForProject(projectId: string, tagIds: string[]): Promise<Tag[]> {
    if (tagIds.length === 0) {
      return [];
    }
    return this.tagsRepository.find({
      where: { projectId, id: In(tagIds) },
    });
  }
}
