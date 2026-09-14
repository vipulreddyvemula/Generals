import { useCallback, useEffect, useState } from 'react';
import { RoomPool } from './types';

export function useRooms(pollMs = 5000) {
  const [rooms, setRooms] = useState<RoomPool>({});
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_API}/get_rooms`
      );
      if (!response.ok) throw new Error('The room service is unavailable.');
      setRooms(await response.json());
      setOnline(true);
    } catch {
      setOnline(false);
      setRooms({});
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(interval);
  }, [refresh, pollMs]);
  return { rooms, loading, online, refresh };
}
