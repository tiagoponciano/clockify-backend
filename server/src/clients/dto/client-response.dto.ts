import { Client } from '../client.entity';
import { toIsoUtc } from '../../common/utils/timezone';

export class ClientResponseDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  createdAt: string;

  static fromEntity(client: Client): ClientResponseDto {
    return {
      id: client.id,
      name: client.name,
      color: client.color,
      isActive: client.isActive,
      createdAt: toIsoUtc(client.createdAt)!,
    };
  }
}
