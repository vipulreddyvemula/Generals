import { useEffect, useState } from 'react';
import CheckIcon from '@mui/icons-material/Check';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import { Brand, CrownMark, HowToPlayModal, Status } from '@/components/GeneralsUi';
import { useGame } from '@/context/GameContext';
import { copyToClipboard } from '@/lib/utils';
import { RoomUiStatus } from '@/lib/types';
import { MaxTeamNum } from '@/lib/constants';

export default function GameTopBar({
  onSurrender,
}: {
  onSurrender: () => void;
}) {
  const { room, turnsCount, initGameInfo, socketRef, isSurrendered, myPlayerId, team, roomUiStatus } = useGame();

  const isDead = room?.players?.find((p) => p.id === myPlayerId)?.isDead || false;

  const showExitButton =
    isSurrendered ||
    isDead ||
    team === MaxTeamNum + 1 ||
    roomUiStatus === RoomUiStatus.gameOverConfirm;

  const [ping, setPing] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [htpOpen, setHtpOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const started = performance.now();
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_API}/ping`);
        if (!response.ok) throw new Error('Offline');
        if (alive) setPing(Math.round(performance.now() - started));
      } catch {
        if (alive) setPing(null);
      }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  // Close settings popover when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.g-match-settings-wrap')) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  const elapsedSeconds = Math.max(0, Math.floor((turnsCount * 0.5) / (room.gameSpeed || 1)));
  const minutes = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;
  const clock = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const copyCode = async () => {
    const success = await copyToClipboard(room.id);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } else {
      setCopied(false);
    }
  };

  return (
    <>
      <header className='g-game-topbar'>
        {/* Left — brand only */}
        <div className='g-game-top-left'>
          <div className='g-game-brand'>
            <CrownMark />
            <Brand />
          </div>
        </div>

        {/* Center — elapsed time only */}
        <div className='g-game-clock'>
          <small className='g-game-clock-label'>ELAPSED</small>
          <strong>{clock}</strong>
        </div>

        {/* Right — status, settings, how to play, surrender */}
        <div className='g-game-top-right'>
          <div className='g-game-status'>
            <Status online={socketRef.current?.connected && ping !== null} />
            <span>
              <SignalCellularAltIcon />
              {ping === null ? '—' : `${ping} ms`}
            </span>
          </div>

          {/* Settings — contains all room meta */}
          <div className='g-match-settings-wrap'>
            <button
              className='g-button g-button-outline g-icon-button'
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label='Match settings'
              title='Settings'
            >
              <SettingsOutlinedIcon />
            </button>
            {settingsOpen && (
              <div className='g-match-settings-popover'>
                <b>Match Settings</b>
                <div className='g-settings-row'>
                  <span className='g-settings-label'>Room</span>
                  <span className='g-settings-value'>
                    {room.roomName}
                    <button
                      onClick={copyCode}
                      aria-label='Copy room code'
                      className={`g-settings-copy${copied ? ' g-copied' : ''}`}
                    >
                      {copied ? <CheckIcon /> : <ContentCopyOutlinedIcon />}
                    </button>
                  </span>
                </div>
                <div className='g-settings-row'>
                  <span className='g-settings-label'>Map</span>
                  <span className='g-settings-value'>
                    {initGameInfo ? `${initGameInfo.mapWidth} × ${initGameInfo.mapHeight}` : '—'}
                  </span>
                </div>
                <div className='g-settings-row'>
                  <span className='g-settings-label'>Speed</span>
                  <span className='g-settings-value'>{room.gameSpeed}×</span>
                </div>
                <div className='g-settings-row'>
                  <span className='g-settings-label'>Players</span>
                  <span className='g-settings-value'>{room.players.length}/{room.maxPlayers}</span>
                </div>
                <div className='g-settings-row'>
                  <span className='g-settings-label'>Fog</span>
                  <span className='g-settings-value'>{room.fogOfWar ? 'On' : 'Off'}</span>
                </div>
              </div>
            )}
          </div>

          {/* How to Play — text label visible */}
          <button
            className='g-button g-button-outline g-htp-button'
            onClick={() => setHtpOpen(true)}
            aria-label='How to Play'
          >
            How to Play
          </button>

          {/* Surrender / Exit */}
          <button className='g-button g-button-danger' onClick={onSurrender}>
            <FlagOutlinedIcon />
            {showExitButton ? 'Exit' : 'Surrender'}
          </button>
        </div>
      </header>
      <HowToPlayModal open={htpOpen} onClose={() => setHtpOpen(false)} />
    </>
  );
}
