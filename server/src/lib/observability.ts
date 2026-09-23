import { RoomPool } from './types';
import { roomRuntimeSnapshot } from './room-runtime';
import { trackMetric } from './telemetry';

export class EventMetrics {
  reconnects = 0;
  exceptions = 0;
  gameEnds = 0;
  matchStarts = 0;
  matchFinishes = 0;
  matchAborts = 0;
  playerEliminations = 0;
  generalCaptures = 0;
  socketErrors = 0;
  replayWriteFailures = 0;
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
      matchStarts: this.matchStarts,
      matchFinishes: this.matchFinishes,
      matchAborts: this.matchAborts,
      playerEliminations: this.playerEliminations,
      generalCaptures: this.generalCaptures,
      socketErrors: this.socketErrors,
      replayWriteFailures: this.replayWriteFailures,
      stuckRooms: runtime.filter(({ state }) => now - state.lastProgressAt > 15_000).map(({ room }) => room.id),
      memory: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
      },
    };
  }

  publish(snapshot: ReturnType<EventMetrics['snapshot']>): void {
    trackMetric('active_sockets', snapshot.connectedSockets);
    trackMetric('active_rooms', snapshot.activeRooms);
    trackMetric('active_matches', snapshot.activeMatches);
    trackMetric('active_players', snapshot.activePlayers);
    trackMetric('game_tick_duration_max_ms', snapshot.tickDurationMs.max);
    trackMetric('game_tick_duration_mean_ms', snapshot.tickDurationMs.mean);
    trackMetric('game_tick_overlaps_prevented', snapshot.tickOverlapsPrevented);
    trackMetric('event_loop_lag_ms', snapshot.eventLoopLagMs);
    trackMetric('socket_events_per_second', snapshot.eventsPerSecond);
    trackMetric('process_rss_bytes', snapshot.memory.rss);
    trackMetric('process_heap_used_bytes', snapshot.memory.heapUsed);
  }
}

export const eventMetrics = new EventMetrics();
