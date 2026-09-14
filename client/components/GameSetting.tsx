import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { MenuItem, Select } from '@mui/material';
import { useGame } from '@/context/GameContext';
import {
  ColorArr,
  forceStartOK,
  MaxTeamNum,
  SpeedOptions,
} from '@/lib/constants';
import { pendingRoomSettingsKey, PendingRoomSettings } from './Lobby';
import { BattlefieldBackdrop, PageFrame } from './GeneralsUi';

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='g-setting-row'>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export default function GameSetting({ chat }: { chat?: ReactNode }) {
  const router = useRouter();
  const { room, socketRef, myPlayerId, team } = useGame();
  const [copied, setCopied] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [leaving, setLeaving] = useState(false);
  const me = useMemo(
    () => room.players.find((player) => player.id === myPlayerId),
    [room.players, myPlayerId]
  );
  const isHost = Boolean(me?.isRoomHost);
  const activePlayers = room.players.filter(
    (player) => player.team !== MaxTeamNum + 1
  );
  const readyNeeded = forceStartOK[activePlayers.length] || 2;

  useEffect(() => {
    setNameDraft(room.roomName);
  }, [room.roomName]);

  useEffect(() => {
    // The create form precedes room membership. Apply its validated settings once
    // the creator has joined as host, using the existing Socket.IO setting event.
    if (!isHost || room.gameStarted || !socketRef.current?.connected) return;
    const key = pendingRoomSettingsKey(room.id);
    const saved = sessionStorage.getItem(key);
    if (!saved) return;
    sessionStorage.removeItem(key);
    try {
      const settings = JSON.parse(saved) as PendingRoomSettings;
      (Object.keys(settings) as (keyof PendingRoomSettings)[]).forEach(
        (property) => {
          if (settings[property] !== room[property])
            socketRef.current.emit(
              'change_room_setting',
              property,
              settings[property]
            );
        }
      );
    } catch {
      /* Invalid local draft is discarded; server defaults remain. */
    }
  }, [isHost, room, socketRef]);

  const emitSetting = (
    property: keyof PendingRoomSettings,
    value: string | number | boolean
  ) => {
    if (!isHost || room.gameStarted) return;
    socketRef.current.emit('change_room_setting', property, value);
  };

  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    const socket = socketRef.current;
    const finish = (confirmed: boolean) => {
      if (confirmed) localStorage.removeItem(`generals.player-session.${room.id}`);
      socket?.disconnect();
      void router.push('/play');
    };
    if (!socket?.connected) {
      finish(false);
      return;
    }
    socket.timeout(1500).emit('leave_room', (error: Error | null, result?: { ok: boolean }) => {
      if (!error && result?.ok === false) {
        setLeaving(false);
        return;
      }
      finish(!error && result?.ok === true);
    });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PageFrame online={Boolean(socketRef.current?.connected)}>
      <BattlefieldBackdrop compact>
        <div className='g-wait-banner'>
          <button className='g-wait-back' onClick={leave}>
            <ArrowBackIcon fontSize='small' />
            Back to Rooms
          </button>
          <h1>
            Room: {room.roomName}{' '}
            <span className='g-status-badge'>Waiting for Players</span>
          </h1>
          <div className='g-room-code'>
            Room Code: <b>{room.id}</b>
            <button
              className='g-button g-button-outline'
              onClick={copyCode}
              aria-label='Copy room code'
            >
              <ContentCopyOutlinedIcon fontSize='small' />
            </button>
          </div>
          <p>
            {copied
              ? 'Copied to clipboard'
              : 'Share this code with your friends to invite them.'}
          </p>
        </div>
      </BattlefieldBackdrop>
      <main className='g-wait-main'>
        <div className='g-wait-grid'>
          <section className='g-panel g-wait-players'>
            <h2>
              <PeopleOutlineIcon />
              Players ({room.players.length} / {room.maxPlayers})
            </h2>
            <div className='g-player-slots'>
              {Array.from({ length: room.maxPlayers }, (_, index) => {
                const player = room.players[index];
                return (
                  <div className='g-player-slot' key={player?.id || index}>
                    <b>{index + 1}</b>
                    {player ? (
                      <>
                        <i style={{ background: ColorArr[player.color] }} />
                        <div>
                          <strong>
                            {player.username}{' '}
                            {player.isRoomHost && <small>Host</small>}
                          </strong>
                          <span className={player.forceStart ? 'ready' : ''}>
                            {player.disconnected
                              ? 'Disconnected'
                              : player.team === MaxTeamNum + 1
                                ? 'Spectator'
                                : player.forceStart
                                  ? 'Ready'
                                  : 'Not Ready'}
                          </span>
                        </div>
                        {player.isRoomHost && (
                          <MilitaryTechOutlinedIcon className='g-player-crown' />
                        )}
                        {isHost && player.id !== myPlayerId && (
                          <button
                            title='Transfer host'
                            className='g-host-transfer'
                            onClick={() =>
                              socketRef.current.emit('change_host', player.id)
                            }
                          >
                            Make host
                          </button>
                        )}
                      </>
                    ) : (
                      <span className='g-muted'>Waiting for player...</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className='g-team-picker'>
              <label htmlFor='team-select'>Your team</label>
              <Select
                id='team-select'
                value={team || ''}
                disabled={!me || room.gameStarted}
                onChange={(event) =>
                  socketRef.current.emit('set_team', Number(event.target.value))
                }
                size='small'
                displayEmpty
                sx={{
                  color: '#f0f5f8',
                  background: 'rgba(3, 13, 21, .55)',
                  borderRadius: '5px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(104,148,171,.34)' },
                  '& .MuiSvgIcon-root': { color: '#d9b765' },
                }}
                MenuProps={{ PaperProps: { sx: { maxHeight: 290, background: '#0b1a27', color: '#f0f5f8', border: '1px solid rgba(104,148,171,.34)' } } }}
              >
                <MenuItem value='' disabled>
                  Choose team
                </MenuItem>
                {Array.from({ length: MaxTeamNum }, (_, index) => (
                  <MenuItem key={index} value={index + 1}>
                    Team {index + 1}
                  </MenuItem>
                ))}
                <MenuItem value={MaxTeamNum + 1}>Spectators</MenuItem>
              </Select>
            </div>
          </section>
          <section className='g-wait-chat'>{chat}</section>
          <section className='g-panel g-wait-settings'>
            <h2>
              <SettingsOutlinedIcon />
              Room Settings
            </h2>
            <SettingRow
              label='Game Mode'
              value={room.warringStatesMode ? 'Warring States' : 'Standard'}
            />
            <SettingRow label='Game Speed' value={`${room.gameSpeed}×`} />
            <SettingRow label='Map Width' value={room.mapWidth.toFixed(2)} />
            <SettingRow label='Map Height' value={room.mapHeight.toFixed(2)} />
            <SettingRow
              label='Mountains Density'
              value={room.mountain.toFixed(2)}
            />
            <SettingRow label='Cities Density' value={room.city.toFixed(2)} />
            <SettingRow label='Swamps Density' value={room.swamp.toFixed(2)} />
            <SettingRow
              label='Players'
              value={`${room.players.length}/${room.maxPlayers}`}
            />
            {isHost && (
              <button
                className='g-button g-button-outline g-edit-settings'
                onClick={() => setShowEditor((open) => !open)}
              >
                {showEditor ? 'Close Settings' : 'Edit Settings'}
              </button>
            )}
            {isHost && showEditor && (
              <div className='g-settings-editor'>
                <label>
                  Room Name
                  <input
                    className='g-input'
                    maxLength={20}
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={() => {
                      if (nameDraft.trim())
                        emitSetting('roomName', nameDraft.trim());
                    }}
                  />
                </label>
                <label>
                  Max Players
                  <select
                    className='g-select'
                    value={room.maxPlayers}
                    onChange={(event) =>
                      emitSetting('maxPlayers', Number(event.target.value))
                    }
                  >
                    {Array.from({ length: 11 }, (_, index) => index + 2).map(
                      (count) => (
                        <option key={count} value={count}>
                          {count}
                        </option>
                      )
                    )}
                  </select>
                </label>
                <label>
                  Game Speed
                  <select
                    className='g-select'
                    value={room.gameSpeed}
                    onChange={(event) =>
                      emitSetting('gameSpeed', Number(event.target.value))
                    }
                  >
                    {SpeedOptions.map((speed) => (
                      <option key={speed} value={speed}>
                        {speed}×
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    'mapWidth',
                    'mapHeight',
                    'mountain',
                    'city',
                    'swamp',
                  ] as const
                ).map((key) => (
                  <label key={`${key}-${room[key]}`}>
                    {key}
                    <input
                      type='range'
                      min='0'
                      max='1'
                      step='.05'
                      defaultValue={room[key]}
                      onPointerUp={(event) =>
                        emitSetting(key, Number(event.currentTarget.value))
                      }
                      onKeyUp={(event) =>
                        emitSetting(key, Number(event.currentTarget.value))
                      }
                    />
                  </label>
                ))}
                {(
                  [
                    'fogOfWar',
                    'deathSpectator',
                    'revealKing',
                    'warringStatesMode',
                  ] as const
                ).map((key) => (
                  <label className='g-editor-check' key={key}>
                    <input
                      type='checkbox'
                      checked={room[key]}
                      onChange={(event) =>
                        emitSetting(key, event.target.checked)
                      }
                    />
                    {key}
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>
        <div className='g-wait-actions'>
          <div>
            <button
              className={`g-button ${me?.forceStart ? 'g-button-outline' : 'g-button-ready'}`}
              disabled={!me || me.team === MaxTeamNum + 1}
              onClick={() => socketRef.current.emit('force_start')}
            >
              <CheckCircleOutlineIcon />
              {me?.forceStart ? 'Not Ready' : 'Ready'}
            </button>
            <small>
              {room.forceStartNum}/{readyNeeded} ready votes; match starts automatically
            </small>
          </div>
          <div>
            <button
              className='g-button'
              style={{
                background: room.forceStartNum >= readyNeeded ? 'rgba(40,104,216,0.15)' : 'rgba(8, 21, 33, 0.7)',
                borderColor: room.forceStartNum >= readyNeeded ? 'var(--g-border)' : 'transparent',
                color: room.forceStartNum >= readyNeeded ? 'var(--g-muted)' : 'rgba(255,255,255,0.4)',
                cursor: room.forceStartNum >= readyNeeded ? 'default' : 'not-allowed'
              }}
              role='status'
            >
              <PlayArrowIcon /> Start Game
            </button>
            <small>Host can start when all players are ready</small>
          </div>
          <div>
            <button className='g-button g-button-danger' onClick={leave}>
              <LogoutOutlinedIcon />
              Leave Room
            </button>
            <small>You can leave anytime</small>
          </div>
        </div>
      </main>
    </PageFrame>
  );
}
