import { prisma } from "db/client";

export const checkDatabaseConnection = async () => {
  // Find a record in the database to check if the connection is working
  const result = await prisma.user.findFirst();
  if (!result) {
    throw new Error("Database connection failed");
  }
};
