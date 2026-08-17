import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { logger } from './utils/logger';
import { config } from './config/config';
import { setupQueues } from './queues/queueSetup';
import { recommendationWorker } from './workers/recommendationWorker';
import { playlistWorker } from './workers/playlistWorker';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'worker'
  });
});

// Setup queues and workers
setupQueues();
// Workers start automatically when created, no need to call .start()

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Worker service listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  await recommendationWorker.close();
  await playlistWorker.close();

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  await recommendationWorker.close();
  await playlistWorker.close();

  process.exit(0);
});