import mongoose from 'mongoose';
import { config } from '@config';

export async function connectMongo(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  
  await mongoose.connect(config.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });
  console.log('✅ [MongoDB] Connected');
}