export const PLAYER_PROFILE_KEY = 'generals.player-profile';

export type PlayerProfile = { name: string; handle: string };

export function readPlayerProfile(): PlayerProfile {
  if (typeof window === 'undefined') return { name: '', handle: '' };
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY) || '{}');
    return {
      name:
        typeof saved.name === 'string'
          ? saved.name
          : localStorage.getItem('username') || '',
      handle: typeof saved.handle === 'string' ? saved.handle : '',
    };
  } catch {
    return { name: localStorage.getItem('username') || '', handle: '' };
  }
}

export function savePlayerProfile(profile: PlayerProfile) {
  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem('username', profile.name);
}
