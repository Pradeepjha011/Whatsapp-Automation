import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server as SocketIOServer } from "socket.io";

import { initializeDatabase } from "./db/index.js";
import contactsRouter from "./routes/contacts.js";
import contactUpsertRouter from "./routes/contactUpsert.js";
import messagesRouter from "./routes/messages.js";
import sendMessageRouter from "./routes/sendMessage.js";
import settingsRouter from "./routes/settings.js";
import templatesRouter from "./routes/templates.js";
import testingRouter from "./routes/testing.js";
import webhookRouter from "./routes/webhook.js";
import { startCrmSync } from "./services/crmSyncService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
const server = http.createServer(app);
const frontendDistPath = path.resolve(__dirname, "../frontend/dist");
const isProduction = process.env.NODE_ENV === "production";
const shouldServeFrontend = isProduction || process.env.SERVE_FRONTEND === "true";
const allowTestingRoutes = !isProduction || process.env.ENABLE_TESTING_ROUTES === "true";
const enableCrmSync = process.env.ENABLE_CRM_SYNC !== "false";
const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";
const corsOriginHandler = (origin, callback) => {
  if (!origin || origin === allowedOrigin) {
    return callback(null, true);
  }

  return callback(new Error(`CORS blocked for origin ${origin}`), false);
};
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
  }),
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "running" });
});

if (!shouldServeFrontend) {
  app.get("/", (_req, res) => {
    res.json({ name: "whatsapp-crm-inbox-backend", status: "running" });
  });
}

app.use("/contacts", contactsRouter);
app.use("/contact", contactUpsertRouter);
app.use("/messages", messagesRouter);
app.use("/send-message", sendMessageRouter);
app.use("/settings", settingsRouter);
app.use("/templates", templatesRouter);
if (allowTestingRoutes) {
  app.use("/testing", testingRouter);
}
app.use("/webhook/whatsapp", webhookRouter);

if (shouldServeFrontend) {
  app.use(express.static(frontendDistPath));

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/contacts") ||
      req.path.startsWith("/contact") ||
      req.path.startsWith("/messages") ||
      req.path.startsWith("/send-message") ||
      req.path.startsWith("/settings") ||
      req.path.startsWith("/templates") ||
      req.path.startsWith("/testing") ||
      req.path.startsWith("/webhook/whatsapp") ||
      req.path === "/health"
    ) {
      return next();
    }

    return res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  console.log(`🔌 Client Joined: ${socket.id} | Origin: ${socket.handshake.headers.origin || "undefined"}`);
  socket.emit("connection:ready", { connectedAt: new Date().toISOString() });
  socket.on("disconnect", (reason) => {
    console.log(`❌ Client Left: ${socket.id} | Reason: ${reason}`);
  });
});

const port = Number(process.env.PORT || 4000);

initializeDatabase()
  .then(() => {
    if (enableCrmSync) {
      startCrmSync(io);
    } else {
      console.log("CRM sync disabled by configuration");
    }
    server.listen(port, () => {
      console.log(`WhatsApp CRM inbox backend running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });
