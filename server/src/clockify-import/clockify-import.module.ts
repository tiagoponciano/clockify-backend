import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { Project } from '../projects/project.entity';
import { Tag } from '../tags/tag.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { TimeEntryTag } from '../time-entries/time-entry-tag.entity';
import { User } from '../users/user.entity';
import { ClockifyImportService } from './clockify-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Client,
      Project,
      Tag,
      TimeEntry,
      TimeEntryTag,
    ]),
  ],
  providers: [ClockifyImportService],
  exports: [ClockifyImportService],
})
export class ClockifyImportModule {}
