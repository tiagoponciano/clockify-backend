import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RESOURCE_MANAGEMENT_ROLES } from '../types';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  create(@Body() dto: CreateProjectDto): Promise<ProjectResponseDto> {
    return this.projectsService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListProjectsQueryDto): Promise<ProjectResponseDto[]> {
    return this.projectsService.findAll(query.clientId, query.includeArchived);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProjectResponseDto> {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  remove(@Param('id') id: string): Promise<void> {
    return this.projectsService.softDelete(id);
  }
}
