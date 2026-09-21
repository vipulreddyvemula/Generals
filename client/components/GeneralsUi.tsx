import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
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
        className='g-modal g-modal-htp'
        role='dialog'
        aria-modal='true'
        aria-label='How to Play'
        onClick={(event) => event.stopPropagation()}
      >
        <button className='g-modal-close' onClick={onClose} aria-label='Close'>
          ×
        </button>
        <h2>HOW TO PLAY</h2>
        <div className='g-modal-htp-body'>
          <h3>1. Your Goal</h3>
          <p>
            Capture enemy territory and defeat their <b>General</b>. The last
            surviving General wins.
          </p>

          <h3>2. Your General</h3>
          <p>
            Your General is your most important tile. <b>Protect it!</b>
          </p>
          <p>
            If an enemy captures your General, you are eliminated from the game.
          </p>

          <h3>3. Move Your Soldiers</h3>
          <p>
            Select one of your owned tiles, then select an <b>adjacent tile</b>{' '}
            to move your soldiers.
          </p>
          <p>
            You can move through your own territory or attack an enemy tile.
          </p>
          <p>
            You can also use <b>W / A / S / D</b> to move around the map.
          </p>
          <p>
            You can move <b>50% of the soldiers on a tile</b> when needed. Press{' '}
            <b>Z</b> or <b>double-click</b> to toggle 50% movement.
          </p>
          <p>
            You <b>cannot move diagonally</b> or move through <b>Mountains</b>.
          </p>

          <h3>4. Grow Your Army</h3>
          <p>Your army grows over time:</p>
          <ul>
            <li>
              <b>General:</b> Produces <b>1 soldier every 16 seconds</b>
            </li>
            <li>
              <b>Plain tile:</b> Produces <b>1 soldier every 400 seconds</b>
            </li>
          </ul>

          <h3>5. Capture Territory</h3>
          <p>Send your soldiers into an enemy-controlled tile to attack it.</p>
          <p>
            If you have more soldiers than the defender, you capture the tile
            and the remaining soldiers stay there.
          </p>
          <div className='g-htp-example'>
            <span>Example</span>
            <p>
              You attack with <b>8 soldiers</b> against{' '}
              <b>5 defending soldiers</b>.
            </p>
            <p>
              You capture the tile with <b>3 soldiers remaining</b>.
            </p>
          </div>

          <h3>6. Commander</h3>
          <p>
            Complete <b>Math</b> and <b>Codeforces</b> challenges to earn{' '}
            <b>Energy</b>.
          </p>
          <p>Spend your Energy to activate these powerful abilities:</p>
          <ul>
            <li>
              <b>Scout — 20 Energy:</b> Reveals a <b>5×5 area</b> around the
              selected location.
            </li>
            <li>
              <b>Airstrike — 40 Energy:</b> Reduces enemy troops by <b>half</b>{' '}
              within a <b>3×3 area</b> around the selected location.
            </li>
            <li>
              <b>Reinforce — 50 Energy:</b> Adds <b>40 soldiers</b> to one of
              your owned tiles.
            </li>
          </ul>

          <h3>7. Victory</h3>
          <p>
            Capture the enemy <b>General</b> to eliminate that player.
          </p>

          <h3>Keyboard Controls</h3>
          <div className='g-htp-table-wrap'>
            <table className='g-htp-table'>
              <thead>
                <tr>
                  <th>Function</th>
                  <th>Keyboard</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Move Around</td>
                  <td>
                    <b>W / A / S / D</b>
                  </td>
                </tr>
                <tr>
                  <td>Move on Mobile</td>
                  <td>
                    <b>Touch &amp; Drag</b>
                  </td>
                </tr>
                <tr>
                  <td>Open Chat</td>
                  <td>
                    <b>Enter</b>
                  </td>
                </tr>
                <tr>
                  <td>Undo Move</td>
                  <td>
                    <b>E</b>
                  </td>
                </tr>
                <tr>
                  <td>Clear Queued Moves</td>
                  <td>
                    <b>Q</b>
                  </td>
                </tr>
                <tr>
                  <td>Select General</td>
                  <td>
                    <b>G</b>
                  </td>
                </tr>
                <tr>
                  <td>Center on Home</td>
                  <td>
                    <b>H</b>
                  </td>
                </tr>
                <tr>
                  <td>Center Map</td>
                  <td>
                    <b>C</b>
                  </td>
                </tr>
                <tr>
                  <td>Toggle 50%</td>
                  <td>
                    <b>Z</b> / <b>Double Click</b>
                  </td>
                </tr>
                <tr>
                  <td>Set Zoom Preset</td>
                  <td>
                    <b>1 / 2 / 3</b>
                  </td>
                </tr>
                <tr>
                  <td>Zoom In / Out</td>
                  <td>
                    <b>Mouse Wheel</b>
                  </td>
                </tr>
                <tr>
                  <td>Surrender</td>
                  <td>
                    <b>Escape</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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
            <button onClick={() => setRulesOpen(true)}>
              <MenuBookOutlinedIcon />
              How to Play
            </button>
          </nav>
          <div className='g-header-right'>
            <Status online={online} />
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
