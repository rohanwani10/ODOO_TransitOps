import { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { env, corsOrigins } from '../config/env';
import { TooManyRequestsError } from '../errors/AppError';

// ─── Apply all security middleware to the Express app ─────────
export function applySecurityMiddleware(app: Express): void {
  // ── Helmet: HTTP security headers ──────────────────────────
  app.use(
    helmet({
      // Allow inline scripts in development for tools like Swagger UI
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: env.NODE_ENV === 'production',
    }),
  );

  // ── CORS ───────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      maxAge: 86_400, // 24h preflight cache
    }),
  );

  // ── Rate Limiting ──────────────────────────────────────────
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,  // Return RateLimit-* headers
      legacyHeaders: false,
      handler: (_req: Request, res: Response) => {
        const err = new TooManyRequestsError(
          `Too many requests. Please retry after ${env.RATE_LIMIT_WINDOW_MS / 60_000} minutes.`,
        );
        res.status(err.statusCode).json({
          success: false,
          code: err.code,
          message: err.message,
        });
      },
    }),
  );

  // ── Compression ────────────────────────────────────────────
  app.use(compression());
}
