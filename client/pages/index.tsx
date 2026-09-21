import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import {
  BattlefieldBackdrop,
  Brand,
  Ornament,
  PageFrame,
} from '@/components/GeneralsUi';
import { useRooms } from '@/lib/use-rooms';

export default function Home() {
  const { online } = useRooms(10000);
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof router.query.joinError === 'string') {
      setError(router.query.joinError);
      // Remove the query param so refreshing doesn't re-show the error
      void router.replace('/', undefined, { shallow: true });
    }
  }, [router, router.query.joinError]);

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
            <Link href='/create-room' className='g-hero-action g-hero-create'>
              <MilitaryTechOutlinedIcon />
              <span>
                <b>Create a Room</b>
                <small>Start a new battle</small>
              </span>
              <ArrowForwardIcon className='g-hero-action-arrow' />
            </Link>
            <Link href='/join-room' className='g-hero-action g-hero-join'>
              <GroupsOutlinedIcon />
              <span>
                <b>Join a Room</b>
                <small>Enter an existing game</small>
              </span>
              <ArrowForwardIcon className='g-hero-action-arrow' />
            </Link>
          </div>
          <Link
            href='/tutorial'
            className='g-home-tutorial'
            style={{ fontFamily: 'inherit' }}
          >
            <SchoolOutlinedIcon />
            <span>
              <b>Interactive Tutorial</b>
              <small>Learn by playing · Free practice with extra energy</small>
            </span>
            <ArrowForwardIcon />
          </Link>
          {error && (
            <div className='g-page-error-banner' role='alert'>
              <ErrorOutlineIcon />
              <span>{error}</span>
              <button
                className='g-page-error-banner-close'
                aria-label='Dismiss'
                onClick={() => setError('')}
              >
                <CloseIcon fontSize='inherit' />
              </button>
            </div>
          )}
        </main>
      </BattlefieldBackdrop>
    </PageFrame>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return { props: { ...(await serverSideTranslations(locale)) } };
}
