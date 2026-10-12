import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tag } from './tag.entity';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { Project } from '../projects/project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tag, Project])],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService, TypeOrmModule],
})
export class TagsModule {}
