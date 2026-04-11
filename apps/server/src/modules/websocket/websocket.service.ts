import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { getRedis } from '@infrastructure/redis';
import { config } from '@config';
import { eventBus } from '@events/event-bus';

export class WebSocketService {
  private io: Server;
  private activeRooms: Set<string> = new Set();
  private broadcastInterval: NodeJS.Timeout | null = null;

  private latestInsights: Map<string, any> = new Map();

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: config.CORS_ORIGINS,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupListeners();
    this.startBroadcastLoop();

    eventBus.on('anomaly.detected', (payload) => {
      this.latestInsights.set(payload.projectId, {
        type: payload.type,
        endpoint: payload.endpoint,
        message: payload.meta.message,
        timestamp: Date.now()
      });
    });

    console.log('✅ [WebSocket] Server initialized');
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 [WebSocket] Client connected: ${socket.id}`);

      // Client requests to join a project room (cite: 751-752)
      socket.on('join', async (payload: { projectId: string; token?: string }) => {
        const { projectId } = payload;
        
        // In a full production env, we validate the JWT token here.
        // For Phase 4, we will just allow them to join the room.
        socket.join(projectId);
        this.activeRooms.add(projectId);
        console.log(`👥 [WebSocket] Client ${socket.id} joined room: ${projectId}`);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 [WebSocket] Client disconnected: ${socket.id}`);
        // We could clean up empty rooms here for optimization
      });
    });
  }

  /**
   * Runs every 2 seconds. Iterates over active rooms, 
   * pulls live stats from Redis, and broadcasts them. (cite: 731-750)
   */
  private startBroadcastLoop() {
    this.broadcastInterval = setInterval(async () => {
      const redis = getRedis();

      for (const projectId of this.activeRooms) {
        // Check if anyone is actually in the room to save CPU
        const clients = this.io.sockets.adapter.rooms.get(projectId);
        if (!clients || clients.size === 0) {
          this.activeRooms.delete(projectId);
          continue;
        }

        // Fetch live counters populated by the Ingest Service
        const requestsKey = `live:${projectId}:requests`;
        const errorsKey = `live:${projectId}:errors`;
        const latencyTotalKey = `live:${projectId}:latency_total`;
        const endpointKey = `live:${projectId}:endpoints`;

        const [requestCountRaw, errorCountRaw, latencyTotalRaw, endpointRows] = await Promise.all([
          redis.get(requestsKey),
          redis.get(errorsKey),
          redis.get(latencyTotalKey),
          redis.zrevrange(endpointKey, 0, 2, 'WITHSCORES'),
        ]);

        const requestCount = Number(requestCountRaw ?? 0);
        const errorCount = Number(errorCountRaw ?? 0);
        const latencyTotal = Number(latencyTotalRaw ?? 0);

        const rps = Number((requestCount / 5).toFixed(2));
        const errorRate = requestCount > 0 ? Number(((errorCount / requestCount) * 100).toFixed(2)) : 0;

        const topEndpoints: Array<{ endpoint: string; rps: number; p99: number }> = [];
        for (let index = 0; index < endpointRows.length; index += 2) {
          const label = endpointRows[index] ?? '';
          const score = Number(endpointRows[index + 1] ?? 0);
          const endpoint = typeof label === 'string' ? label : String(label);
          topEndpoints.push({
            endpoint,
            rps: Number((score / 5).toFixed(2)),
            p99: requestCount > 0 ? Number((latencyTotal / requestCount).toFixed(2)) : 0,
          });
        }

        const insight = this.latestInsights.get(projectId) || null;

        // Construct the payload contract defined in the SRS (cite: 735-749)
        const payload = {
          type: 'pulse:live',
          projectId,
          timestamp: Date.now(),
          data: {
            rps,
            errorRate,
            activeAlerts: 0,
            topEndpoints,
            latestInsight: insight
          }
        };

        // Push to all clients in this specific project room
        this.io.to(projectId).emit('pulse:live', payload);
      }
    }, 2000);
  }
}