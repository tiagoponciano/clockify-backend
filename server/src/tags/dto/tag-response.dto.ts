import { Tag } from '../tag.entity';
import { toIsoUtc } from '../../common/utils/timezone';

export class TagResponseDto {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;

  static fromEntity(tag: Tag): TagResponseDto {
    return {
      id: tag.id,
      projectId: tag.projectId,
      name: tag.name,
      createdAt: toIsoUtc(tag.createdAt)!,
    };
  }
}
