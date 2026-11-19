import type { RechtId } from '../../../../shared/recht/arten.ts';
import { tx } from '../../text.ts';

export function rechtTitel(id: RechtId): string {
  switch (id) {
    case 'impressum':
      return tx('Impressum');
    case 'datenschutz':
      return tx('Datenschutzerklärung');
    case 'nutzung':
      return tx('Nutzungsbedingungen');
    case 'lizenzen':
      return tx('Lizenzhinweise');
  }
}
