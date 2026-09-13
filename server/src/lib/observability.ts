import { RoomPool } from './types';
import { roomRuntimeSnapshot } from './room-runtime';

export class EventMetrics {
  reconnects = 0;
  exceptions = 0;
  gameEnds = 0;
  private events = 0;
  private inboundBytes = 0;
  private outboundBytes = 0;
  private previousEvents = 0;
  private previousInboundBytes = 0;
  private previousOutboundBytes = 0;
  private previousAt = Date.now();
  eventLoopLagMs = 0;

  recordEvent(): void {
    this.events += 1;
  }

  recordBytes(direction: 'in' | 'out', count: number): void {
    if (direction === 'in') this.inboundBytes += count;
    else this.outboundBytes += count;
  }

  snapshot(pool: RoomPool, connectedSockets: number, now = Date.now()) {
    const rooms = Object.values(pool);
    const activeMatches = rooms.filter((room) => room.gameStarted);
    const activePlayers = activeMatches.reduce(
      (count, room) => count + room.players.filter((player) => !player.isDead && !player.spectating()).length,
      0
    );
    const runtime = activeMatches.map((room) => ({ room, state: roomRuntimeSnapshot(room) }));
    const elapsedSeconds = Math.max((now - this.previousAt) / 1000, 0.001);
    const eventsPerSecond = (this.events - this.previousEvents) / elapsedSeconds;
    const inboundBytesPerSecond = (this.inboundBytes - this.previousInboundBytes) / elapsedSeconds;
    const outboundBytesPerSecond = (this.outboundBytes - this.previousOutboundBytes) / elapsedSeconds;
    this.previousAt = now;
    this.previousEvents = this.events;
    this.previousInboundBytes = this.inboundBytes;
    this.previousOutboundBytes = this.outboundBytes;

    return {
      type: 'event_metrics',
      timestamp: new Date(now).toISOString(),
      connectedSockets,
      activeRooms: rooms.filter((room) => room.players.length > 0).length,
      activeMatches: activeMatches.length,
      activePlayers,
      tickDurationMs: {
        max: Math.max(0, ...runtime.map(({ state }) => state.lastTickDurationMs)),
        mean: runtime.length ? runtime.reduce((sum, { state }) => sum + state.lastTickDurationMs, 0) / runtime.length : 0,
      },
      tickOverlapsPrevented: rooms.reduce((sum, room) => sum + roomRuntimeSnapshot(room).preventedOverlaps, 0),
      eventLoopLagMs: this.eventLoopLagMs,
      eventsPerSecond,
      inboundBytesPerSecond,
      outboundBytesPerSecond,
      reconnects: this.reconnects,
      exceptions: this.exceptions,
      gameEnds: this.gameEnds,
      stuckRooms: runtime.filter(({ state }) => now - state.lastProgressAt > 15_000).map(({ room }) => room.id),
      memory: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
      },
    };
  }
}

export const eventMetrics = new EventMetrics();
