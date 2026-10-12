import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { User } from '../users/user.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TimeEntry, User])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
