import NodeMediaServer from 'node-media-server';
import { storage } from '../storage';
import { streamManager } from './stream-manager';

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8888,
    allow_origin: '*'
  },
  relay: {
    ffmpeg: '/usr/local/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        mode: 'push',
        edge: 'rtmp://127.0.0.1:1935/hls'
      }
    ]
  }
};

function safeObjectInspect(obj: any, maxDepth: number = 1): any {
  const seen = new WeakSet();
  
  function inspect(obj: any, depth: number = 0): any {
    if (depth > maxDepth) return '[Max Depth Reached]';
    if (obj === null || typeof obj !== 'object') return obj;
    if (seen.has(obj)) return '[Circular Reference]';
    
    seen.add(obj);
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        if (typeof value === 'function') {
          result[key] = '[Function]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = inspect(value, depth + 1);
        } else {
          result[key] = value;
        }
      } catch (error) {
        result[key] = '[Error accessing property]';
      }
    }
    
    return result;
  }
  
  return inspect(obj);
}

function extractStreamInfo(id: any, StreamPath?: any, args?: any): {
  streamPath: string | null;
  sessionId: string | null;
  ipAddress: string;
} {
  let actualStreamPath: string | null = null;
  let sessionId: string | null = null;
  let ipAddress: string = 'unknown';

  if (id && typeof id === 'object') {
    sessionId = id.id || id.sessionId || id.playStreamId || id.publishStreamId || null;
    actualStreamPath = id.streamPath || id.StreamPath || id.publishStreamPath || id.path || null;
    
    ipAddress = id.ip || (id.socket && id.socket.remoteAddress) || 'unknown';
    
    if (!actualStreamPath) {
      if (id.publishStreamPath) {
        actualStreamPath = id.publishStreamPath;
      } else if (id.app && id.stream) {
        actualStreamPath = `/${id.app}/${id.stream}`;
      }
    }
  }

  if (!actualStreamPath) {
    if (typeof StreamPath === 'string' && StreamPath.startsWith('/')) {
      actualStreamPath = StreamPath;
    } else if (typeof id === 'string' && id.startsWith('/')) {
      actualStreamPath = id;
    } else if (args && typeof args === 'string' && args.startsWith('/')) {
      actualStreamPath = args;
    }
  }

  if (ipAddress === 'unknown' && args && typeof args === 'object' && args.ip) {
    ipAddress = args.ip;
  }

  return {
    streamPath: actualStreamPath,
    sessionId,
    ipAddress
  };
}

export class RTMPServer {
  private nms: any;

  constructor() {
    this.nms = new NodeMediaServer(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    const originalEmit = this.nms.emit;
    this.nms.emit = function(...args: any[]) {
      console.log('🔍 NMS Event fired:', args[0], 'with', args.length - 1, 'parameters');
      if (args[0] && (args[0].includes('publish') || args[0].includes('connect'))) {
        console.log('🔍 Event type:', args[0]);
      }
      return originalEmit.apply(this, args);
    };

    this.nms.on('preConnect', (id: any, args: any) => {
      console.log('[NodeEvent on preConnect]', `id=${typeof id === 'object' ? '[Object]' : id}`);
    });

    this.nms.on('postConnect', (id: any, args: any) => {
      console.log('[NodeEvent on postConnect]', `id=${typeof id === 'object' ? '[Object]' : id}`);
    });

    this.nms.on('doneConnect', (id: any, args: any) => {
      console.log('[NodeEvent on doneConnect]', `id=${typeof id === 'object' ? '[Object]' : id}`);
    });

    this.nms.on('prePublish', async (id: any, StreamPath?: any, args?: any) => {
      console.log('[NodeEvent on prePublish]', `id=${typeof id} StreamPath=${StreamPath} args=${typeof args}`);
      
      const { streamPath, sessionId, ipAddress } = extractStreamInfo(id, StreamPath, args);
      
      console.log('🔍 Extracted info:', {
        streamPath,
        sessionId: sessionId ? '[Present]' : '[Not Found]',
        ipAddress
      });

      if (id && typeof id === 'object') {
        console.log('🔍 Safe object keys:', Object.keys(id));
        const safeInspection = safeObjectInspect(id, 1);
        console.log('🔍 Safe object inspection:', safeInspection);
      }
      
      if (!streamPath || typeof streamPath !== 'string') {
        console.log('❌ Invalid StreamPath after all attempts:', streamPath);
        try {
          if (sessionId && this.nms.getSession && typeof this.nms.getSession === 'function') {
            const session = this.nms.getSession(sessionId);
            if (session && session.reject) session.reject();
          }
        } catch (error: any) {
          console.log('⚠️ Could not reject session:', error?.message || error);
        }
        return;
      }
      
      const pathParts = streamPath.split('/');
      if (pathParts.length < 3) {
        console.log('❌ Invalid StreamPath format:', streamPath);
        try {
          if (this.nms.getSession && typeof this.nms.getSession === 'function') {
            const session = this.nms.getSession(id);
            if (session && session.reject) session.reject();
          }
        } catch (error: any) {
          console.log('⚠️ Could not reject session:', error?.message || error);
        }
        return;
      }
      
      const streamKey = pathParts[2];
      
      const currentStream = await storage.getCurrentStream();
      if (!currentStream || currentStream.streamKey !== streamKey) {
        console.log('❌ Invalid stream key:', streamKey);
        try {
          if (this.nms.getSession && typeof this.nms.getSession === 'function') {
            const session = this.nms.getSession(id);
            if (session && session.reject) session.reject();
          }
        } catch (error: any) {
          console.log('⚠️ Could not reject session:', error?.message || error);
        }
        return;
      }

      console.log('✅ Valid stream key, allowing connection');

      await storage.addConnectionLog({
        streamId: currentStream.id,
        level: 'INFO',
        message: `Stream started with key: ${streamKey}`,
        ipAddress
      });
    });

    this.nms.on('postPublish', async (id: any, StreamPath?: any, args?: any) => {
      console.log('[NodeEvent on postPublish]', `id=${typeof id} StreamPath=${StreamPath} args=${typeof args}`);
      
      const { streamPath, ipAddress } = extractStreamInfo(id, StreamPath, args);
      
      console.log('🔍 Extracted info in postPublish:', { streamPath, ipAddress });
      
      if (!streamPath || typeof streamPath !== 'string') {
        console.log('❌ Invalid StreamPath in postPublish after all attempts:', streamPath);
        return;
      }
      
      const pathParts = streamPath.split('/');
      if (pathParts.length < 3) {
        console.log('❌ Invalid StreamPath format in postPublish:', streamPath);
        return;
      }
      
      const streamKey = pathParts[2];
      const currentStream = await storage.getCurrentStream();
      
      if (currentStream && currentStream.streamKey === streamKey) {
        console.log('✅ Stream is now live!');
        
        await storage.updateStream(currentStream.id, {
          isLive: true,
          startedAt: new Date()
        });
        
        streamManager.broadcastStreamStatus({
          isLive: true,
          viewerCount: 0,
          streamKey: currentStream.streamKey
        });

        await storage.addConnectionLog({
          streamId: currentStream.id,
          level: 'INFO',
          message: 'Stream is now live',
          ipAddress
        });
      }
    });

    this.nms.on('donePublish', async (id: any, StreamPath?: any, args?: any) => {
      console.log('[NodeEvent on donePublish]', `id=${typeof id} StreamPath=${StreamPath} args=${typeof args}`);
      
      const { streamPath, ipAddress } = extractStreamInfo(id, StreamPath, args);
      
      console.log('🔍 Extracted info in donePublish:', { streamPath, ipAddress });
      
      if (!streamPath || typeof streamPath !== 'string') {
        console.log('❌ Invalid StreamPath in donePublish after all attempts:', streamPath);
        return;
      }
      
      const pathParts = streamPath.split('/');
      if (pathParts.length < 3) {
        console.log('❌ Invalid StreamPath format in donePublish:', streamPath);
        return;
      }
      
      const streamKey = pathParts[2];
      const currentStream = await storage.getCurrentStream();
      
      if (currentStream && currentStream.streamKey === streamKey) {
        console.log('✅ Stream ended');
        
        await storage.updateStream(currentStream.id, {
          isLive: false,
          endedAt: new Date(),
          viewerCount: 0
        });
        
        streamManager.broadcastStreamStatus({
          isLive: false,
          viewerCount: 0,
          streamKey: currentStream.streamKey
        });

        await storage.addConnectionLog({
          streamId: currentStream.id,
          level: 'INFO',
          message: 'Stream ended',
          ipAddress
        });
      }
    });
  }

  start() {
    try {
      this.nms.run();
      console.log('✅ RTMP Server started on port 1935');
    } catch (error) {
      console.error('❌ Failed to start RTMP server:', error);
      throw error;
    }
  }

  stop() {
    this.nms.stop();
  }
}

export const rtmpServer = new RTMPServer();