import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import {
  BattlefieldBackdrop,
  Brand,
  Ornament,
  PageFrame,
} from '@/components/GeneralsUi';
import { RoomFlow } from '@/components/Lobby';
import { useRooms } from '@/lib/use-rooms';

export default function JoinRoomPage() {
  const roomBrowser = useRooms(15000);
  return (
    <PageFrame online={roomBrowser.online}>
      <Head>
        <title>Join a Room — GENERALS</title>
      </Head>
      <BattlefieldBackdrop>
        <main className='g-details-main g-room-flow-main'>
          <Ornament />
          <h1>
            <Brand large />
          </h1>
          <p className='g-hero-tagline'>Strategy. Territory. Victory.</p>
          <RoomFlow mode='join' roomBrowser={roomBrowser} />
        </main>
      </BattlefieldBackdrop>
    </PageFrame>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return { props: { ...(await serverSideTranslations(locale)) } };
}
