import express from "express";
import cors from "cors";
import { prisma } from "db/client";
import authRouter from "./src/authentication";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use(authRouter);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
