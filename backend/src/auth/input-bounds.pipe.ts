import { BadRequestException, Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';

/** Resource bounds only. Existing per-endpoint whitelists/types remain authoritative. */
export function assertInputBounds(value: unknown, key = '', depth = 0): void {
  if (depth > 32) throw new BadRequestException('Objet JSON trop imbriqué.');
  if (typeof value === 'string') {
    const limit = ['notes', 'description', 'address', 'reportFooter'].includes(key) ? 10000 : 500;
    if (value.length > limit) throw new BadRequestException(`Texte trop long (${limit} caractères maximum).`);
  } else if (Array.isArray(value)) {
    if (value.length > 1000) throw new BadRequestException('1000 éléments maximum par liste.');
    for (const item of value) assertInputBounds(item, key, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const [name, item] of Object.entries(value)) {
      if (name.length > 64) throw new BadRequestException('Nom de champ trop long.');
      assertInputBounds(item, name, depth + 1);
    }
  }
}
@Injectable()
export class InputBoundsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'body') assertInputBounds(value);
    return value;
  }
}
