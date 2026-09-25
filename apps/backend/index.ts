import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import apiDocument from "./src/apidocs";
import authRouter from "./src/authentication";
import organizationRouter from "./src/organization";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// API documentation route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(apiDocument));

app.use(authRouter);
app.use(organizationRouter);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
