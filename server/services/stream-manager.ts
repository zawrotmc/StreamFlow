import { WebSocket } from 'ws';

interface StreamStatus {
  isLive: boolean;
  viewerCount: number;
  streamKey: string;
  bitrate?: string;
  resolution?: string;
  fps?: number;
  uptime?: string;
}

export class StreamManager {
  private clients: Set<WebSocket> = new Set();
  private currentStatus: StreamStatus = {
    isLive: false,
    viewerCount: 0,
    streamKey: ''
  };

  addClient(ws: WebSocket) {
    this.clients.add(ws);
    
    // Send current status to new client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stream_status',
        data: this.currentStatus
      }));
    }

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  removeClient(ws: WebSocket) {
    this.clients.delete(ws);
  }

  broadcastStreamStatus(status: Partial<StreamStatus>) {
    this.currentStatus = { ...this.currentStatus, ...status };
    
    const message = JSON.stringify({
      type: 'stream_status',
      data: this.currentStatus
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  broadcastViewerUpdate(count: number) {
    this.currentStatus.viewerCount = count;
    this.broadcastStreamStatus({ viewerCount: count });
  }

  broadcastConnectionLog(log: any) {
    const message = JSON.stringify({
      type: 'connection_log',
      data: log
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getStatus(): StreamStatus {
    return this.currentStatus;
  }
}

export const streamManager = new StreamManager();
