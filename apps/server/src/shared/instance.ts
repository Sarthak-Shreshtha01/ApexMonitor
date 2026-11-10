import crypto from 'node:crypto';
import os from 'node:os';

/** Identifies this process among replicas (logs, locks, event-bridge echo filtering). */
export const INSTANCE_ID = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
