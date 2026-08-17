import { Queue, Worker } from 'bullmq';
import { config } from '../config/config';
import { logger } from '../utils/logger';

// Create queues
export const recommendationQueue = new Queue('recommendations', {
  connection: {
    url: config.redis.url
  }
});

export const playlistQueue = new Queue('playlists', {
  connection: {
    url: config.redis.url
  }
});

export function setupQueues() {
  logger.info('Setting up background job queues');

  // Clean up old jobs periodically
  setInterval(async () => {
    try {
      await recommendationQueue.clean(24 * 60 * 60 * 1000, 100); // Clean jobs older than 24 hours
      await playlistQueue.clean(24 * 60 * 60 * 1000, 100);
    } catch (error) {
      logger.error('Error cleaning queues:', error);
    }
  }, 60 * 60 * 1000); // Run every hour

  logger.info('Queues setup complete');
}