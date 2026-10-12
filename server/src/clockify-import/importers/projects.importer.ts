import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Project } from '../../projects/project.entity';
import { ClockifyApiClient } from '../clockify-api.client';
import { NO_CLIENT_CLOCKIFY_ID } from './clients.importer';
import { emptyCounters } from './import-counters';

/**
 * Upserts workspace projects; a project without a mapped client goes under "No Client".
 * Returns Clockify project id → local project id.
 */
export async function importProjects(
  api: ClockifyApiClient,
  projectsRepository: Repository<Project>,
  clientMap: Map<string, string>,
  logger: Logger,
): Promise<Map<string, string>> {
  const counters = emptyCounters();
  const map = new Map<string, string>();
  const remotes = await api.listProjects();
  const fallbackClientId = clientMap.get(NO_CLIENT_CLOCKIFY_ID)!;

  for (const remote of remotes) {
    const localClientId =
      (remote.clientId && clientMap.get(remote.clientId)) || fallbackClientId;

    let local = await projectsRepository.findOne({
      where: { clockifyId: remote.id },
    });
    if (!local) {
      local = await projectsRepository.findOne({
        where: { clientId: localClientId, name: remote.name },
      });
    }

    if (local) {
      local.clockifyId = remote.id;
      local.clientId = localClientId;
      local.name = remote.name;
      local.isArchived = remote.archived ?? false;
      await projectsRepository.save(local);
      counters.updated += 1;
    } else {
      local = projectsRepository.create({
        clockifyId: remote.id,
        clientId: localClientId,
        name: remote.name,
        isArchived: remote.archived ?? false,
      });
      await projectsRepository.save(local);
      counters.created += 1;
    }

    map.set(remote.id, local.id);
  }

  logger.log(
    `Projects created=${counters.created} updated=${counters.updated}`,
  );
  return map;
}
