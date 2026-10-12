import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientResponseDto } from './dto/client-response.dto';
import { Project } from '../projects/project.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
  ) {}

  async create(dto: CreateClientDto): Promise<ClientResponseDto> {
    const existing = await this.clientsRepository.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Client with name "${dto.name}" already exists`);
    }

    const client = this.clientsRepository.create({
      name: dto.name,
      color: dto.color ?? '#4A90D9',
    });
    const saved = await this.clientsRepository.save(client);
    return ClientResponseDto.fromEntity(saved);
  }

  async findAll(includeInactive = false): Promise<ClientResponseDto[]> {
    const clients = await this.clientsRepository.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
    return clients.map(ClientResponseDto.fromEntity);
  }

  async findOne(id: string): Promise<ClientResponseDto> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return ClientResponseDto.fromEntity(client);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    if (dto.name !== undefined && dto.name !== client.name) {
      const duplicate = await this.clientsRepository.findOne({ where: { name: dto.name } });
      if (duplicate) {
        throw new ConflictException(`Client with name "${dto.name}" already exists`);
      }
      client.name = dto.name;
    }

    if (dto.color !== undefined) {
      client.color = dto.color;
    }
    if (dto.isActive !== undefined) {
      client.isActive = dto.isActive;
    }

    const saved = await this.clientsRepository.save(client);
    return ClientResponseDto.fromEntity(saved);
  }

  async softDelete(id: string): Promise<void> {
    const client = await this.clientsRepository.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }

    const projectCount = await this.projectsRepository.count({ where: { clientId: id } });
    if (projectCount > 0) {
      throw new ConflictException(`Client ${id} has projects and cannot be deleted`);
    }

    client.isActive = false;
    await this.clientsRepository.save(client);
  }
}
