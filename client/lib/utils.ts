
import { Room } from './types';


export function getPlayerIndex(room: Room, playerId: string) {
  for (let i = 0; i < room.players.length; ++i) {
    if (room.players[i].id === playerId) {
      return i;
    }
  }
  return -1;
}

export function getPlayerIndexBySocket(room: Room, socketId: string) {
  for (let i = 0; i < room.players.length; ++i) {
    if (room.players[i].socket_id === socketId) {
      return i;
    }
  }
  return -1;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Proceed to fallback
    }
  }

  // Fallback for older browsers and non-secure contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Move element out of view to avoid scrolling or flashing
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    return false;
  }
}