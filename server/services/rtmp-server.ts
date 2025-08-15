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

export class RTMPServer {
  private nms: any;

  constructor() {
    this.nms = new NodeMediaServer(config);
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Add universal event listener for debugging
    const originalEmit = this.nms.emit;
    this.nms.emit = function(...args: any[]) {
      console.log('🔍 NMS Event fired:', args[0], 'with', args.length - 1, 'parameters');
      if (args[0] && (args[0].includes('publish') || args[0].includes('connect'))) {
        console.log('🔍 Event details:', JSON.stringify(args.slice(1), null, 2));
      }
      return originalEmit.apply(this, args);
    };

    this.nms.on('preConnect', (id: string, args: any) => {
      console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
    });

    this.nms.on('postConnect', (id: string, args: any) => {
      console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
    });

    this.nms.on('doneConnect', (id: string, args: any) => {
      console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
    });

    this.nms.on('prePublish', async (id: any, StreamPath?: any, args?: any) => {
      console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${args ? JSON.stringify(args) : 'undefined'}`);
      console.log('Debug - typeof id:', typeof id, 'typeof StreamPath:', typeof StreamPath, 'typeof args:', typeof args);
      console.log('Debug - id content:', JSON.stringify(id, null, 2));
      
      let actualStreamPath: string | null = null;
      let sessionId: string | null = null;
      
      // Extract session ID and stream path from the id object
      if (id && typeof id === 'object') {
        console.log('🔍 Analyzing id object:', Object.keys(id));
        
        // Try different possible property names
        sessionId = id.id || id.sessionId || id.playStreamId || id.publishStreamId || null;
        actualStreamPath = id.streamPath || id.StreamPath || id.publishStreamPath || id.path || null;
        
        if (!actualStreamPath) {
          // Sometimes the path might be constructed from app and stream properties
          if (id.publishStreamPath) {
            actualStreamPath = id.publishStreamPath;
          } else if (id.app && id.stream) {
            actualStreamPath = `/${id.app}/${id.stream}`;
          }
        }
        
        console.log('🔍 Extracted sessionId:', sessionId, 'actualStreamPath:', actualStreamPath);
      }
      
      // Fallback to original parameters if object parsing didn't work
      if (!actualStreamPath) {
        if (typeof StreamPath === 'string' && StreamPath.startsWith('/')) {
          actualStreamPath = StreamPath;
        } else if (typeof id === 'string' && id.startsWith('/')) {
          actualStreamPath = id;
        } else if (args && typeof args === 'string' && args.startsWith('/')) {
          actualStreamPath = args;
        }
      }
      
      // Check if StreamPath is valid
      if (!actualStreamPath || typeof actualStreamPath !== 'string') {
        console.log('❌ Invalid StreamPath after all attempts:', actualStreamPath);
        // Try to reject using session ID
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
      
      // Extract stream key from path (format: /live/STREAM_KEY)
      const pathParts = actualStreamPath.split('/');
      if (pathParts.length < 3) {
        console.log('❌ Invalid StreamPath format:', actualStreamPath);
        // Try to reject using different API methods
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
      
      // Validate stream key
      const currentStream = await storage.getCurrentStream();
      if (!currentStream || currentStream.streamKey !== streamKey) {
        console.log('❌ Invalid stream key:', streamKey);
        // Try to reject using different API methods
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

      // Log connection
      await storage.addConnectionLog({
        streamId: currentStream.id,
        level: 'INFO',
        message: `Stream started with key: ${streamKey}`,
        ipAddress: args?.ip || 'unknown'
      });
    });

    this.nms.on('postPublish', async (id: any, StreamPath?: any, args?: any) => {
      console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${args ? JSON.stringify(args) : 'undefined'}`);
      console.log('Debug postPublish - typeof id:', typeof id, 'typeof StreamPath:', typeof StreamPath, 'typeof args:', typeof args);
      console.log('Debug postPublish - id content:', JSON.stringify(id, null, 2));
      
      let actualStreamPath: string | null = null;
      let sessionId: string | null = null;
      
      // Extract session ID and stream path from the id object
      if (id && typeof id === 'object') {
        console.log('🔍 Analyzing id object in postPublish:', Object.keys(id));
        
        sessionId = id.id || id.sessionId || id.playStreamId || id.publishStreamId || null;
        actualStreamPath = id.streamPath || id.StreamPath || id.publishStreamPath || id.path || null;
        
        if (!actualStreamPath) {
          if (id.publishStreamPath) {
            actualStreamPath = id.publishStreamPath;
          } else if (id.app && id.stream) {
            actualStreamPath = `/${id.app}/${id.stream}`;
          }
        }
        
        console.log('🔍 Extracted in postPublish - sessionId:', sessionId, 'actualStreamPath:', actualStreamPath);
      }
      
      // Fallback to original parameters if object parsing didn't work
      if (!actualStreamPath) {
        if (typeof StreamPath === 'string' && StreamPath.startsWith('/')) {
          actualStreamPath = StreamPath;
        } else if (typeof id === 'string' && id.startsWith('/')) {
          actualStreamPath = id;
        } else if (args && typeof args === 'string' && args.startsWith('/')) {
          actualStreamPath = args;
        }
      }
      
      if (!actualStreamPath || typeof actualStreamPath !== 'string') {
        console.log('❌ Invalid StreamPath in postPublish after all attempts:', actualStreamPath);
        return;
      }
      
      const pathParts = actualStreamPath.split('/');
      if (pathParts.length < 3) {
        console.log('❌ Invalid StreamPath format in postPublish:', actualStreamPath);
        return;
      }
      
      const streamKey = pathParts[2];
      const currentStream = await storage.getCurrentStream();
      
      if (currentStream && currentStream.streamKey === streamKey) {
        console.log('✅ Stream is now live!');
        
        // Mark stream as live
        await storage.updateStream(currentStream.id, {
          isLive: true,
          startedAt: new Date()
        });
        
        // Notify clients via WebSocket
        streamManager.broadcastStreamStatus({
          isLive: true,
          viewerCount: 0,
          streamKey: currentStream.streamKey
        });

        await storage.addConnectionLog({
          streamId: currentStream.id,
          level: 'INFO',
          message: 'Stream is now live',
          ipAddress: args?.ip || 'unknown'
        });
      }
    });

    this.nms.on('donePublish', async (id: any, StreamPath?: any, args?: any) => {
      console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${args ? JSON.stringify(args) : 'undefined'}`);
      console.log('Debug donePublish - typeof id:', typeof id, 'typeof StreamPath:', typeof StreamPath, 'typeof args:', typeof args);
      console.log('Debug donePublish - id content:', JSON.stringify(id, null, 2));
      
      let actualStreamPath: string | null = null;
      let sessionId: string | null = null;
      
      // Extract session ID and stream path from the id object
      if (id && typeof id === 'object') {
        console.log('🔍 Analyzing id object in donePublish:', Object.keys(id));
        
        sessionId = id.id || id.sessionId || id.playStreamId || id.publishStreamId || null;
        actualStreamPath = id.streamPath || id.StreamPath || id.publishStreamPath || id.path || null;
        
        if (!actualStreamPath) {
          if (id.publishStreamPath) {
            actualStreamPath = id.publishStreamPath;
          } else if (id.app && id.stream) {
            actualStreamPath = `/${id.app}/${id.stream}`;
          }
        }
        
        console.log('🔍 Extracted in donePublish - sessionId:', sessionId, 'actualStreamPath:', actualStreamPath);
      }
      
      // Fallback to original parameters if object parsing didn't work
      if (!actualStreamPath) {
        if (typeof StreamPath === 'string' && StreamPath.startsWith('/')) {
          actualStreamPath = StreamPath;
        } else if (typeof id === 'string' && id.startsWith('/')) {
          actualStreamPath = id;
        } else if (args && typeof args === 'string' && args.startsWith('/')) {
          actualStreamPath = args;
        }
      }
      
      if (!actualStreamPath || typeof actualStreamPath !== 'string') {
        console.log('❌ Invalid StreamPath in donePublish after all attempts:', actualStreamPath);
        return;
      }
      
      const pathParts = actualStreamPath.split('/');
      if (pathParts.length < 3) {
        console.log('❌ Invalid StreamPath format in donePublish:', actualStreamPath);
        return;
      }
      
      const streamKey = pathParts[2];
      const currentStream = await storage.getCurrentStream();
      
      if (currentStream && currentStream.streamKey === streamKey) {
        console.log('✅ Stream ended');
        
        // Mark stream as offline
        await storage.updateStream(currentStream.id, {
          isLive: false,
          endedAt: new Date(),
          viewerCount: 0
        });
        
        // Notify clients via WebSocket
        streamManager.broadcastStreamStatus({
          isLive: false,
          viewerCount: 0,
          streamKey: currentStream.streamKey
        });

        await storage.addConnectionLog({
          streamId: currentStream.id,
          level: 'INFO',
          message: 'Stream ended',
          ipAddress: args?.ip || 'unknown'
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
