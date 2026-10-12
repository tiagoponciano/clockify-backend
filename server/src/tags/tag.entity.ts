import { generateUuid } from '../common/utils/uuid';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { TimeEntryTag } from '../time-entries/time-entry-tag.entity';

@Entity({ name: 'tags' })
@Unique(['projectId', 'name'])
@Unique(['id', 'projectId'])
export class Tag {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'clockify_id', type: 'varchar', length: 64, unique: true, nullable: true })
  clockifyId: string | null;

  @Column({ name: 'project_id', type: 'char', length: 36 })
  projectId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Project, (project) => project.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @OneToMany(() => TimeEntryTag, (timeEntryTag) => timeEntryTag.tag)
  timeEntryTags: TimeEntryTag[];

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = generateUuid();
    }
  }
}
