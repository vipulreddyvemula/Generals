import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import {
  BattlefieldBackdrop,
  PageFrame,
  PageTitle,
} from '@/components/GeneralsUi';
import Lobby from '@/components/Lobby';
import { useRooms } from '@/lib/use-rooms';

export default function PlayPage() {
  const roomBrowser = useRooms(5000);
  const { rooms, online } = roomBrowser;
  const roomList = Object.values(rooms);
  return (
    <PageFrame
      footerStats
      roomCount={roomList.length}
      playerCount={roomList.reduce(
        (count, room) => count + room.players.filter((player) => !player.disconnected).length,
        0
      )}
      online={online}
    >
      <Head>
        <title>Play — GENERALS</title>
      </Head>
      <BattlefieldBackdrop compact>
        <PageTitle
          title='PLAY'
          subtitle='Create a room or join an existing one.'
        />
      </BattlefieldBackdrop>
      <Lobby roomBrowser={roomBrowser} />
    </PageFrame>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return { props: { ...(await serverSideTranslations(locale)) } };
}
