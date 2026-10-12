import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from './time-entry.entity';
import { TimeEntryTag } from './time-entry-tag.entity';
import { TimeEntriesService } from './time-entries.service';
import { TimeEntriesController } from './time-entries.controller';
import { ProjectsModule } from '../projects/projects.module';
import { TagsModule } from '../tags/tags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeEntry, TimeEntryTag]),
    ProjectsModule,
    TagsModule,
  ],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService, TypeOrmModule],
})
export class TimeEntriesModule {}
