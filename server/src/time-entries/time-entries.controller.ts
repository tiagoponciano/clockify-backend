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
import { TimeEntriesService } from './time-entries.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { ListTimeEntriesQueryDto } from './dto/list-time-entries-query.dto';
import {
  PaginatedTimeEntriesResponseDto,
  TimeEntryResponseDto,
} from './dto/time-entry-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@ApiTags('time-entries')
@ApiBearerAuth()
@Controller('time-entries')
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post('start')
  start(
    @CurrentUser() user: User,
    @Body() dto: StartTimerDto,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.start(user.id, dto);
  }

  @Post('stop')
  stop(@CurrentUser() user: User): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.stop(user.id);
  }

  @Get('current')
  getCurrent(@CurrentUser() user: User): Promise<TimeEntryResponseDto | null> {
    return this.timeEntriesService.getCurrent(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.createManual(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query() query: ListTimeEntriesQueryDto,
  ): Promise<PaginatedTimeEntriesResponseDto> {
    return this.timeEntriesService.findAll(user, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    return this.timeEntriesService.remove(id, user.id);
  }
}
