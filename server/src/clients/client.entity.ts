import { generateUuid } from '../common/utils/uuid';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

@Entity({ name: 'clients' })
export class Client {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'clockify_id', type: 'varchar', length: 64, unique: true, nullable: true })
  clockifyId: string | null;

  @Column({ type: 'varchar', length: 160, unique: true })
  name: string;

  @Column({ type: 'char', length: 7, default: '#4A90D9' })
  color: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => Project, (project) => project.client)
  projects: Project[];

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = generateUuid();
    }
  }
}
