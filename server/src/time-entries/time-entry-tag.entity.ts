import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TimeEntry } from './time-entry.entity';
import { Tag } from '../tags/tag.entity';

@Entity({ name: 'time_entry_tags' })
export class TimeEntryTag {
  @PrimaryColumn({ name: 'time_entry_id', type: 'char', length: 36 })
  timeEntryId: string;

  @PrimaryColumn({ name: 'tag_id', type: 'char', length: 36 })
  tagId: string;

  @Column({ name: 'project_id', type: 'char', length: 36 })
  projectId: string;

  @ManyToOne(() => TimeEntry, (timeEntry) => timeEntry.timeEntryTags, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'time_entry_id', referencedColumnName: 'id' },
    { name: 'project_id', referencedColumnName: 'projectId' },
  ])
  timeEntry: TimeEntry;

  @ManyToOne(() => Tag, (tag) => tag.timeEntryTags, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'tag_id', referencedColumnName: 'id' },
    { name: 'project_id', referencedColumnName: 'projectId' },
  ])
  tag: Tag;
}
