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
        socket.connect();
        const session = await sessionPromise;
        return { socket, session };
      };

      const first = await join('First');
      const second = await join('Second');
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
    } catch (error) {
      throw new Error(`${String(error)}\nServer stderr:\n${childOutput}`);
    } finally {
      for (const socket of sockets) socket.disconnect();
      child.kill('SIGTERM');
    }
  });
});
