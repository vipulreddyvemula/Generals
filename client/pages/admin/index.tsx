import Head from 'next/head';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Brand } from '@/components/GeneralsUi';
import { ColorArr } from '@/lib/constants';

type Player = {
  playerId: string;
  playerName: string;
  codeforcesHandle: string | null;
  team: number;
  color: number;
  isSpectator: boolean;
  isWinner: boolean;
  placement: number | null;
  eliminatedAt: string | null;
  eliminationReason: string | null;
};

type Match = {
  matchId: string;
  eventId: string | null;
  roomId: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  liveDurationSeconds?: number;
  currentTurn?: number;
  finalTurn: number | null;
  winnerPlayerId: string | null;
  winnerTeam: number | null;
  winner: { playerId: string; playerName: string } | null;
  players: Player[];
};

type TimelineEvent = {
  sequenceNumber: number;
  type: string;
  playerId: string | null;
  timestamp: string;
  payload: Record<string, unknown>;
};

type Stats = {
  activePlayers: number;
  activeMatches: number;
  completedMatches: number;
  rooms: number;
  eliminations: number;
  averageMatchDurationSeconds: number;
};

const EMPTY_STATS: Stats = {
  activePlayers: 0,
  activeMatches: 0,
  completedMatches: 0,
  rooms: 0,
  eliminations: 0,
  averageMatchDurationSeconds: 0,
};

function formatDuration(value?: number | null): string {
  const total = Math.max(0, value || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds]
    .filter((_, index) => index > 0 || hours > 0)
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function winnerLabel(match: Match): string {
  if (match.winner?.playerName) return match.winner.playerName;
  if (match.winnerTeam) return `Team ${match.winnerTeam}`;
  return 'Draw / none';
}

export default function AdminDashboard() {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [live, setLive] = useState<Match[]>([]);
  const [recent, setRecent] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const request = useCallback(
    async <T,>(path: string): Promise<T> => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401 || response.status === 403) throw new Error('Admin token was rejected.');
      if (!response.ok) throw new Error('The admin service is temporarily unavailable.');
      return response.json();
    },
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [statsData, liveData, recentData] = await Promise.all([
        request<Stats>('/admin/stats'),
        request<{ items: Match[] }>('/admin/matches/live'),
        request<{ items: Match[] }>('/admin/matches?status=COMPLETED&pageSize=10'),
      ]);
      setStats(statsData);
      setLive(liveData.items);
      setRecent(recentData.items);
      setError('');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, [request, token]);

  const selectMatch = useCallback(
    async (matchId: string) => {
      try {
        const [match, events] = await Promise.all([
          request<Match>(`/admin/matches/${encodeURIComponent(matchId)}`),
          request<{ items: TimelineEvent[] }>(`/admin/matches/${encodeURIComponent(matchId)}/events?pageSize=100`),
        ]);
        setSelected(match);
        setTimeline(events.items);
        setError('');
      } catch (selectionError) {
        setError(selectionError instanceof Error ? selectionError.message : 'Unable to load match details.');
      }
    },
    [request]
  );

  useEffect(() => {
    const saved = window.sessionStorage.getItem('generals-admin-token') || '';
    setTokenInput(saved);
    setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh, token]);

  function authenticate(event: FormEvent) {
    event.preventDefault();
    const nextToken = tokenInput.trim();
    window.sessionStorage.setItem('generals-admin-token', nextToken);
    setToken(nextToken);
  }

  function signOut() {
    window.sessionStorage.removeItem('generals-admin-token');
    setToken('');
    setTokenInput('');
    setSelected(null);
  }

  if (!token) {
    return (
      <div className='generals-root g-admin-login-page'>
        <Head><title>Tournament Admin — GENERALS</title></Head>
        <form className='g-panel g-admin-login' onSubmit={authenticate}>
          <Brand />
          <h1>Tournament Admin</h1>
          <p className='g-muted'>Enter the server-side event admin token.</p>
          <label htmlFor='admin-token'>Admin token</label>
          <input
            id='admin-token'
            className='g-input'
            type='password'
            autoComplete='current-password'
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            required
          />
          <button className='g-button g-button-blue' type='submit'>Open dashboard</button>
        </form>
      </div>
    );
  }

  return (
    <div className='generals-root g-admin-page'>
      <Head><title>Tournament Admin — GENERALS</title></Head>
      <header className='g-admin-header'>
        <div><Brand /><span>TOURNAMENT</span></div>
        <div className='g-admin-header-actions'>
          <span className='g-status'><i />Polling every 5s</span>
          <button className='g-button g-button-ghost' onClick={() => void refresh()} disabled={loading}>Refresh</button>
          <button className='g-button g-button-outline' onClick={signOut}>Lock</button>
        </div>
      </header>

      <main className='g-admin-main'>
        {error && <div className='g-admin-error' role='alert'>{error}</div>}
        <section>
          <div className='g-admin-section-title'><h1>Summary</h1><span>{loading ? 'Updating…' : 'Live'}</span></div>
          <div className='g-admin-summary'>
            {[
              ['Active Players', stats.activePlayers],
              ['Active Matches', stats.activeMatches],
              ['Completed Matches', stats.completedMatches],
              ['Rooms', stats.rooms],
              ['Eliminations', stats.eliminations],
              ['Average Duration', formatDuration(stats.averageMatchDurationSeconds)],
            ].map(([label, value]) => (
              <div className='g-panel g-admin-stat' key={label}>
                <span>{label}</span><strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className='g-panel g-admin-section'>
          <div className='g-admin-section-title'><h2>Live Matches</h2><span>{live.length} active</span></div>
          <div className='g-admin-table-wrap'>
            <table className='g-admin-table'>
              <thead><tr><th>Room ID</th><th>Match ID</th><th>Players</th><th>Turn</th><th>Duration</th><th>Status</th></tr></thead>
              <tbody>
                {live.map((match) => (
                  <tr key={match.matchId} onClick={() => void selectMatch(match.matchId)}>
                    <td>{match.roomId}</td><td className='g-admin-id'>{match.matchId}</td>
                    <td>{match.players.filter((player) => !player.isSpectator).length}</td>
                    <td>{match.currentTurn || 0}</td><td>{formatDuration(match.liveDurationSeconds)}</td>
                    <td><span className='g-admin-badge active'>ACTIVE</span></td>
                  </tr>
                ))}
                {!live.length && <tr><td colSpan={6} className='g-admin-empty'>No matches are currently active.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className='g-panel g-admin-section'>
          <div className='g-admin-section-title'><h2>Recent Results</h2><span>Latest 10</span></div>
          <div className='g-admin-table-wrap'>
            <table className='g-admin-table'>
              <thead><tr><th>Room ID</th><th>Match ID</th><th>Winner</th><th>Players</th><th>Duration</th><th>Completed At</th></tr></thead>
              <tbody>
                {recent.map((match) => (
                  <tr key={match.matchId} onClick={() => void selectMatch(match.matchId)}>
                    <td>{match.roomId}</td><td className='g-admin-id'>{match.matchId}</td><td>{winnerLabel(match)}</td>
                    <td>{match.players.filter((player) => !player.isSpectator).length}</td>
                    <td>{formatDuration(match.durationSeconds)}</td><td>{formatTime(match.endedAt)}</td>
                  </tr>
                ))}
                {!recent.length && <tr><td colSpan={6} className='g-admin-empty'>No completed matches yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selected && (
          <section className='g-panel g-admin-section g-admin-detail'>
            <div className='g-admin-section-title'><h2>Match Details</h2><button onClick={() => setSelected(null)}>Close</button></div>
            <dl className='g-admin-meta'>
              <div><dt>Match ID</dt><dd>{selected.matchId}</dd></div><div><dt>Room ID</dt><dd>{selected.roomId}</dd></div>
              <div><dt>Event ID</dt><dd>{selected.eventId || '—'}</dd></div><div><dt>Status</dt><dd>{selected.status}</dd></div>
              <div><dt>Started</dt><dd>{formatTime(selected.startedAt)}</dd></div><div><dt>Ended</dt><dd>{formatTime(selected.endedAt)}</dd></div>
              <div><dt>Duration</dt><dd>{formatDuration(selected.durationSeconds)}</dd></div><div><dt>Final turn</dt><dd>{selected.finalTurn ?? '—'}</dd></div>
              <div><dt>Winner</dt><dd>{winnerLabel(selected)}</dd></div>
            </dl>

            <h3>Players</h3>
            <div className='g-admin-table-wrap'><table className='g-admin-table'>
              <thead><tr><th>Player</th><th>Codeforces Handle</th><th>Team</th><th>Color</th><th>Placement</th><th>Status</th><th>Eliminated At</th></tr></thead>
              <tbody>{selected.players.map((player) => (
                <tr key={player.playerId}>
                  <td>{player.playerName}</td><td>{player.codeforcesHandle || '—'}</td><td>{player.isSpectator ? 'Spectator' : player.team}</td>
                  <td><span className='g-admin-color' style={{ background: ColorArr[player.color] || '#808080' }} />{player.color}</td>
                  <td>{player.placement ?? '—'}</td><td>{player.isWinner ? 'Winner' : player.eliminatedAt ? player.eliminationReason || 'Eliminated' : 'Active'}</td>
                  <td>{formatTime(player.eliminatedAt)}</td>
                </tr>
              ))}</tbody>
            </table></div>

            <h3>Timeline</h3>
            <ol className='g-admin-timeline'>
              {timeline.map((item) => (
                <li key={item.sequenceNumber}><time>{new Date(item.timestamp).toLocaleTimeString()}</time><b>{item.type}</b>
                  {typeof item.payload.turn === 'number' && <span>Turn {String(item.payload.turn)}</span>}
                </li>
              ))}
              {!timeline.length && <li className='g-admin-empty'>No timeline events recorded.</li>}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
