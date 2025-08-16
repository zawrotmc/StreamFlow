import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import session from "express-session";
import { storage } from "./storage";
import { streamManager } from "./services/stream-manager";
import { rtmpServer } from "./services/rtmp-server";
import { insertStreamSchema } from "@shared/schema";
import { randomUUID } from "crypto";
import dotenv from "dotenv";

dotenv.config();

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "streaming-platform-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000,
      },
    }),
  );

  try {
    rtmpServer.start();
    console.log("✅ RTMP server started on port 1935");
  } catch (error) {
    console.error("❌ Failed to start RTMP server:", error);
    console.log("   Make sure port 1935 is not in use");
  }

  app.get("/api/stream/status", async (req, res) => {
    try {
      const currentStream = await storage.getCurrentStream();
      if (!currentStream) {
        return res.status(404).json({ message: "No stream found" });
      }

      res.json({
        isLive: currentStream.isLive,
        viewerCount: currentStream.viewerCount,
        title: currentStream.title,
        streamUrl: currentStream.isLive
          ? `/api/stream/live/${currentStream.streamKey}`
          : null,
      });
    } catch (error) {
      console.error("Error getting stream status:", error);
      res.status(500).json({ message: "Failed to get stream status" });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const { password } = req.body;

      console.log("Login attempt - received password:", password);
      console.log("Login attempt - password type:", typeof password);

      const adminPassword = process.env.ADMIN_PASSWORD || "123";
      console.log("Expected password:", adminPassword);

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      if (String(password).trim() !== String(adminPassword)) {
        return res.status(401).json({ message: "Invalid password" });
      }

      const sessionId = randomUUID();
      await storage.createSession({
        sessionId,
        isAuthenticated: true,
      });

      (req.session as any).sessionId = sessionId;
      (req.session as any).isAuthenticated = true;

      console.log("✅ Login successful for session:", sessionId);
      res.json({ message: "Authentication successful" });
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.post("/api/admin/logout", async (req, res) => {
    try {
      const sessionId = (req.session as any).sessionId;
      if (sessionId) {
        await storage.deleteSession(sessionId);
      }

      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Logout failed" });
        }
        res.json({ message: "Logout successful" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/admin/auth", async (req, res) => {
    try {
      const sessionId = (req.session as any).sessionId;
      const isAuthenticated = (req.session as any).isAuthenticated;

      if (!sessionId || !isAuthenticated) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const session = await storage.getSession(sessionId);
      if (!session || !session.isAuthenticated) {
        return res.status(401).json({ message: "Invalid session" });
      }

      res.json({ message: "Authenticated" });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Authentication check failed" });
    }
  });

  app.get("/api/admin/stream", async (req, res) => {
    try {
      const sessionId = (req.session as any).sessionId;
      const isAuthenticated = (req.session as any).isAuthenticated;

      if (!sessionId || !isAuthenticated) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentStream = await storage.getCurrentStream();
      if (!currentStream) {
        return res.status(404).json({ message: "No stream found" });
      }

      const logs = await storage.getConnectionLogs(20);

      let rtmpUrl;
      const host = req.get("host");
      
      if (host) {
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
          rtmpUrl = `rtmp://localhost:1935/live`;
        } else {
          rtmpUrl = `rtmp://${host}:1935/live`;
        }
      } else {
        rtmpUrl = `rtmp://localhost:1935/live`;
      }
      
      res.json({
        stream: currentStream,
        rtmpUrl,
        logs,
      });
    } catch (error) {
      console.error("Get stream config error:", error);
      res.status(500).json({ message: "Failed to get stream configuration" });
    }
  });

  app.post("/api/admin/stream/regenerate-key", async (req, res) => {
    try {
      const sessionId = (req.session as any).sessionId;
      const isAuthenticated = (req.session as any).isAuthenticated;

      if (!sessionId || !isAuthenticated) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentStream = await storage.getCurrentStream();
      if (!currentStream) {
        return res.status(404).json({ message: "No stream found" });
      }

      const newStreamKey = await storage.regenerateStreamKey(currentStream.id);

      await storage.addConnectionLog({
        streamId: currentStream.id,
        level: "INFO",
        message: "Stream key regenerated",
        ipAddress: req.ip || "unknown",
      });

      console.log('🔑 Stream key regenerated:', newStreamKey);
      res.json({ streamKey: newStreamKey });
    } catch (error) {
      console.error("Regenerate key error:", error);
      res.status(500).json({ message: "Failed to regenerate stream key" });
    }
  });

  app.post("/api/admin/stream/stop", async (req, res) => {
    try {
      const sessionId = (req.session as any).sessionId;
      const isAuthenticated = (req.session as any).isAuthenticated;

      if (!sessionId || !isAuthenticated) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentStream = await storage.getCurrentStream();
      if (!currentStream) {
        return res.status(404).json({ message: "No stream found" });
      }

      await storage.updateStream(currentStream.id, {
        isLive: false,
        endedAt: new Date(),
        viewerCount: 0,
      });

      streamManager.broadcastStreamStatus({
        isLive: false,
        viewerCount: 0,
        streamKey: currentStream.streamKey,
      });

      await storage.addConnectionLog({
        streamId: currentStream.id,
        level: "INFO",
        message: "Stream manually stopped by admin",
        ipAddress: req.ip || "unknown",
      });

      res.json({ message: "Stream stopped" });
    } catch (error) {
      console.error("Stop stream error:", error);
      res.status(500).json({ message: "Failed to stop stream" });
    }
  });

  app.get("/api/stream/hls/:streamKey/:file", async (req, res) => {
    try {
      const { streamKey, file } = req.params;
      const currentStream = await storage.getCurrentStream();

      if (
        !currentStream ||
        currentStream.streamKey !== streamKey ||
        !currentStream.isLive
      ) {
        return res.status(404).json({ message: "Stream not found or offline" });
      }

      if (file === "index.m3u8") {
        try {
          const updatedStream = await storage.updateStream(currentStream.id, {
            viewerCount: currentStream.viewerCount + 1,
          });

          if (updatedStream) {
            streamManager.broadcastViewerUpdate(updatedStream.viewerCount);
          }
        } catch (error) {
          console.error("Failed to update viewer count:", error);
        }
      }

      const streamUrl = `http://localhost:8888/live/${streamKey}/${file}`;
      console.log(`📡 Redirecting to HLS stream: ${streamUrl}`);
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.redirect(streamUrl);
    } catch (error) {
      console.error("HLS stream error:", error);
      res.status(500).json({ message: "Failed to serve HLS stream" });
    }
  });

  app.get("/api/stream/live/:streamKey", async (req, res) => {
    try {
      const { streamKey } = req.params;
      const currentStream = await storage.getCurrentStream();

      if (
        !currentStream ||
        currentStream.streamKey !== streamKey ||
        !currentStream.isLive
      ) {
        return res.status(404).json({ message: "Stream not found or offline" });
      }

      try {
        const updatedStream = await storage.updateStream(currentStream.id, {
          viewerCount: currentStream.viewerCount + 1,
        });

        if (updatedStream) {
          streamManager.broadcastViewerUpdate(updatedStream.viewerCount);
        }
      } catch (error) {
        console.error("Failed to update viewer count:", error);
      }

      const streamUrl = `http://localhost:8888/live/${streamKey}.flv`;
      console.log(`📡 Redirecting to FLV stream: ${streamUrl}`);
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.redirect(streamUrl);
    } catch (error) {
      console.error("Stream endpoint error:", error);
      res.status(500).json({ message: "Failed to serve stream" });
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    perMessageDeflate: false,
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (ws: WebSocket, req) => {
    console.log(
      `🔗 WebSocket client connected from ${req.socket.remoteAddress}`,
    );

    streamManager.addClient(ws);

    storage
      .getCurrentStream()
      .then((stream) => {
        if (stream) {
          ws.send(
            JSON.stringify({
              type: "streamStatus",
              data: {
                isLive: stream.isLive,
                viewerCount: stream.viewerCount,
                title: stream.title,
              },
            }),
          );
        }
      })
      .catch((error) => {
        console.error("Failed to send initial stream status:", error);
      });

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log("📨 WebSocket message received:", data);

        switch (data.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          default:
            console.log("Unknown WebSocket message type:", data.type);
        }
      } catch (error) {
        console.error("Invalid WebSocket message:", error);
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`🔌 WebSocket client disconnected: ${code} ${reason}`);
      streamManager.removeClient(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      streamManager.removeClient(ws);
    });
  });

  wss.on("error", (error) => {
    console.error("WebSocket Server error:", error);
  });

  return httpServer;
}