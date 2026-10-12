import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagResponseDto } from './dto/tag-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RESOURCE_MANAGEMENT_ROLES } from '../types';

@ApiTags('tags')
@ApiBearerAuth()
@Controller('projects/:projectId/tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTagDto,
  ): Promise<TagResponseDto> {
    return this.tagsService.create(projectId, dto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string): Promise<TagResponseDto[]> {
    return this.tagsService.findAllByProject(projectId);
  }

  @Patch(':id')
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ): Promise<TagResponseDto> {
    return this.tagsService.update(projectId, id, dto);
  }

  @Delete(':id')
  @Roles(...RESOURCE_MANAGEMENT_ROLES)
  remove(@Param('projectId') projectId: string, @Param('id') id: string): Promise<void> {
    return this.tagsService.remove(projectId, id);
  }
}
