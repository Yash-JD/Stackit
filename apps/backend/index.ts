import express from "express";
import { prisma } from "db/client";

const app = express();

app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.create({
    data: {
      username,
      password,
    },
  });
  res.json(user);
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
