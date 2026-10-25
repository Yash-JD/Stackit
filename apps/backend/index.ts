import http from "node:http";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import apiDocument from "./shared/apidocs";
import authRouter from "./src/authentication";
import organizationRouter from "./src/organization";
import orgMemberRouter from "./src/orgMember";
import boardRouter from "./src/board";
import sectionRouter from "./src/section";
import issueRouter from "./src/issue";
import commentRouter from "./src/comment";
import activityRouter from "./src/activity";
import { errorHandler } from "./helper/errorHandler";
import { checkDatabaseConnection } from "./shared/checkDBhealth";
import { initWebSocketServer } from "../websocket/index";

const app = express();

const rawOrigins = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || "";
const configuredOrigins = rawOrigins
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Local development origins
      if (
        origin === "http://localhost:5173" ||
        origin === "http://localhost:3000" ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return callback(null, true);
      }

      // Explicitly configured origins from env or wildcard
      if (
        configuredOrigins.includes("*") ||
        configuredOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      // Automatically allow all Vercel domains (production & branch preview URLs)
      if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(express.json());

// API documentation route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(apiDocument));

// Health check route
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Health check route for the database
app.get("/health/db", async (_req, res) => {
  try {
    await checkDatabaseConnection(); // Function to check database connection
    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Database connection failed:", error);
    res
      .status(500)
      .json({ status: "error", message: "Database connection failed" });
  }
});

app.use(authRouter);
app.use(organizationRouter);
app.use(orgMemberRouter);
app.use(boardRouter);
app.use(sectionRouter);
app.use(issueRouter);
app.use(commentRouter);
app.use(activityRouter);

app.use(errorHandler);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const server = http.createServer(app);

// Mount WebSocket server on the same HTTP server instance
initWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API documentation available at /api-docs`);
  console.log(`Health check available at /health`);
  console.log(`Database health check available at /health/db`);
});
