import { User } from '../users/user.entity';
import { Client } from '../clients/client.entity';
import { Project } from '../projects/project.entity';
import { Tag } from '../tags/tag.entity';
import { TimeEntry } from '../time-entries/time-entry.entity';
import { TimeEntryTag } from '../time-entries/time-entry-tag.entity';

export const entities = [User, Client, Project, Tag, TimeEntry, TimeEntryTag];
