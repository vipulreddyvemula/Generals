import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LinkIcon from '@mui/icons-material/Link';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { Room } from '@/lib/types';
import { useRooms } from '@/lib/use-rooms';
import { readPlayerProfile, savePlayerProfile } from '@/lib/player-profile';

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
  | 'commanderDifficultyMode'
  | 'commanderClistTier'
  | 'commanderCodeforcesRating'
>;

export function pendingRoomSettingsKey(roomId: string) {
  return `generals.pending-room-settings.${roomId}`;
}

const defaultSettings: PendingRoomSettings = {
  roomName: '',
  maxPlayers: 4,
  gameSpeed: 1,
  mapWidth: 0.5,
  mapHeight: 0.5,
  mountain: 0.5,
  city: 0,
  swamp: 0,
  fogOfWar: true,
  deathSpectator: true,
  revealKing: false,
  warringStatesMode: false,
  commanderDifficultyMode: 'CLIST_BAND',
  commanderClistTier: 0,
  commanderCodeforcesRating: 800,
};

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

function RoomSettings({
  settings,
  update,
}: {
  settings: PendingRoomSettings;
  update: <K extends keyof PendingRoomSettings>(
    key: K,
    value: PendingRoomSettings[K]
  ) => void;
}) {
  return (
    <>
      <div className='g-settings-section'>
        <h3>Battlefield</h3>
        <label className='g-form-row'>
          <span>Room Name</span>
          <input
            className='g-input'
            maxLength={20}
            value={settings.roomName}
            onChange={(event) => update('roomName', event.target.value)}
            placeholder='Name your battle'
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
                {speed}× {speed === 1 ? 'Normal' : speed < 1 ? 'Slow' : 'Fast'}
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
      </div>
      <div className='g-settings-section'>
        <h3>Game Rules</h3>
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
      <div className='g-settings-section g-commander-settings'>
        <h3>Commander Problems</h3>
        <p>Choose one difficulty system for this room.</p>
        <div className='g-difficulty-mode'>
          <label>
            <input
              type='radio'
              name='difficulty-mode'
              checked={settings.commanderDifficultyMode === 'CLIST_BAND'}
              onChange={() => update('commanderDifficultyMode', 'CLIST_BAND')}
            />{' '}
            CList Band Mode
          </label>
          <label>
            <input
              type='radio'
              name='difficulty-mode'
              checked={settings.commanderDifficultyMode === 'CF_RATING'}
              onChange={() => update('commanderDifficultyMode', 'CF_RATING')}
            />{' '}
            CF Mode
          </label>
        </div>
        {settings.commanderDifficultyMode === 'CLIST_BAND' ? (
          <label className='g-tier-select'>
            <span>Difficulty Tier</span>
            <select
              className='g-select'
              value={settings.commanderClistTier}
              onChange={(event) =>
                update('commanderClistTier', Number(event.target.value))
              }
            >
              <option value={0}>Super Easy · CList 0–200</option>
              <option value={1}>Easy · CList 201–600</option>
              <option value={2}>Medium · CList 601–1000</option>
              <option value={3}>Hard · CList 1001–1500</option>
              <option value={4}>Very Hard · CList 1501+</option>
            </select>
            <small>
              Problems span this CList-derived rating range — suited to casual
              play.
            </small>
          </label>
        ) : (
          <label className='g-cf-rating'>
            <span>
              <b>CF Rating</b>
              <b>{settings.commanderCodeforcesRating}</b>
            </span>
            <input
              type='range'
              min='800'
              max='3500'
              step='100'
              value={settings.commanderCodeforcesRating}
              onChange={(event) =>
                update('commanderCodeforcesRating', Number(event.target.value))
              }
            />
            <small>
              800 (newbie)
              <i />
              3500 (legendary)
            </small>
          </label>
        )}
      </div>
    </>
  );
}

export type RoomFlowMode = 'create' | 'join' | 'tutorial';

export function RoomFlow({
  mode,
  roomBrowser,
}: {
  mode: RoomFlowMode;
  roomBrowser: ReturnType<typeof useRooms>;
}) {
  const router = useRouter();
  const { rooms, loading, online, refresh } = roomBrowser;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] =
    useState<PendingRoomSettings>(defaultSettings);
  const update = <K extends keyof PendingRoomSettings>(
    key: K,
    value: PendingRoomSettings[K]
  ) => setSettings((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const saved = readPlayerProfile();
    setName(saved.name);
    setHandle(saved.handle);
  }, []);

  const saveIdentity = (): boolean => {
    const trimmedName = name.trim();
    const trimmedHandle = handle.trim();
    if (!trimmedName) {
      setError('Enter a commander name to continue.');
      return false;
    }
    if (!trimmedHandle) {
      setError('Enter a Codeforces handle to continue.');
      return false;
    }
    if (!/^[A-Za-z0-9_.-]{3,24}$/.test(trimmedHandle)) {
      setError(
        'Codeforces handles must be 3–24 letters, numbers, underscores, dots, or hyphens.'
      );
      return false;
    }
    savePlayerProfile({ name: trimmedName, handle: trimmedHandle });
    return true;
  };

  const createRoom = async () => {
    if (!saveIdentity()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_API}/create_room`
      );
      const result = await response.json();
      if (!response.ok || typeof result.roomId !== 'string')
        throw new Error(result.message || 'Could not create the room.');
      sessionStorage.setItem(
        pendingRoomSettingsKey(result.roomId),
        JSON.stringify({
          ...settings,
          roomName: settings.roomName.trim() || 'Untitled',
        })
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
    if (!saveIdentity()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_API}/get_rooms`
      );
      if (!response.ok)
        throw new Error('Could not check that room. Try again.');
      const latestRooms = (await response.json()) as Record<string, Room>;
      const room = Object.values(latestRooms).find(
        (entry) => entry.id.toLowerCase() === roomId.trim().toLowerCase()
      );
      if (!room) throw new Error('No room was found with that code.');
      if (room.gameStarted) throw new Error('This match has already started.');
      if (room.players.length >= room.maxPlayers)
        throw new Error('This room is full.');
      await router.push(`/rooms/${room.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not join the room.'
      );
      setBusy(false);
    }
  };

  const startTutorial = async () => {
    if (!saveIdentity()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_API}/create_sandbox`
      );
      const data = await response.json();
      if (!response.ok || !data.success || !data.roomId)
        throw new Error(data.message || 'Failed to create the tutorial room.');
      await router.push(`/rooms/${data.roomId}?tutorial=true`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not start the tutorial.'
      );
      setBusy(false);
    }
  };

  if (mode === 'create')
    return (
      <section className='g-panel g-flow-card'>
        <div className='g-flow-card-inner'>
        <header className='g-flow-heading'>
          <div>
            <h2>Create a Room</h2>
            <p>Set up your battlefield.</p>
          </div>
          <button
            className='g-settings-trigger'
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsOutlinedIcon /> Settings
          </button>
        </header>
        <div className='g-flow-fields'>
          <label className='g-flow-field'>
            <span>Commander Name</span>
            <input
              className='g-input'
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='Enter your name'
            />
          </label>
          <label className='g-flow-field'>
            <span>Codeforces Handle</span>
            <input
              className='g-input'
              maxLength={24}
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder='Enter your Codeforces handle'
            />
          </label>
        </div>
        <div className='g-flow-summary'>
          <span>{settings.maxPlayers} players</span>
          <i />
          <span>{settings.gameSpeed}× speed</span>
          <i />
          <span>
            {settings.commanderDifficultyMode === 'CF_RATING'
              ? `CF ${settings.commanderCodeforcesRating}`
              : 'CList band'}
          </span>
        </div>
        <button
          className='g-button g-flow-submit'
          disabled={busy || !online}
          onClick={() => void createRoom()}
        >
          <AddIcon />
          {busy ? 'Creating…' : 'Create Room'}
          <ArrowForwardIcon className='g-button-arrow' />
        </button>
        {!online && (
          <p className='g-error' role='alert'>
            Server unavailable. Reconnecting…
          </p>
        )}
        {error && (
          <p className='g-error' role='alert'>
            {error}
          </p>
        )}
        </div>
        {settingsOpen && (
          <div
            className='g-modal-backdrop'
            onClick={() => setSettingsOpen(false)}
            role='presentation'
          >
            <section
              className='g-modal g-room-settings-modal'
              role='dialog'
              aria-modal='true'
              aria-label='Room settings'
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className='g-modal-close'
                onClick={() => setSettingsOpen(false)}
                aria-label='Close settings'
              >
                ×
              </button>
              <h2>Room Settings</h2>
              <p className='g-modal-intro'>
                Configure the battlefield before the room opens.
              </p>
              <div className='g-settings-scroll'>
                <RoomSettings settings={settings} update={update} />
              </div>
              <button
                className='g-button g-button-blue g-settings-done'
                onClick={() => setSettingsOpen(false)}
              >
                Done
              </button>
            </section>
          </div>
        )}
      </section>
    );

  if (mode === 'join')
    return (
      <section className='g-panel g-flow-card g-join-flow-card'>
        <div className='g-flow-card-inner'>
        <header className='g-flow-heading'>
          <div>
            <h2>Join a Room</h2>
            <p>Enter the room code to join an existing battle.</p>
          </div>
        </header>
        <div className='g-flow-fields'>
          <label className='g-flow-field'>
            <span>Commander Name</span>
            <input
              className='g-input'
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='Enter your name'
            />
          </label>
          <label className='g-flow-field'>
            <span>Codeforces Handle</span>
            <input
              className='g-input'
              maxLength={24}
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder='Enter your Codeforces handle'
            />
          </label>
          <label className='g-flow-field'>
            <span>Room Code</span>
            <input
              className='g-input g-room-code-input'
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder='Enter room code'
              autoComplete='off'
              onKeyDown={(event) => {
                if (event.key === 'Enter' && code.trim()) void joinRoom(code);
              }}
            />
          </label>
        </div>
        <button
          className='g-button g-flow-submit g-button-steel'
          disabled={!code.trim() || busy}
          onClick={() => void joinRoom(code)}
        >
          <LinkIcon />
          {busy ? 'Joining…' : 'Join Room'}
          <ArrowForwardIcon className='g-button-arrow' />
        </button>
        {error && (
          <p className='g-error' role='alert'>
            {error}
          </p>
        )}
        </div>
      </section>
    );

  if (mode === 'tutorial')
    return (
      <section className='g-panel g-flow-card'>
        <div className='g-flow-card-inner'>
        <header className='g-flow-heading'>
          <div>
            <h2>Interactive Tutorial</h2>
            <p>Learn by playing · Free practice with extra energy.</p>
          </div>
        </header>
        <div className='g-flow-fields'>
          <label className='g-flow-field'>
            <span>Commander Name</span>
            <input
              className='g-input'
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='Enter your name'
            />
          </label>
          <label className='g-flow-field'>
            <span>Codeforces Handle</span>
            <input
              className='g-input'
              maxLength={24}
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder='Enter your Codeforces handle'
            />
          </label>
        </div>
        <button
          className='g-button g-flow-submit'
          disabled={busy || !online}
          onClick={() => void startTutorial()}
        >
          <SchoolOutlinedIcon />
          {busy ? 'Starting…' : 'Start Tutorial'}
          <ArrowForwardIcon className='g-button-arrow' />
        </button>
        {!online && (
          <p className='g-error' role='alert'>
            Server unavailable. Reconnecting…
          </p>
        )}
        {error && (
          <p className='g-error' role='alert'>
            {error}
          </p>
        )}
        </div>
      </section>
    );

  return null;
}
