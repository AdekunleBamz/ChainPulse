/**
 * ChainPulse Backend Server
 * 
 * Express server that:
 * 1. Receives chainhook webhook events
 * 2. Serves API endpoints for frontend
 * 3. Provides real-time updates via WebSocket
 * 
 * Built for Stacks Builder Challenge Week 2 - Chainhooks Integration
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { createChainhooksService, ChainhooksService } from './services/chainhooks.service.js';
import { webhookHandler, ChainhookPayload } from './handlers/webhook.handler.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'chainpulse-secret';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Store WebSocket clients
const wsClients: Set<WebSocket> = new Set();

// Chainhooks service instance
let chainhooksService: ChainhooksService | null = null;

// ===============================
// Middleware
// ===============================

// Webhook authentication middleware
function authenticateWebhook(req: Request, res: Response, next: NextFunction): void {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${WEBHOOK_SECRET}`) {
    next();
    return;
  }
  
  // Check query param token (used by chainhooks)
  const queryToken = req.query.token as string;
  if (queryToken === WEBHOOK_SECRET) {
    next();
    return;
  }
  
  console.warn('[Server] Unauthorized webhook attempt');
  res.status(401).json({ error: 'Unauthorized' });
}

// ===============================
// Health & Status Routes
// ===============================

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    chainhooksConnected: chainhooksService !== null,
  });
});

app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const stats = webhookHandler.getStats();
    const chainhookStatus = chainhooksService 
      ? await chainhooksService.checkStatus()
      : null;

    res.json({
      app: {
        ...stats,
        uptime: process.uptime(),
        wsClients: wsClients.size,
      },
      chainhook: chainhookStatus,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ===============================
// Chainhook Webhook Routes
// ===============================

// Main webhook endpoint for all chainhook events
app.post('/api/chainhook/events/:eventType', authenticateWebhook, async (req: Request, res: Response) => {
  const { eventType } = req.params;
  const payload = req.body as ChainhookPayload;

  console.log(`[Server] Received ${eventType} webhook event`);

  try {
    await webhookHandler.processPayload(payload);

    // Broadcast to WebSocket clients
    const message = JSON.stringify({
      type: 'chainhook-event',
      eventType,
      timestamp: Date.now(),
    });

    wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Server] Failed to process webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Individual event type routes (for more specific chainhook configurations)
const eventRoutes = ['pulse', 'boost', 'checkin', 'mega-pulse', 'challenge', 'reward', 'tier', 'badge', 'stx-transfer'];

eventRoutes.forEach(route => {
  app.post(`/api/chainhook/events/${route}`, authenticateWebhook, async (req: Request, res: Response) => {
    const payload = req.body as ChainhookPayload;
    console.log(`[Server] Received ${route} event`);

    try {
      await webhookHandler.processPayload(payload);

      // Broadcast specific event
      const message = JSON.stringify({
        type: route,
        timestamp: Date.now(),
      });

      wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error(`[Server] Failed to process ${route} webhook:`, error);
      res.status(500).json({ error: 'Failed to process webhook' });
    }
  });
});

// ===============================
// API Routes
// ===============================

// Get recent activities
app.get('/api/activities', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const activities = webhookHandler.getActivities(limit);
  res.json({ activities, total: activities.length });
});

// Get user activities
app.get('/api/users/:address/activities', (req: Request, res: Response) => {
  const { address } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const activities = webhookHandler.getUserActivities(address, limit);
  res.json({ activities, total: activities.length });
});

// Get leaderboard
app.get('/api/leaderboard', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const leaderboard = webhookHandler.getLeaderboard(limit);
  res.json({ leaderboard, total: leaderboard.length });
});

// Get stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const stats = webhookHandler.getStats();
  res.json(stats);
});

// ===============================
// Chainhook Management Routes
// ===============================

// List all registered chainhooks
app.get('/api/chainhooks', async (req: Request, res: Response) => {
  try {
    if (!chainhooksService) {
      res.status(503).json({ error: 'Chainhooks service not initialized' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const chainhooks = await chainhooksService.listChainhooks(limit);
    res.json(chainhooks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list chainhooks' });
  }
});

// Get specific chainhook
app.get('/api/chainhooks/:uuid', async (req: Request, res: Response) => {
  try {
    if (!chainhooksService) {
      res.status(503).json({ error: 'Chainhooks service not initialized' });
      return;
    }

    const chainhook = await chainhooksService.getChainhook(req.params.uuid);
    res.json(chainhook);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get chainhook' });
  }
});

// Register all chainhooks
app.post('/api/chainhooks/register-all', async (_req: Request, res: Response) => {
  try {
    if (!chainhooksService) {
      res.status(503).json({ error: 'Chainhooks service not initialized' });
      return;
    }

    const hooks = await chainhooksService.registerAllHooks();
    const registered = Array.from(hooks.entries()).map(([name, hook]) => ({
      name,
      uuid: hook.uuid,
    }));

    res.json({ success: true, registered });
  } catch (error) {
    console.error('[Server] Failed to register chainhooks:', error);
    res.status(500).json({ error: 'Failed to register chainhooks' });
  }
});

// Toggle chainhook enabled state
app.patch('/api/chainhooks/:uuid/toggle', async (req: Request, res: Response) => {
  try {
    if (!chainhooksService) {
      res.status(503).json({ error: 'Chainhooks service not initialized' });
      return;
    }

    const { enabled } = req.body;
    await chainhooksService.toggleChainhook(req.params.uuid, enabled);
    res.json({ success: true, enabled });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle chainhook' });
  }
});

// Delete chainhook
app.delete('/api/chainhooks/:uuid', async (req: Request, res: Response) => {
  try {
    if (!chainhooksService) {
      res.status(503).json({ error: 'Chainhooks service not initialized' });
      return;
    }

    await chainhooksService.deleteChainhook(req.params.uuid);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete chainhook' });
  }
});

// Delete all chainhooks
app.delete('/api/chainhooks', async (_req: Request, res: Response) => {
  try {
    if (!chainhooksService) {
      res.status(503).json({ error: 'Chainhooks service not initialized' });
      return;
    }

    await chainhooksService.deleteAllHooks();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete chainhooks' });
  }
});

// ===============================
// Server Setup
// ===============================

const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  console.log('[WebSocket] Client connected');
  wsClients.add(ws);

  // Send initial stats
  ws.send(JSON.stringify({
    type: 'connected',
    stats: webhookHandler.getStats(),
  }));

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
    wsClients.delete(ws);
  });
});

// Forward webhook handler events to WebSocket clients
webhookHandler.on('pulse', (activity) => {
  broadcast({ type: 'pulse', activity });
});

webhookHandler.on('boost', (activity) => {
  broadcast({ type: 'boost', activity });
});

webhookHandler.on('checkin', (activity) => {
  broadcast({ type: 'checkin', activity });
});

webhookHandler.on('mega-pulse', (activity) => {
  broadcast({ type: 'mega-pulse', activity });
});

webhookHandler.on('challenge', (activity) => {
  broadcast({ type: 'challenge', activity });
});

webhookHandler.on('reward', (activity) => {
  broadcast({ type: 'reward', activity });
});

webhookHandler.on('tier', (activity) => {
  broadcast({ type: 'tier', activity });
});

webhookHandler.on('badge', (activity) => {
  broadcast({ type: 'badge', activity });
});

webhookHandler.on('leaderboard-update', (entry) => {
  broadcast({ type: 'leaderboard-update', entry });
});

function broadcast(data: object): void {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// ===============================
// Start Server
// ===============================

async function start(): Promise<void> {
  try {
    // Initialize chainhooks service if API key is provided
    if (process.env.HIRO_API_KEY) {
      chainhooksService = createChainhooksService();
      console.log('[Server] Chainhooks service initialized');

      // Check API status
      const status = await chainhooksService.checkStatus();
      console.log(`[Server] Hiro API Status: ${status.status} (v${status.version})`);
    } else {
      console.warn('[Server] HIRO_API_KEY not set, chainhooks service disabled');
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`[Server] ChainPulse backend running on port ${PORT}`);
      console.log(`[Server] WebSocket server running on ws://localhost:${PORT}/ws`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

start();

export { app, server };