import express, { type Request, type Response } from "express";
import { prisma } from "db/client";
import { authMiddleware } from "../helper/authMiddleware";
import { hasBoardAccess } from "../helper/hasRole";

const router = express.Router();

router.get(
  "/api/v1/activity/:issueId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const issueId = req.params.issueId as string;
    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: { boardId: true },
    });

    if (!issue || !(await hasBoardAccess(req.id, issue.boardId))) {
      return res.status(404).json({
        success: false,
        error: "ISSUE_NOT_FOUND",
      });
    }

    const activities = await prisma.issueActivity.findMany({
      where: { issueId },
      include: {
        actor: { select: { id: true, email: true, profilePhoto: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: { activities },
    });
  },
);

export default router;
