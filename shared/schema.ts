import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const streams = pgTable("streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamKey: text("stream_key").notNull().unique(),
  title: text("title").notNull().default("Live Stream"),
  isLive: boolean("is_live").notNull().default(false),
  viewerCount: integer("viewer_count").notNull().default(0),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const streamSessions = pgTable("stream_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  isAuthenticated: boolean("is_authenticated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const connectionLogs = pgTable("connection_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").references(() => streams.id),
  level: text("level").notNull(), // INFO, WARN, ERROR, DEBUG
  message: text("message").notNull(),
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").notNull().default(sql`now()`),
});

export const insertStreamSchema = createInsertSchema(streams).omit({
  id: true,
  createdAt: true,
});

export const insertStreamSessionSchema = createInsertSchema(streamSessions).omit({
  id: true,
  createdAt: true,
});

export const insertConnectionLogSchema = createInsertSchema(connectionLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertStream = z.infer<typeof insertStreamSchema>;
export type Stream = typeof streams.$inferSelect;
export type InsertStreamSession = z.infer<typeof insertStreamSessionSchema>;
export type StreamSession = typeof streamSessions.$inferSelect;
export type InsertConnectionLog = z.infer<typeof insertConnectionLogSchema>;
export type ConnectionLog = typeof connectionLogs.$inferSelect;
