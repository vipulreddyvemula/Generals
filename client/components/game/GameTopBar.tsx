import { useEffect, useState } from 'react';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckIcon from '@mui/icons-material/Check';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { Brand, CrownMark, HowToPlayModal, Status } from '@/components/GeneralsUi';
import { InGameTutorial } from '@/components/InGameTutorial';
import { useGame } from '@/context/GameContext';

export default function GameTopBar({
  onSurrender,
}: {
  onSurrender: () => void;
}) {
  const { room, turnsCount, initGameInfo, socketRef } = useGame();
  const [ping, setPing] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [htpOpen, setHtpOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  
  useEffect(() => {
    if (!localStorage.getItem('generals_tutorial_completed')) {
      setTutorialOpen(true);
      localStorage.setItem('generals_tutorial_completed', 'true');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const started = performance.now();
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SERVER_API}/ping`
        );
        if (!response.ok) throw new Error('Offline');
        if (alive) setPing(Math.round(performance.now() - started));
      } catch {
        if (alive) setPing(null);
      }
    };
    check();
    const timer = window.setInterval(check, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((turnsCount * 0.5) / (room.gameSpeed || 1))
  );
  const clock = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(elapsedSeconds % 60).padStart(2, '0')}`;
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
    <header className='g-game-topbar'>
      <div className='g-game-top-left'>
        <div className='g-game-brand'>
          <CrownMark />
          <Brand />
        </div>
        <div className='g-game-room-meta'>
          <div>
            Room: {room.roomName}{' '}
            <button onClick={copyCode} aria-label='Copy room code'>
              {copied ? <CheckIcon /> : <ContentCopyOutlinedIcon />}
            </button>
          </div>
          <small>
            Map:{' '}
            {initGameInfo
              ? `${initGameInfo.mapWidth} × ${initGameInfo.mapHeight}`
              : '—'}{' '}
            <span>|</span> Speed: {room.gameSpeed}×
          </small>
        </div>
      </div>
      <div className='g-game-clock'>
        <b>
          <HourglassEmptyOutlinedIcon />
          Turn {Math.floor(turnsCount / 2)}
        </b>
        <strong>{clock}</strong>
      </div>
      <div className='g-game-top-right'>
        <div className='g-game-status'>
          <Status online={socketRef.current?.connected && ping !== null} />
          <span>
            <SignalCellularAltIcon />
            {ping === null ? '—' : `${ping} ms`}
          </span>
        </div>
        <div className='g-match-settings-wrap'>
          <button
            className='g-button g-button-outline g-icon-button'
            onClick={() => setSettingsOpen((open) => !open)}
            aria-label='Match settings'
          >
            <SettingsOutlinedIcon />
          </button>
          {settingsOpen && (
            <div className='g-match-settings-popover'>
              <b>Match settings</b>
              <p>
                Room {room.id} · {room.players.length}/{room.maxPlayers} players
              </p>
              <p>
                Speed {room.gameSpeed}× ·{' '}
                {room.fogOfWar ? 'Fog of War' : 'Visible map'}
              </p>
            </div>
          )}
        </div>
        <button
          className='g-button g-button-outline g-icon-button'
          onClick={() => setHtpOpen(true)}
          aria-label='How to Play'
          title='How to Play'
        >
          <HelpOutlineIcon />
        </button>
        <button
          className='g-button g-button-outline g-icon-button'
          onClick={() => setTutorialOpen(true)}
          aria-label='Tutorial'
          title='Tutorial'
        >
          <SchoolOutlinedIcon />
        </button>
        <button className='g-button g-button-danger' onClick={onSurrender}>
          <FlagOutlinedIcon />
          Surrender
        </button>
      </div>
    </header>
    <HowToPlayModal open={htpOpen} onClose={() => setHtpOpen(false)} />
    <InGameTutorial run={tutorialOpen} onFinish={() => setTutorialOpen(false)} />
    </>
  );
}
