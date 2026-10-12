import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { isWithinRetroactiveWindow } from '../common/utils/timezone';
import { MAX_MANUAL_ENTRY_DURATION_MS } from '../common/constants';
import { TimeEntry } from './time-entry.entity';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';

export function assertOwnership(entry: TimeEntry, userId: string): void {
  if (entry.userId !== userId) {
    throw new ForbiddenException('You can only modify your own time entries');
  }
}

export function assertEndedAfterStarted(startedAt: Date, endedAt: Date | null): void {
  if (endedAt && endedAt <= startedAt) {
    throw new BadRequestException('endedAt must be greater than startedAt');
  }
}

export function assertRetroactiveWindow(startedAt: Date): void {
  if (!isWithinRetroactiveWindow(startedAt)) {
    throw new BadRequestException(
      'startedAt must be within the last 10 days and cannot be in the future',
    );
  }
}

export function assertMaxManualDuration(startedAt: Date, endedAt: Date | null): void {
  if (!endedAt) {
    return;
  }
  const durationMs = endedAt.getTime() - startedAt.getTime();
  if (durationMs > MAX_MANUAL_ENTRY_DURATION_MS) {
    throw new BadRequestException('Manual time entries cannot exceed 24 hours');
  }
}

export function assertProjectRequired(
  projectId: string | null | undefined,
): asserts projectId is string {
  if (!projectId) {
    throw new BadRequestException('projectId is required');
  }
}

export type UpdateTarget = {
  projectChanging: boolean;
  projectId: string | null;
  startedAt: Date;
  endedAt: Date | null;
};

/** Values the entry will have after `dto` is applied; fields absent from `dto` keep the entry's value. */
export function resolveUpdateTarget(entry: TimeEntry, dto: UpdateTimeEntryDto): UpdateTarget {
  return {
    projectChanging: dto.projectId !== undefined && dto.projectId !== entry.projectId,
    projectId: dto.projectId !== undefined ? dto.projectId : entry.projectId,
    startedAt: dto.startedAt ? new Date(dto.startedAt) : entry.startedAt,
    endedAt:
      dto.endedAt !== undefined
        ? dto.endedAt === null
          ? null
          : new Date(dto.endedAt)
        : entry.endedAt,
  };
}

/** Copies onto `entry` only the fields present in `dto`. */
export function applyUpdate(entry: TimeEntry, dto: UpdateTimeEntryDto, target: UpdateTarget): void {
  if (dto.description !== undefined) {
    entry.description = dto.description ?? '';
  }
  if (dto.projectId !== undefined) {
    entry.projectId = dto.projectId;
  }
  if (dto.startedAt !== undefined) {
    entry.startedAt = target.startedAt;
  }
  if (dto.endedAt !== undefined) {
    entry.endedAt = target.endedAt;
  }
}
