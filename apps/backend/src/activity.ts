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

router.get(
  "/api/v1/organization/:orgId/activity",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = req.params.orgId as string;
    const userId = req.id;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: "PLEASE_PROVIDE_ORGID",
      });
    }

    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        orgId,
        isDeleted: false,
        organization: { isDeleted: false },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const activities = await prisma.issueActivity.findMany({
      where: {
        issue: {
          isDeleted: false,
          board: {
            orgId,
            isDeleted: false,
            organization: { isDeleted: false },
            ...(membership.role === "member"
              ? {
                  memberships: {
                    some: {
                      userId,
                      isDeleted: false,
                    },
                  },
                }
              : {}),
          },
        },
      },
      include: {
        actor: {
          select: { id: true, email: true, name: true, profilePhoto: true },
        },
        issue: {
          select: {
            id: true,
            title: true,
            boardId: true,
            board: {
              select: { id: true, title: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.status(200).json({
      success: true,
      data: { activities },
    });
  },
);

export default router;
