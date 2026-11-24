export const INTERNAL_AVATARS = [
  { id: 'maestro_spiedo', label: 'Maestro dello Spiedo', src: '/avatars/maestro_spiedo.svg' },
  { id: 'signore_salsa', label: 'Signore della Salsa', src: '/avatars/signore_salsa.svg' },
  { id: 'ninja_cipolla', label: 'Ninja della Cipolla', src: '/avatars/ninja_cipolla.svg' },
  { id: 'cavaliere_falafel', label: 'Cavaliere del Falafel', src: '/avatars/cavaliere_falafel.svg' },
  { id: 'guardiano_pita', label: 'Guardiano della Pita', src: '/avatars/guardiano_pita.svg' },
];

export const DEFAULT_AVATAR_ID = 'maestro_spiedo';

export function getAvatarSrc(id: string | null) {
  const avatar = INTERNAL_AVATARS.find(a => a.id === id);
  return avatar ? avatar.src : INTERNAL_AVATARS[0].src;
}
