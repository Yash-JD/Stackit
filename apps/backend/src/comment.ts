import express, { type Response, type Request } from "express";
import { CommentsSchema } from "../zod";
import { prisma } from "db/client";

import { authMiddleware } from "../helper/authMiddleware";
import { hasBoardAccess } from "../helper/hasRole";
import { COMMON_ERRORS, COMMENT_ERRORS } from "../helper/errors";

const router = express.Router();

router.post(
  "/api/v1/comment/:issueId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = CommentsSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: COMMON_ERRORS.INVALID_DATA,
      });
    }
    const userId = req.id;
    const issueId = req.params.issueId as string;

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!issue || !(await hasBoardAccess(userId, issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: COMMON_ERRORS.UNAUTHORIZED,
      });
    }

    const comment = await prisma.$transaction(async (transaction) => {
      const createdComment = await transaction.comments.create({
        data: {
          issueId,
          comment: data.comment,
          userId,
        },
        include: {
          user: {
            select: { id: true, email: true, profilePhoto: true },
          },
        },
      });
      await transaction.issueActivity.create({
        data: { issueId, actorId: userId, action: "commented" },
      });
      return createdComment;
    });

    return res.status(200).json({
      success: true,
      data: { ...comment, isAuthor: true },
    });
  },
);

router.put(
  "/api/v1/comment/:commentId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = CommentsSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: COMMON_ERRORS.INVALID_DATA,
      });
    }
    const userId = req.id;
    const commentId = req.params.commentId as string;

    const comment = await prisma.comments.findFirst({
      where: {
        id: commentId,
        isDeleted: false,
        issue: {
          isDeleted: false,
          board: {
            isDeleted: false,
            organization: { isDeleted: false },
          },
        },
      },
      include: {
        issue: { select: { boardId: true } },
      },
    });

    if (!comment || !(await hasBoardAccess(userId, comment.issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: COMMON_ERRORS.UNAUTHORIZED,
      });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: COMMENT_ERRORS.NOT_COMMENT_AUTHOR,
      });
    }

    const comments = await prisma.$transaction(async (transaction) => {
      const updatedComment = await transaction.comments.update({
        where: { id: commentId },
        data: { comment: data.comment },
      });
      await transaction.issueActivity.create({
        data: {
          issueId: comment.issueId,
          actorId: userId,
          action: "comment_edited",
        },
      });
      return updatedComment;
    });

    return res.status(200).json({
      success: true,
      data: comments,
    });
  },
);

router.get(
  "/api/v1/comment/:issueId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const issueId = req.params.issueId as string;

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        board: {
          isDeleted: false,
          organization: { isDeleted: false },
        },
      },
      include: {
        comments: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { id: true, email: true, profilePhoto: true },
            },
          },
        },
      },
    });

    if (!issue || !(await hasBoardAccess(userId, issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: COMMON_ERRORS.UNAUTHORIZED,
      });
    }

    return res.status(200).json({
      success: true,
      data: issue.comments.map((comment) => ({
        ...comment,
        isAuthor: comment.userId === userId,
      })),
    });
  },
);

router.delete(
  "/api/v1/comment/:commentId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const commentId = req.params.commentId as string;

    const comment = await prisma.comments.findFirst({
      where: {
        id: commentId,
        isDeleted: false,
        issue: {
          isDeleted: false,
          board: {
            isDeleted: false,
            organization: { isDeleted: false },
          },
        },
      },
      include: {
        issue: { select: { boardId: true } },
      },
    });

    if (!comment || !(await hasBoardAccess(userId, comment.issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: COMMON_ERRORS.UNAUTHORIZED,
      });
    }

    if (comment.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: COMMENT_ERRORS.NOT_COMMENT_AUTHOR,
      });
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.comments.update({
        where: { id: commentId },
        data: { isDeleted: true },
      });
      await transaction.issueActivity.create({
        data: {
          issueId: comment.issueId,
          actorId: userId,
          action: "comment_deleted",
        },
      });
    });

    return res.status(200).json({
      success: true,
      msg: "COMMENT_SUCCESSFULLY_DELETED",
    });
  },
);

export default router;
