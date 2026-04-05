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
        const rpsKey = `live:${projectId}:rps`;
        const currentRpsStr = await redis.get(rpsKey);
        const rps = currentRpsStr ? parseInt(currentRpsStr, 10) : 0;

        const insight = this.latestInsights.get(projectId) || null;

        // Construct the payload contract defined in the SRS (cite: 735-749)
        const payload = {
          type: 'pulse:live',
          projectId,
          timestamp: Date.now(),
          data: {
            rps: rps,
            errorRate: 0, // Placeholder until Alerting Phase
            activeAlerts: 0,
            topEndpoints: [],
            latestInsight: insight
          }
        };

        // Push to all clients in this specific project room
        this.io.to(projectId).emit('pulse:live', payload);
      }
    }, 2000);
  }
}