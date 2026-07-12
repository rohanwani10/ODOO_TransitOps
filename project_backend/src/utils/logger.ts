import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

// ─── Custom console format (dev) ──────────────────────────────
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${String(ts)} [${level}]: ${String(message)}${stack ? `\n${String(stack)}` : ''}${metaStr}`;
  }),
);

// ─── JSON format (prod) ───────────────────────────────────────
const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

// ─── Transports ───────────────────────────────────────────────
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  }),
];

// In production, also write to log files
if (env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: prodFormat,
    }),
  );
}

// ─── Logger instance ──────────────────────────────────────────
export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  transports,
  // Prevent Winston from exiting on uncaught exceptions
  exitOnError: false,
});
