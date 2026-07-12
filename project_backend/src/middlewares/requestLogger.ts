import morgan, { StreamOptions } from 'morgan';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// ─── Pipe Morgan output into Winston ─────────────────────────
const stream: StreamOptions = {
  write: (message: string) => logger.http(message.trim()),
};

// ─── Skip health-check pings in logs ─────────────────────────
const skip = () => env.NODE_ENV === 'test';

// ─── Morgan format ────────────────────────────────────────────
//   dev  → coloured output with response time
//   prod → combined Apache-style for log aggregators
const format = env.NODE_ENV === 'production' ? 'combined' : 'dev';

export const requestLogger = morgan(format, { stream, skip });
