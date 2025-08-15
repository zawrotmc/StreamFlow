import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

// Node.js 18 compatible __dirname alternative
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );
      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  
  console.log(`🔍 Looking for static files in: ${distPath}`);
  
  if (!fs.existsSync(distPath)) {
    console.warn(`⚠️ Build directory not found: ${distPath}`);
    console.log(`📁 Available directories:`);
    try {
      const parentDir = path.dirname(distPath);
      const files = fs.readdirSync(parentDir);
      files.forEach(file => {
        const fullPath = path.join(parentDir, file);
        const stat = fs.statSync(fullPath);
        console.log(`   ${stat.isDirectory() ? '📁' : '📄'} ${file}`);
      });
    } catch (error) {
      console.error(`❌ Cannot read parent directory:`, error);
    }
    
    // Try alternative paths
    const altPaths = [
      path.resolve(__dirname, "..", "public"),
      path.resolve(process.cwd(), "dist", "public"),
      path.resolve(process.cwd(), "public"),
    ];
    
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`✅ Found alternative path: ${altPath}`);
        app.use(express.static(altPath));
        app.use("*", (_req, res) => {
          res.sendFile(path.resolve(altPath, "index.html"));
        });
        return;
      }
    }
    
    throw new Error(
      `Could not find the build directory. Tried: ${[distPath, ...altPaths].join(', ')}`
    );
  }
  
  app.use(express.static(distPath));
  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}