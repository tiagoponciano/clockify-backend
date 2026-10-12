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
import { Client } from '../clients/client.entity';
import { Tag } from '../tags/tag.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';

@Entity({ name: 'projects' })
@Unique(['clientId', 'name'])
export class Project {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'clockify_id', type: 'varchar', length: 64, unique: true, nullable: true })
  clockifyId: string | null;

  @Column({ name: 'client_id', type: 'char', length: 36 })
  clientId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ name: 'is_archived', type: 'boolean', default: false })
  isArchived: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @ManyToOne(() => Client, (client) => client.projects)
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @OneToMany(() => Tag, (tag) => tag.project)
  tags: Tag[];

  @OneToMany(() => TimeEntry, (timeEntry) => timeEntry.project)
  timeEntries: TimeEntry[];

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = generateUuid();
    }
  }
}
