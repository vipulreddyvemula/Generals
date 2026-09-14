import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import {
  BattlefieldBackdrop,
  Brand,
  HowToPlayModal,
  Ornament,
  PageFrame,
} from '@/components/GeneralsUi';
import { useRooms } from '@/lib/use-rooms';

export default function Home() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const { rooms, online } = useRooms(10000);
  const roomList = Object.values(rooms);
  const playerCount = roomList.reduce(
    (count, room) => count + room.players.filter((player) => !player.disconnected).length,
    0
  );
  return (
    <PageFrame online={online}>
      <Head>
        <title>Home — GENERALS</title>
      </Head>
      <BattlefieldBackdrop>
        <main className='g-home-main'>
          <Ornament />
          <h1>
            <Brand large />
          </h1>
          <p className='g-hero-tagline'>Strategy. Territory. Victory.</p>
          <div className='g-hero-divider'>
            <i />◆<i />
          </div>
          <p className='g-hero-description'>
            Join a game, command your army, and conquer the map.
          </p>
          <div className='g-hero-actions'>
            <Link
              href='/player-details'
              className='g-button g-button-blue g-hero-action'
            >
              <GavelOutlinedIcon />
              <span>
                <b>Play Now</b>
                <small>Find or Create a Room</small>
              </span>
            </Link>
            <button
              className='g-button g-button-outline g-hero-action'
              onClick={() => setRulesOpen(true)}
            >
              <MenuBookOutlinedIcon />
              <span>
                <b>How to Play</b>
                <small>Learn the Basics</small>
              </span>
            </button>
          </div>
          <div className='g-panel g-stat-strip'>
            <div className='g-mini-stat green'>
              <PeopleOutlineIcon />
              <div>
                <span>Players Online</span>
                <strong>{online ? playerCount : '—'}</strong>
                <small>Across all rooms</small>
              </div>
            </div>
            <div className='g-mini-stat'>
              <SportsEsportsOutlinedIcon />
              <div>
                <span>Active Rooms</span>
                <strong>
                  {online ? roomList.length : '—'}
                </strong>
                <small>Open and ongoing rooms</small>
              </div>
            </div>
            <div className='g-mini-stat green'>
              <SignalCellularAltIcon />
              <div>
                <span>Server Status</span>
                <strong>{online ? 'Online' : 'Offline'}</strong>
                <small>
                  {online ? 'Ready to play' : 'Trying to reconnect'}
                </small>
              </div>
            </div>
          </div>
        </main>
      </BattlefieldBackdrop>
      <HowToPlayModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </PageFrame>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return { props: { ...(await serverSideTranslations(locale)) } };
}
