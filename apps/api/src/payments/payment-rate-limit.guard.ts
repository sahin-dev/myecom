import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";

/**
 * Structural shape of what this guard reads off the request. Declared locally
 * because @types/express is not a dependency of this project, and importing it
 * for two properties would add one.
 */
type IncomingRequest = {
  headers: Record<string, string | string[] | undefined>;
  path?: string;
  url?: string;
  ip?: string;
  socket?: { remoteAddress?: string };
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * Fixed-window limiter for the unauthenticated payment callbacks.
 *
 * `/execute`, `/failed` and the webhook cannot sit behind an auth guard — the
 * gateway and the returning customer both call them without a session — but
 * each one triggers an outbound gateway request, so an open loop is expensive.
 * This bounds it per client.
 *
 * In-memory on purpose: the project has no Redis and no throttler package, and
 * a per-instance bound is strictly better than none. Move this to a shared
 * store when the API runs on more than one instance, or the effective limit
 * multiplies by the instance count.
 */
@Injectable()
export class PaymentRateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = Date.now();

  private clientKey(request: IncomingRequest) {
    const forwarded = request.headers["x-forwarded-for"];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(",")[0]?.trim() || request.ip || request.socket?.remoteAddress;
    return `${ip ?? "unknown"}:${request.path ?? request.url ?? ""}`;
  }

  /** Drops expired buckets so the map cannot grow without bound. */
  private sweep(now: number) {
    if (now - this.lastSweep < SWEEP_EVERY_MS) return;
    for (const [key, bucket] of this.hits) {
      if (bucket.resetAt <= now) this.hits.delete(key);
    }
    this.lastSweep = now;
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<IncomingRequest>();
    const now = Date.now();
    this.sweep(now);

    const key = this.clientKey(request);
    const bucket = this.hits.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      throw new HttpException(
        "Too many payment requests. Wait a moment and try again.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return true;
  }
}
