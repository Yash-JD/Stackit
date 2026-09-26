import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import apiDocument from "./src/apidocs";
import authRouter from "./src/authentication";
import organizationRouter from "./src/organization";
import orgMemberRouter from "./src/orgMember";
import boardRouter from "./src/board";
import sectionRouter from "./src/section";
import issueRouter from "./src/issue";
import commentRouter from "./src/comment";
import { errorHandler } from "./helper/errorHandler";
import { checkDatabaseConnection } from "./shared/checkDBhealth";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
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

app.use(errorHandler);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
