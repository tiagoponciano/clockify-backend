import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { ClockifyApiClient } from '../clockify-api.client';
import { emptyCounters } from './import-counters';

/** Key under which the synthetic "No Client" is stored in the client map. */
export const NO_CLIENT_CLOCKIFY_ID = '__no_client__';

/**
 * Upserts workspace clients plus the synthetic "No Client".
 * Returns Clockify client id → local client id.
 */
export async function importClients(
  api: ClockifyApiClient,
  clientsRepository: Repository<Client>,
  logger: Logger,
): Promise<Map<string, string>> {
  const counters = emptyCounters();
  const map = new Map<string, string>();
  const remotes = await api.listClients();

  for (const remote of remotes) {
    let local = await clientsRepository.findOne({
      where: { clockifyId: remote.id },
    });
    if (!local) {
      local = await clientsRepository.findOne({
        where: { name: remote.name },
      });
    }

    if (local) {
      local.clockifyId = remote.id;
      local.name = remote.name;
      local.isActive = !(remote.archived ?? false);
      await clientsRepository.save(local);
      counters.updated += 1;
    } else {
      local = clientsRepository.create({
        clockifyId: remote.id,
        name: remote.name,
        color: '#4A90D9',
        isActive: !(remote.archived ?? false),
      });
      await clientsRepository.save(local);
      counters.created += 1;
    }

    map.set(remote.id, local.id);
  }

  const noClient = await ensureNoClient(clientsRepository);
  map.set(NO_CLIENT_CLOCKIFY_ID, noClient.id);

  logger.log(
    `Clients created=${counters.created} updated=${counters.updated}`,
  );
  return map;
}

async function ensureNoClient(clientsRepository: Repository<Client>): Promise<Client> {
  let local = await clientsRepository.findOne({
    where: { clockifyId: NO_CLIENT_CLOCKIFY_ID },
  });
  if (local) {
    return local;
  }
  local = await clientsRepository.findOne({ where: { name: 'No Client' } });
  if (local) {
    local.clockifyId = NO_CLIENT_CLOCKIFY_ID;
    return clientsRepository.save(local);
  }
  return clientsRepository.save(
    clientsRepository.create({
      clockifyId: NO_CLIENT_CLOCKIFY_ID,
      name: 'No Client',
      color: '#9CA3AF',
      isActive: true,
    }),
  );
}
