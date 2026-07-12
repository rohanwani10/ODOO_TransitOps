import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { logger } from './utils/logger';

const PORT = env.PORT;

async function bootstrap(): Promise<void> {
  // ── Verify DB connection before accepting traffic ────────────
  try {
    await prisma.$connect();
    logger.info('✅  Database connected');
  } catch (err) {
    logger.error('❌  Failed to connect to database', { err });
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(PORT, () => {
    logger.info(`🚀  TransitOps API running`, {
      url: `http://localhost:${PORT}/api/${env.API_VERSION}`,
      env: env.NODE_ENV,
    });
  });

  // ── Graceful shutdown ────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await prisma.$disconnect();
        logger.info('Database disconnected');
      } catch (err) {
        logger.error('Error during DB disconnect', { err });
      }

      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long.
    // .unref() prevents this timer from keeping the event loop alive —
    // if everything else finishes first, Node can exit cleanly without waiting.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));

  // ── Unhandled rejection / exception guards ───────────────────
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
    // Don't exit — let the process continue unless it becomes fatal
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception — shutting down', { err });
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { err });
  process.exit(1);
});
