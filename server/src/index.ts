import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabase, closeDatabase } from './db/database.js';
import { seedDemoData } from './engine/seeder.js';
import { groupApiPlugin } from './routes/groupApi.js';
import { createTelegramBot } from './bot/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
    },
  });

  // Enable CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Initialize SQLite database
  getDatabase();

  // Seed demo data if DEMO_MODE is true or unset
  if (process.env.DEMO_MODE !== 'false') {
    seedDemoData();
    console.log('[TabMate] Demo mode enabled: "Summer Trip to Rome" pre-seeded.');
  }

  // Register REST API
  await fastify.register(groupApiPlugin);

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'tabmate-server',
      timestamp: new Date().toISOString(),
    };
  });

  // Serve compiled web frontend if available
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDistPath)) {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    // Fallback for SPA routing
    fastify.setNotFoundHandler(async (request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'API endpoint not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  // Start Telegram Bot (Long Polling)
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webAppUrl = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
  const bot = createTelegramBot(botToken, webAppUrl);

  if (bot) {
    bot.start({
      onStart: (botInfo) => {
        console.log(`[TabMate Bot] Started long polling as @${botInfo.username}`);
      },
    }).catch((err) => {
      console.error('[TabMate Bot] Polling error:', err);
    });
  }

  // Start HTTP Server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`[TabMate Server] Listening on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[TabMate] Shutting down gracefully...');
    if (bot) {
      bot.stop();
    }
    await fastify.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('[TabMate] Bootstrap fatal error:', err);
  process.exit(1);
});
