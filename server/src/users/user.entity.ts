import { UserRole } from '../types';
import { generateUuid } from '../common/utils/uuid';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { TimeEntry } from '../time-entries/time-entry.entity';

@Entity({ name: 'users' })
export class User {
  @PrimaryColumn('char', { length: 36 })
  id: string;

  @Column({ name: 'google_sub', type: 'varchar', length: 255, unique: true })
  googleSub: string;

  @Column({ name: 'clockify_id', type: 'varchar', length: 64, unique: true, nullable: true })
  clockifyId: string | null;

  @Column({ type: 'varchar', length: 160, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  acronym: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => TimeEntry, (timeEntry) => timeEntry.user)
  timeEntries: TimeEntry[];

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = generateUuid();
    }
  }
}
