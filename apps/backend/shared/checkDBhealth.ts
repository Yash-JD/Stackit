import { prisma } from "db/client";

export const checkDatabaseConnection = async () => {
  // Find a record in the database to check if the connection is working
  const result = await prisma.user.findFirst({
    where: { isDeleted: false },
    select: { id: true },
    take: 1, // Limit to 1 record for efficiency
  });
  if (!result) {
    throw new Error("Database connection failed");
  }
};
