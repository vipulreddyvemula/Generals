import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AddIcon from '@mui/icons-material/Add';
import LinkIcon from '@mui/icons-material/Link';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ColorArr } from '@/lib/constants';
import { Room } from '@/lib/types';
import { useRooms } from '@/lib/use-rooms';

export type PendingRoomSettings = Pick<
  Room,
  | 'roomName'
  | 'maxPlayers'
  | 'gameSpeed'
  | 'mapWidth'
  | 'mapHeight'
  | 'mountain'
  | 'city'
  | 'swamp'
  | 'fogOfWar'
  | 'deathSpectator'
  | 'revealKing'
  | 'warringStatesMode'
>;

export function pendingRoomSettingsKey(roomId: string) {
  return `generals.pending-room-settings.${roomId}`;
}

function RangeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className='g-range'>
      <span className='g-range-label'>
        <span>{label}</span>
        <b>{value.toFixed(2)}</b>
      </span>
      <input
        aria-label={label}
        type='range'
        min='0'
        max='1'
        step='.05'
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function Lobby({ roomBrowser }: { roomBrowser: ReturnType<typeof useRooms> }) {
  const router = useRouter();
  const { rooms, loading, online, refresh } = roomBrowser;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [settings, setSettings] = useState<PendingRoomSettings>({
    roomName: '',
    maxPlayers: 2,
    gameSpeed: 1,
    mapWidth: 0.5,
    mapHeight: 0.5,
    mountain: 0.5,
    city: 0.5,
    swamp: 0,
    fogOfWar: true,
    deathSpectator: true,
    revealKing: false,
    warringStatesMode: false,
  });
  const update = <K extends keyof PendingRoomSettings>(
    key: K,
    value: PendingRoomSettings[K]
  ) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!localStorage.getItem('username')) router.replace('/player-details');
  }, [router]);

  useEffect(() => {
    if (typeof router.query.joinError === 'string') {
      setError(router.query.joinError);
    }
  }, [router.query.joinError]);

  const createRoom = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_API}/create_room`
      );
      const result = await response.json();
      if (!response.ok || typeof result.roomId !== 'string')
        throw new Error(result.message || 'Could not create the room.');
      const pending = {
        ...settings,
        roomName: settings.roomName.trim() || 'Untitled',
      };
      sessionStorage.setItem(
        pendingRoomSettingsKey(result.roomId),
        JSON.stringify(pending)
      );
      await router.push(`/rooms/${result.roomId}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not create the room.'
      );
      setBusy(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // A fresh server snapshot avoids joining a stale/full room and prevents
      // an unknown code from implicitly creating a room on the socket server.
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_API}/get_rooms`);
      if (!response.ok) throw new Error('Could not check that room. Try again.');
      const latestRooms = (await response.json()) as Record<string, Room>;
      const room = Object.values(latestRooms).find(
        (entry) => entry.id.toLowerCase() === roomId.trim().toLowerCase()
      );
      if (!room) throw new Error('No room was found with that code.');
      if (room.gameStarted) throw new Error('This match has already started.');
      if (room.players.length >= room.maxPlayers) throw new Error('This room is full.');
      await router.push(`/rooms/${room.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join the room.');
      setBusy(false);
    }
  };

  const joinCode = () => {
    if (code.trim()) void joinRoom(code.trim());
  };

  const roomList = Object.values(rooms).sort(
    (a, b) => Number(a.gameStarted) - Number(b.gameStarted)
  );
  return (
    <main className='g-play-main'>
      <section className='g-panel g-play-panel'>
        <header className='g-panel-heading'>
          <span className='g-heading-icon'>
            <AddIcon />
          </span>
          <div>
            <h2>Create a New Room</h2>
            <p>Configure your game settings and invite others.</p>
          </div>
        </header>
        <div className='g-play-form'>
          <label className='g-form-row'>
            <span>Room Name</span>
            <input
              className='g-input'
              maxLength={20}
              value={settings.roomName}
              onChange={(event) => update('roomName', event.target.value)}
              placeholder='Enter room name (e.g. Finals, Fun Match)'
            />
          </label>
          <label className='g-form-row'>
            <span>Room Size</span>
            <select
              className='g-select'
              value={settings.maxPlayers}
              onChange={(event) =>
                update('maxPlayers', Number(event.target.value))
              }
            >
              {Array.from({ length: 11 }, (_, i) => i + 2).map((count) => (
                <option key={count} value={count}>
                  {count} Players
                </option>
              ))}
            </select>
          </label>
          <div>
            <span>Player Colours</span>
            <div className='g-colour-legend'>
              {ColorArr.slice(1).map((color, index) => (
                <i
                  key={index}
                  style={{ background: color }}
                  title={`Player color ${index + 1}`}
                />
              ))}
            </div>
            <small className='g-muted'>
              Assigned by the server when players join.
            </small>
          </div>
          <label className='g-form-row'>
            <span>Game Speed</span>
            <select
              className='g-select'
              value={settings.gameSpeed}
              onChange={(event) =>
                update('gameSpeed', Number(event.target.value))
              }
            >
              {[0.5, 1, 2, 3, 4].map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×{' '}
                  {speed === 1 ? 'Normal' : speed < 1 ? 'Slow' : 'Fast'}
                </option>
              ))}
            </select>
          </label>
          <div className='g-range-grid'>
            <RangeRow
              label='Map Width'
              value={settings.mapWidth}
              onChange={(value) => update('mapWidth', value)}
            />
            <RangeRow
              label='Map Height'
              value={settings.mapHeight}
              onChange={(value) => update('mapHeight', value)}
            />
          </div>
          <div className='g-range-grid terrain'>
            <RangeRow
              label='Mountains'
              value={settings.mountain}
              onChange={(value) => update('mountain', value)}
            />
            <RangeRow
              label='Cities'
              value={settings.city}
              onChange={(value) => update('city', value)}
            />
            <RangeRow
              label='Swamps'
              value={settings.swamp}
              onChange={(value) => update('swamp', value)}
            />
          </div>
          <div>
            <span>Modifiers</span>
            <div className='g-checkbox-grid'>
              {(
                [
                  ['fogOfWar', 'Fog of War'],
                  ['deathSpectator', 'Allow Death Spectator'],
                  ['revealKing', 'Reveal King'],
                  ['warringStatesMode', 'Warring States Mode'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type='checkbox'
                    checked={settings[key]}
                    onChange={(event) => update(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className='g-button g-button-blue'
              disabled={busy || !online}
              onClick={createRoom}
              style={{ flex: 1 }}
            >
              <AddIcon />
              {busy ? 'Creating...' : 'Create Room'}
            </button>
            <button
              className='g-button g-button-outline'
              disabled={busy || !online}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_API}/create_sandbox`);
                  const result = await response.json();
                  if (!response.ok || !result.roomId) throw new Error('Could not create sandbox.');
                  await router.push(`/rooms/${result.roomId}`);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Could not create sandbox.');
                  setBusy(false);
                }
              }}
              style={{ flex: 1 }}
              title='Play against a static bot to practice abilities'
            >
              Sandbox Training
            </button>
          </div>
          {error && (
            <p className='g-error' role='alert'>
              {error}
            </p>
          )}
        </div>
      </section>
      <div className='g-play-right'>
        <section className='g-panel g-play-panel'>
          <header className='g-panel-heading'>
            <LinkIcon style={{ color: 'var(--g-blue)' }} />
            <div>
              <h2>Join a Room with Code</h2>
              <p>Enter a room code to join directly.</p>
            </div>
          </header>
          <div className='g-join-controls'>
            <input
              className='g-input'
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder='Enter room code'
              onKeyDown={(event) => {
                if (event.key === 'Enter') joinCode();
              }}
            />
            <button
              className='g-button g-button-blue'
              onClick={joinCode}
              disabled={!code.trim() || busy}
            >
              Join
            </button>
          </div>
        </section>
        <section className='g-panel g-room-browser'>
          <header className='g-panel-heading g-room-browser-header'>
            <PeopleOutlineIcon style={{ color: 'var(--g-blue)' }} />
            <div>
              <h2>Available Rooms</h2>
              <p>Join an open room and start playing.</p>
            </div>
            <button className='g-button g-button-outline' onClick={refresh}>
              <RefreshIcon />
              Refresh
            </button>
          </header>
          <div className='g-room-table-wrap'>
            <table className='g-room-table'>
              <thead>
                <tr>
                  <th>Room Name</th>
                  <th>Players</th>
                  <th>Map Size</th>
                  <th>Speed</th>
                  <th>Terrain (M/C/S)</th>
                  <th>Modifiers</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {roomList.map((room) => (
                  <tr key={room.id}>
                    <td>{room.roomName}</td>
                    <td>
                      {room.players.length}/{room.maxPlayers}
                    </td>
                    <td>
                      {room.mapWidth.toFixed(2)} × {room.mapHeight.toFixed(2)}
                    </td>
                    <td>{room.gameSpeed}×</td>
                    <td>
                      {room.mountain.toFixed(2)} / {room.city.toFixed(2)} /{' '}
                      {room.swamp.toFixed(2)}
                    </td>
                    <td className='g-gold'>
                      {[
                        room.fogOfWar && 'Fog',
                        room.revealKing && 'King',
                        room.warringStatesMode && 'States',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </td>
                    <td>
                      <span
                        className={`g-room-status${room.gameStarted ? ' active' : ''}`}
                      >
                        {room.gameStarted ? 'Playing' : 'Waiting'}
                      </span>
                    </td>
                    <td>
                      <button
                        className='g-button g-button-blue'
                        disabled={
                          busy ||
                          room.gameStarted ||
                          room.players.length >= room.maxPlayers
                        }
                        onClick={() => void joinRoom(room.id)}
                      >
                        Join
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loading ? (
              <div className='g-empty'>Loading rooms…</div>
            ) : roomList.length === 0 ? (
              <div className='g-empty'>
                {online
                  ? 'No rooms available. Create the first battle.'
                  : 'Server unavailable. Retrying…'}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
