import Redis from 'ioredis';
import { config } from '@config';

let client: Redis;

export async function connectRedis(): Promise<void> {
  client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
  });
  
  await client.ping();
  console.log('✅ [Redis] Connected');
}

export function getRedis(): Redis {
  if (!client) throw new Error('Redis not connected');
  return client;
}