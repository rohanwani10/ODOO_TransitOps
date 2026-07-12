import express, { Express } from 'express';
import { env } from './config/env';
import { applySecurityMiddleware } from './middlewares/security';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import apiRouter from './routes/index';

// ─── App Factory ──────────────────────────────────────────────
export function createApp(): Express {
  const app = express();

  // ── Trust proxy (required when behind nginx / load balancer) ─
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // ── Security middleware (helmet, cors, rate-limit, compress) ─
  applySecurityMiddleware(app);

  // ── Body parsers ─────────────────────────────────────────────
  // The Clerk webhook route needs the raw Buffer body so svix can verify
  // the HMAC signature. Apply express.json() conditionally — skip it for
  // the webhook path so express.raw() in auth.route.ts gets an untouched stream.
  app.use((req, res, next) => {
    const webhookPath = `/api/${env.API_VERSION}/auth/webhooks/clerk`;
    if (req.path === webhookPath) return next();
    express.json({ limit: '10mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── HTTP request logger ───────────────────────────────────────
  app.use(requestLogger);

  // ── API Routes ────────────────────────────────────────────────
  app.use(`/api/${env.API_VERSION}`, apiRouter);

  // ── 404 handler (must come after all routes) ─────────────────
  app.use(notFoundHandler);

  // ── Global error handler (must be last, 4-arg signature) ─────
  app.use(errorHandler);

  return app;
}
