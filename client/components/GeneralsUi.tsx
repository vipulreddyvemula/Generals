import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';

export function CrownMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox='0 0 64 48'
      aria-hidden='true'
      fill='currentColor'
    >
      <path d='M5 38 1 11l14 10L25 2l8 18L44 4l6 19 13-10-6 25H5Zm4 5h46v4H9v-4Z' />
    </svg>
  );
}

export function Brand({ large = false }: { large?: boolean }) {
  return (
    <span className={`g-brand${large ? ' g-brand-large' : ''}`}>GENERALS</span>
  );
}

export function Status({
  online = false,
  label,
}: {
  online?: boolean;
  label?: string;
}) {
  return (
    <span className={`g-status${online ? '' : ' offline'}`}>
      <i />
      {label || (online ? 'Server Online' : 'Server Offline')}
    </span>
  );
}

export function HowToPlayModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className='g-modal-backdrop' onClick={onClose} role='presentation'>
      <div
        className='g-modal'
        role='dialog'
        aria-modal='true'
        aria-label='How to Play'
        onClick={(event) => event.stopPropagation()}
      >
        <button className='g-modal-close' onClick={onClose} aria-label='Close'>
          ×
        </button>
        <h2>How to Play</h2>
        <p className='g-muted'>
          Claim territory, grow your army, and capture enemy generals.
        </p>
        <p>
          <b>1. Expand.</b> Select your territory, then choose an adjacent tile.
        </p>
        <p>
          <b>2. Command.</b> Armies increase each turn. Move all or half your
          forces.
        </p>
        <p>
          <b>3. Conquer.</b> Capture the opposing general while defending your
          own.
        </p>
      </div>
    </div>
  );
}

export function PageHeader({ online = false }: { online?: boolean }) {
  const router = useRouter();
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <>
      <header className='g-page-header'>
        <div className='g-header-inner'>
          <Link href='/' aria-label='Generals home'>
            <Brand />
          </Link>
          <nav>
            <Link className={router.pathname === '/' ? 'active' : ''} href='/'>
              <HomeOutlinedIcon />
              Home
            </Link>
            <Link
              className={router.pathname === '/play' ? 'active' : ''}
              href='/play'
            >
              <SportsEsportsOutlinedIcon />
              Play
            </Link>
            <button onClick={() => setRulesOpen(true)}>
              <MenuBookOutlinedIcon />
              How to Play
            </button>
          </nav>
          <div className='g-header-right'>
            <Status online={online} />
            <Link
              className='g-button g-button-blue g-header-join'
              href='/player-details'
            >
              Join Game
            </Link>
          </div>
        </div>
      </header>
      <HowToPlayModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}

export function PageFooter({
  stats,
  roomCount = 0,
  playerCount = 0,
  online = false,
}: {
  stats?: boolean;
  roomCount?: number;
  playerCount?: number;
  online?: boolean;
}) {
  return (
    <footer className='g-page-footer'>
      <div className='g-footer-inner'>
        <div className='g-footer-brand'>
          <Brand />
          <i />
          <span>Strategy. Territory. Victory.</span>
        </div>
        {stats ? (
          <div className='g-footer-stats'>
            <span>{playerCount} Players Online</span>
            <span>{roomCount} Active Rooms</span>
            <Status online={online} />
          </div>
        ) : (
          <span>v1.0.0</span>
        )}
      </div>
    </footer>
  );
}

export function PageFrame({
  children,
  footerStats,
  roomCount,
  playerCount,
  online,
}: {
  children: ReactNode;
  footerStats?: boolean;
  roomCount?: number;
  playerCount?: number;
  online?: boolean;
}) {
  return (
    <div className='generals-root g-page'>
      <PageHeader online={online} />
      {children}
      <PageFooter
        stats={footerStats}
        roomCount={roomCount}
        playerCount={playerCount}
        online={online}
      />
    </div>
  );
}

export function BattlefieldBackdrop({
  compact = false,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`g-backdrop${compact ? ' compact' : ''}`}>
      <div className='g-backdrop-shade' />
      <div className='g-backdrop-content'>{children}</div>
    </div>
  );
}

export function Ornament() {
  return (
    <div className='g-ornament'>
      <i />
      <CrownMark />
      <i />
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className='g-page-title'>
      <h1>{title}</h1>
      <i />
      <p>{subtitle}</p>
    </div>
  );
}
