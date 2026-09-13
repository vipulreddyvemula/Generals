import { Room } from './types';

interface RuntimeState {
  starting: boolean;
  ticking: boolean;
  generation: number;
  preventedOverlaps: number;
  lastTickDurationMs: number;
  lastProgressAt: number;
}

const states = new WeakMap<Room, RuntimeState>();

function stateFor(room: Room): RuntimeState {
  let state = states.get(room);
  if (!state) {
    state = {
      starting: false,
      ticking: false,
      generation: 0,
      preventedOverlaps: 0,
      lastTickDurationMs: 0,
      lastProgressAt: Date.now(),
    };
    states.set(room, state);
  }
  return state;
}

export function roomRuntimeSnapshot(room: Room) {
  const state = stateFor(room);
  return {
    starting: state.starting,
    ticking: state.ticking,
    preventedOverlaps: state.preventedOverlaps,
    lastTickDurationMs: state.lastTickDurationMs,
    lastProgressAt: state.lastProgressAt,
  };
}

export async function startRoomOnce(room: Room, start: () => Promise<void> | void): Promise<boolean> {
  const state = stateFor(room);
  if (room.gameStarted || state.starting) return false;
  state.starting = true;
  try {
    await start();
    state.lastProgressAt = Date.now();
    return true;
  } finally {
    state.starting = false;
  }
}

export async function runRoomTick(room: Room, tick: (isCurrent: () => boolean) => Promise<void> | void): Promise<boolean> {
  const state = stateFor(room);
  if (!room.gameStarted) return false;
  if (state.ticking) {
    state.preventedOverlaps += 1;
    return false;
  }

  state.ticking = true;
  const generation = state.generation;
  const startedAt = performance.now();
  const isCurrent = () => room.gameStarted && state.generation === generation;
  try {
    await tick(isCurrent);
    if (isCurrent()) state.lastProgressAt = Date.now();
    return true;
  } finally {
    state.lastTickDurationMs = performance.now() - startedAt;
    if (state.generation === generation) state.ticking = false;
  }
}

export function resetRoomRuntime(room: Room): void {
  const state = stateFor(room);
  state.generation += 1;
  state.starting = false;
  state.ticking = false;
  state.lastProgressAt = Date.now();
}
