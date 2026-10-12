import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { UserRole } from '../../types';
import { ClockifyApiClient } from '../clockify-api.client';
import { emptyCounters } from './import-counters';

/**
 * Upserts workspace users whose email is on `allowedDomain`.
 * Returns Clockify user id → local user id.
 */
export async function importUsers(
  api: ClockifyApiClient,
  usersRepository: Repository<User>,
  allowedDomain: string,
  logger: Logger,
): Promise<Map<string, string>> {
  const counters = emptyCounters();
  const map = new Map<string, string>();
  const users = await api.listUsers();

  for (const remote of users) {
    const email = (remote.email ?? '').trim().toLowerCase();
    if (!email.endsWith(`@${allowedDomain}`)) {
      logger.warn(`Skipping user without @${allowedDomain} email: ${remote.name} <${email || 'none'}>`);
      counters.skipped += 1;
      continue;
    }

    const acronym = email.split('@')[0];
    const displayName = (remote.name ?? '').trim() || acronym;
    const avatarUrl = remote.profilePicture?.trim() ? remote.profilePicture : null;
    const isActive = (remote.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE';
    let local = await usersRepository.findOne({
      where: { clockifyId: remote.id },
    });

    if (!local) {
      local = await usersRepository.findOne({ where: { email } });
    }

    if (local) {
      local.clockifyId = remote.id;
      local.email = email;
      local.acronym = acronym;
      local.name = displayName;
      local.isActive = isActive;
      if (avatarUrl) {
        local.avatarUrl = avatarUrl;
      }
      if (!local.googleSub) {
        local.googleSub = `clockify:${remote.id}`;
      }
      await usersRepository.save(local);
      counters.updated += 1;
    } else {
      local = usersRepository.create({
        clockifyId: remote.id,
        googleSub: `clockify:${remote.id}`,
        email,
        acronym,
        name: displayName,
        avatarUrl,
        role: UserRole.MEMBER,
        isActive,
      });
      await usersRepository.save(local);
      counters.created += 1;
    }

    map.set(remote.id, local.id);
  }

  logger.log(
    `Users created=${counters.created} updated=${counters.updated} skipped=${counters.skipped}`,
  );
  return map;
}
