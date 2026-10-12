import { generateUuid } from '../common/utils/uuid';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Project } from '../projects/project.entity';
import { TimeEntryTag } from './time-entry-tag.entity';

@Entity({ name: 'time_entries' })
@Unique(['id', 'projectId'])
@Index(['userId', 'startedAt'])
@Index(['projectId', 'startedAt'])
export class TimeEntry {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'clockify_id', type: 'varchar', length: 64, unique: true, nullable: true })
  clockifyId: string | null;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId: string;

  @Column({ name: 'project_id', type: 'char', length: 36, nullable: true })
  projectId: string | null;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ name: 'started_at', type: 'datetime', precision: 3 })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'datetime', precision: 3, nullable: true })
  endedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.timeEntries)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Project, (project) => project.timeEntries, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'project_id' })
  project: Project | null;

  @OneToMany(() => TimeEntryTag, (timeEntryTag) => timeEntryTag.timeEntry)
  timeEntryTags: TimeEntryTag[];

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = generateUuid();
    }
  }
}
