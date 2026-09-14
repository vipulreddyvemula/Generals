import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';
import { io as connect } from 'socket.io-client';

const serverDir = path.resolve(__dirname, '..');

function openPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') return reject(new Error('No test port'));
      probe.close(() => resolve(address.port));
    });
  });
}

function request(port: number, method: string, pathname: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path: pathname }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, body }));
    });
    req.once('error', reject);
    req.end();
  });
}

async function waitForServer(port: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await request(port, 'GET', '/ping')).status === 200) return;
    } catch {
      // The child has not finished listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Test server did not become ready');
}

function once(socket: any, event: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const onEvent = (value: any) => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(event, onEvent);
  });
}

describe('live Socket.IO event-safety regression', () => {
  jest.setTimeout(30_000);

  it('restores a waiting-room player after a page refresh without losing the room', async () => {
    const port = await openPort();
    const child = spawn(path.join(serverDir, 'node_modules/.bin/tsx'), ['src/server.ts'], {
      cwd: serverDir,
      env: { ...process.env, PORT: String(port), CLIENT_URL: '*' },
      stdio: 'pipe',
    });
    const sockets: any[] = [];
    try {
      await waitForServer(port);
      const created = await request(port, 'GET', '/create_room');
      const roomId = JSON.parse(created.body).roomId as string;
      const url = `http://127.0.0.1:${port}`;
      const join = async (auth: Record<string, string> = {}) => {
        const socket = connect(url, {
          autoConnect: false,
          transports: ['websocket'],
          query: { roomId, username: 'Refresh Tester' },
          auth,
        });
        sockets.push(socket);
        const session = once(socket, 'player_session');
        const room = once(socket, 'update_room');
        socket.connect();
        const playerSession = await session;
        await room;
        return { socket, session: playerSession };
      };

      const original = await join();
      const readyUpdate = once(original.socket, 'update_room');
      original.socket.emit('force_start');
      expect((await readyUpdate).forceStartNum).toBe(1);
      const replacement = connect(url, {
        autoConnect: false,
        transports: ['websocket'],
        query: { roomId, username: 'Refresh Tester' },
        auth: original.session,
      });
      sockets.push(replacement);
      const duplicateRejected = once(replacement, 'reject_join');
      replacement.connect();
      expect(await duplicateRejected).toContain('already active');
      original.socket.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const roomsDuringRefresh = JSON.parse((await request(port, 'GET', '/get_rooms')).body);
      expect(roomsDuringRefresh[roomId]?.players).toMatchObject([
        { id: original.session.playerId, disconnected: true, forceStart: false },
      ]);
      expect(roomsDuringRefresh[roomId].forceStartNum).toBe(0);

      const invalid = connect(url, {
        autoConnect: false,
        transports: ['websocket'],
        query: { roomId, username: 'Impostor' },
        auth: { playerId: original.session.playerId, reconnectToken: 'wrong-token' },
      });
      sockets.push(invalid);
      const rejected = once(invalid, 'reject_join');
      invalid.connect();
      expect(await rejected).toContain('authentication failed');

      const replacementSession = once(replacement, 'player_session');
      replacement.connect();
      const restored = { socket: replacement, session: await replacementSession };
      expect(restored.session.playerId).toBe(original.session.playerId);
      expect(restored.session.reconnectToken).not.toBe(original.session.reconnectToken);
      const roomsAfterRefresh = JSON.parse((await request(port, 'GET', '/get_rooms')).body);
      expect(roomsAfterRefresh[roomId].players).toHaveLength(1);
      expect(roomsAfterRefresh[roomId].players[0].disconnected).toBe(false);
      expect(roomsAfterRefresh[roomId].players[0].isRoomHost).toBe(true);

      const teammate = await join();
      const left = new Promise<{ ok: boolean }>((resolve) => restored.socket.emit('leave_room', resolve));
      expect((await left).ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const afterHostLeave = JSON.parse((await request(port, 'GET', '/get_rooms')).body)[roomId];
      expect(afterHostLeave.players).toHaveLength(1);
      expect(afterHostLeave.players[0]).toMatchObject({ id: teammate.session.playerId, isRoomHost: true });
      const lastLeave = new Promise<{ ok: boolean }>((resolve) => teammate.socket.emit('leave_room', resolve));
      expect((await lastLeave).ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(JSON.parse((await request(port, 'GET', '/get_rooms')).body)[roomId]).toBeUndefined();
    } finally {
      for (const socket of sockets) socket.disconnect();
      child.kill('SIGTERM');
    }
  });

  it('starts once, rate-limits floods, rejects duplicates, and restores a disconnected player', async () => {
    const port = await openPort();
    const child: ChildProcessWithoutNullStreams = spawn(path.join(serverDir, 'node_modules/.bin/tsx'), ['src/server.ts'], {
      cwd: serverDir,
      env: { ...process.env, PORT: String(port), CLIENT_URL: '*' },
      stdio: 'pipe',
    });
    let childOutput = '';
    child.stderr.on('data', (chunk) => {
      childOutput = (childOutput + String(chunk)).slice(-5000);
    });
    const sockets: any[] = [];
    try {
      await waitForServer(port);
      const created = await request(port, 'GET', '/create_room');
      expect(created.status).toBe(200);
      const roomId = JSON.parse(created.body).roomId as string;
      const url = `http://127.0.0.1:${port}`;
      const join = async (username: string, auth: Record<string, string> = {}) => {
        const socket = connect(url, { autoConnect: false, transports: ['websocket'], query: { roomId, username }, auth });
        sockets.push(socket);
        const sessionPromise = once(socket, 'player_session');
        const roomPromise = once(socket, 'update_room');
        socket.connect();
        const session = await sessionPromise;
        await roomPromise;
        return { socket, session };
      };

      const first = await join('First');
      const second = await join('Second');
      const settingsUpdate = once(second.socket, 'update_room');
      const settingsMessage = once(second.socket, 'room_message');
      first.socket.emit('change_room_setting', 'roomName', 'Fixture Match');
      expect((await settingsUpdate).roomName).toBe('Fixture Match');
      await settingsMessage;
      const teamUpdate = once(first.socket, 'update_room');
      const teamMessage = once(second.socket, 'room_message');
      second.socket.emit('set_team', 3);
      expect((await teamUpdate).players.find((player: any) => player.id === second.session.playerId).team).toBe(3);
      await teamMessage;
      const chatMessage = once(second.socket, 'room_message');
      first.socket.emit('player_message', 'Lobby ready');
      expect((await chatMessage).username).toBe('First');
      let firstStarts = 0;
      let secondStarts = 0;
      first.socket.on('game_started', () => {
        firstStarts += 1;
      });
      second.socket.on('game_started', () => {
        secondStarts += 1;
      });
      const started = once(first.socket, 'game_started');
      first.socket.emit('force_start');
      second.socket.emit('force_start');
      await started;
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(firstStarts).toBe(1);
      expect(secondStarts).toBe(1);
      const active = JSON.parse((await request(port, 'GET', '/health')).body);
      expect(active.activeMatches).toBe(1);

      const commanderConfig = once(first.socket, 'commander_config');
      first.socket.emit('get_commander_config');
      expect((await commanderConfig).abilities.Reinforce.energy).toBe(40);
      const mathQuestion = once(first.socket, 'math_challenge');
      first.socket.emit('request_math_challenge');
      const math = await mathQuestion;
      expect(math).not.toHaveProperty('correctAnswer');
      const answers: Record<string, string> = {
        'What is 37 × 4?': '148',
        'What is 144 ÷ 12?': '12',
        'What is 256 − 89?': '167',
        'If all A are B, and X is A, is X a B? (yes/no)': 'yes',
        'What is 37 × 84?': '3108',
        'What is 25% of 480?': '120',
        'Solve for x: 3x + 7 = 31': '8',
        'Area of a circle with radius 7? (use π = 22/7)': '154',
        'If f(x) = 3x² − 2, find f(4)': '46',
        'Next in sequence: 3, 7, 13, 21, 31, ?': '43',
        'A right triangle has legs 9 and 12. Its hypotenuse?': '15',
        'Next in sequence: 2, 6, 12, 20, 30, ?': '42',
        'A clock shows 3:15. What is the smaller angle between its hands?': '7.5',
      };
      const mathResult = once(first.socket, 'math_result');
      first.socket.emit('submit_math_answer', math.id, answers[math.question]);
      expect((await mathResult).status).toBe('SOLVED');
      const invalidHandle = once(first.socket, 'challenge_error');
      first.socket.emit('request_codeforces_challenge', { handle: '!' });
      expect((await invalidHandle).source).toBe('CODEFORCES');

      let rateRejections = 0;
      first.socket.on('error', (title: string) => {
        if (title === 'Rate limit') rateRejections += 1;
      });
      for (let index = 0; index < 35; index++) first.socket.emit('attack', { x: -1, y: -1 }, { x: 0, y: 0 }, false);
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(rateRejections).toBeGreaterThan(0);
      expect(JSON.parse((await request(port, 'GET', '/health')).body).activeMatches).toBe(1);

      const duplicate = connect(url, {
        autoConnect: false,
        transports: ['websocket'],
        query: { roomId, username: 'Impostor' },
        auth: first.session,
      });
      sockets.push(duplicate);
      const rejected = once(duplicate, 'reject_join');
      duplicate.connect();
      expect(await rejected).toContain('already active');

      first.socket.disconnect();
      const invalid = connect(url, {
        autoConnect: false,
        transports: ['websocket'],
        query: { roomId, username: 'Impostor' },
        auth: { playerId: first.session.playerId, reconnectToken: 'invalid-token' },
      });
      sockets.push(invalid);
      const invalidRejected = once(invalid, 'reject_join');
      invalid.connect();
      expect(await invalidRejected).toContain('authentication failed');

      const restored = await join('First', first.session);
      expect(restored.session.playerId).toBe(first.session.playerId);
      expect(restored.session.reconnectToken).not.toBe(first.session.reconnectToken);
      expect(JSON.parse((await request(port, 'GET', '/health')).body).reconnects).toBe(1);

      const removedApi = await request(port, 'POST', '/maps');
      expect(removedApi.status).toBe(404);

      const surrenderResult = once(second.socket, 'surrender_result');
      second.socket.emit('surrender');
      expect((await surrenderResult).status).toBe('ACCEPTED');
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(JSON.parse((await request(port, 'GET', '/health')).body).activeMatches).toBe(0);
    } catch (error) {
      throw new Error(`${String(error)}\nServer stderr:\n${childOutput}`);
    } finally {
      for (const socket of sockets) socket.disconnect();
      child.kill('SIGTERM');
    }
  });
});
