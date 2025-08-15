import { type Stream, type InsertStream, type StreamSession, type InsertStreamSession, type ConnectionLog, type InsertConnectionLog } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Stream management
  getCurrentStream(): Promise<Stream | undefined>;
  createStream(stream: InsertStream): Promise<Stream>;
  updateStream(id: string, updates: Partial<Stream>): Promise<Stream | undefined>;
  deleteStream(id: string): Promise<boolean>;
  
  // Stream sessions for admin auth
  createSession(session: InsertStreamSession): Promise<StreamSession>;
  getSession(sessionId: string): Promise<StreamSession | undefined>;
  updateSession(sessionId: string, updates: Partial<StreamSession>): Promise<StreamSession | undefined>;
  deleteSession(sessionId: string): Promise<boolean>;
  
  // Connection logs
  addConnectionLog(log: InsertConnectionLog): Promise<ConnectionLog>;
  getConnectionLogs(limit?: number): Promise<ConnectionLog[]>;
}

export class MemStorage implements IStorage {
  private streams: Map<string, Stream>;
  private sessions: Map<string, StreamSession>;
  private logs: ConnectionLog[];

  constructor() {
    this.streams = new Map();
    this.sessions = new Map();
    this.logs = [];
    
    // Initialize with a default stream
    const defaultStream: Stream = {
      id: randomUUID(),
      streamKey: this.generateStreamKey(),
      title: "Live Stream",
      isLive: false,
      viewerCount: 0,
      startedAt: null,
      endedAt: null,
      createdAt: new Date(),
    };
    this.streams.set(defaultStream.id, defaultStream);
  }

  private generateStreamKey(): string {
    return 'sk_live_' + randomUUID().replace(/-/g, '').substring(0, 20);
  }

  async getCurrentStream(): Promise<Stream | undefined> {
    // Return the first (and typically only) stream
    return Array.from(this.streams.values())[0];
  }

  async createStream(insertStream: InsertStream): Promise<Stream> {
    const id = randomUUID();
    const stream: Stream = {
      ...insertStream,
      id,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null,
    };
    this.streams.set(id, stream);
    return stream;
  }

  async updateStream(id: string, updates: Partial<Stream>): Promise<Stream | undefined> {
    const stream = this.streams.get(id);
    if (!stream) return undefined;
    
    const updatedStream = { ...stream, ...updates };
    this.streams.set(id, updatedStream);
    return updatedStream;
  }

  async deleteStream(id: string): Promise<boolean> {
    return this.streams.delete(id);
  }

  async createSession(insertSession: InsertStreamSession): Promise<StreamSession> {
    const id = randomUUID();
    const session: StreamSession = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<StreamSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async updateSession(sessionId: string, updates: Partial<StreamSession>): Promise<StreamSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.sessions.delete(sessionId);
  }

  async addConnectionLog(insertLog: InsertConnectionLog): Promise<ConnectionLog> {
    const log: ConnectionLog = {
      ...insertLog,
      id: randomUUID(),
      timestamp: new Date(),
    };
    this.logs.unshift(log); // Add to beginning for chronological order
    
    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
    
    return log;
  }

  async getConnectionLogs(limit: number = 50): Promise<ConnectionLog[]> {
    return this.logs.slice(0, limit);
  }
}

export const storage = new MemStorage();
