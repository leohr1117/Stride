import { KlassenBild } from './KlassenBild.tsx';

export function ProfilBild({ klasse, groesse = 'size-8' }: { klasse: string; groesse?: string }) {
  return <KlassenBild klasse={klasse} groesse={groesse} profil />;
}
