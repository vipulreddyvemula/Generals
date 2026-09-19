import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import {
  BattlefieldBackdrop,
  Brand,
  Ornament,
  PageFrame,
} from '@/components/GeneralsUi';
import { readPlayerProfile, savePlayerProfile } from '@/lib/player-profile';
import { useRooms } from '@/lib/use-rooms';

export default function PlayerDetails() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState('');
  const { online } = useRooms(15000);
  useEffect(() => {
    const saved = readPlayerProfile();
    setName(saved.name);
    setHandle(saved.handle);
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const trimmedHandle = handle.trim();
    if (trimmedHandle && !/^[A-Za-z0-9_.-]{3,24}$/.test(trimmedHandle)) {
      setError(
        'Codeforces handles must be 3–24 letters, numbers, underscores, dots, or hyphens.'
      );
      return;
    }
    setError('');
    savePlayerProfile({ name: trimmedName, handle: trimmedHandle });
    const next =
      typeof router.query.next === 'string' ? router.query.next : '/';
    router.push(
      next.startsWith('/') && !next.startsWith('//') ? next : '/'
    );
  };
  return (
    <PageFrame online={online}>
      <Head>
        <title>Player Details — GENERALS</title>
      </Head>
      <BattlefieldBackdrop>
        <main className='g-details-main'>
          <Ornament />
          <h1>
            <Brand large />
          </h1>
          <p className='g-hero-tagline'>Strategy. Territory. Victory.</p>
          <section className='g-panel g-details-card'>
            <header>
              <h2>Enter Your Details</h2>
              <p>Set your identity to join the battlefield.</p>
            </header>
            <form className='g-form-stack' onSubmit={submit}>
              <label>
                <span>
                  <PersonOutlineIcon />
                  Your Name
                </span>
                <input
                  className='g-input'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={24}
                  placeholder='Enter your name'
                />
                <small>This will be shown to other players in the room.</small>
              </label>
              <label>
                <span>
                  <CodeOutlinedIcon />
                  Codeforces Handle
                </span>
                <input
                  className='g-input'
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder='Enter your Codeforces handle (e.g. tourist)'
                />
                <small>Used for Codeforces challenge verification.</small>
              </label>
              <button className='g-button g-button-blue' type='submit'>
                Continue <ArrowForwardIcon />
              </button>
              {error && (
                <p className='g-error' role='alert'>
                  {error}
                </p>
              )}
              <div className='g-or'>
                <i />
                or
                <i />
              </div>
              <Link className='g-button g-button-outline' href='/'>
                <HomeOutlinedIcon />
                Back to Home
              </Link>
            </form>
          </section>
        </main>
      </BattlefieldBackdrop>
    </PageFrame>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return { props: { ...(await serverSideTranslations(locale)) } };
}
