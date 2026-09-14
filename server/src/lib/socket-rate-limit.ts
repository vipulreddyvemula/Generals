export interface RatePolicy {
  burst: number;
  refillMs: number;
}

export const SOCKET_EVENT_POLICIES: Readonly<Record<string, RatePolicy>> = Object.freeze({
  attack: { burst: 16, refillMs: 1000 },
  surrender: { burst: 1, refillMs: 10_000 },
  leave_room: { burst: 1, refillMs: 5000 },
  set_team: { burst: 6, refillMs: 10_000 },
  change_room_setting: { burst: 24, refillMs: 1000 },
  player_message: { burst: 6, refillMs: 5000 },
  activate_ability: { burst: 6, refillMs: 3000 },
  force_start: { burst: 4, refillMs: 10_000 },
  change_host: { burst: 4, refillMs: 10_000 },
  get_room_info: { burst: 10, refillMs: 1000 },
  get_commander_config: { burst: 5, refillMs: 1000 },
});

export const SESSION_IP_POLICY: RatePolicy = { burst: 600, refillMs: 60_000 };
export const SESSION_CLAIM_POLICY: RatePolicy = { burst: 8, refillMs: 60_000 };

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class SocketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private checks = 0;

  allow(subject: string, event: string, policy: RatePolicy, now = Date.now()): boolean {
    const key = `${subject}\0${event}`;
    const prior = this.buckets.get(key);
    const tokens = prior
      ? Math.min(policy.burst, prior.tokens + ((now - prior.updatedAt) / policy.refillMs) * policy.burst)
      : policy.burst;
    const allowed = tokens >= 1;
    this.buckets.set(key, { tokens: allowed ? tokens - 1 : tokens, updatedAt: now });

    this.checks += 1;
    if (this.checks % 1000 === 0) this.prune(now);
    return allowed;
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > 120_000) this.buckets.delete(key);
    }
  }
}
