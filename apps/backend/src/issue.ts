import express, { type Response, type Request } from "express";
import { IssueSchema, UpdateIssueSchema } from "../zod";
import { prisma } from "db/client";

import { authMiddleware } from "../helper/authMiddleware";
import { hasBoardAccess } from "../helper/hasRole";

const router = express.Router();

router.post(
  "/api/v1/issue/:sectionId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const sectionId = req.params.sectionId as string;

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        isDeleted: false,
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: "SECTION_NOT_FOUND",
      });
    }
    if (!(await hasBoardAccess(userId, section.boardId))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const { success, data } = IssueSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
      });
    }

    const issue = await prisma.$transaction(async (transaction) => {
      const createdIssue = await transaction.issue.create({
        data: {
          title: data.title,
          description: data.description,
          label: data.label,
          dueDate: data.dueDate
            ? new Date(`${data.dueDate}T00:00:00.000Z`)
            : null,
          sectionId: section.id,
          boardId: section.boardId,
        },
      });
      await transaction.issueActivity.create({
        data: {
          issueId: createdIssue.id,
          actorId: userId,
          action: "created",
        },
      });
      return createdIssue;
    });

    return res.status(200).json({
      success: true,
      data: issue,
    });
  },
);

router.get(
  "/api/v1/issue/:sectionId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const sectionId = req.params.sectionId as string;

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        isDeleted: false,
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: {
        id: true,
        boardId: true,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: "SECTION_NOT_FOUND",
      });
    }
    if (!(await hasBoardAccess(userId, section.boardId))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const issues = await prisma.issue.findMany({
      where: { sectionId, isDeleted: false },
    });

    return res.status(200).json({
      success: true,
      data: issues,
    });
  },
);

router.put(
  "/api/v1/issue/:issueId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const issueId = req.params.issueId as string;

    const { success, data } = UpdateIssueSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
      });
    }

    const existingIssue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        section: { isDeleted: false },
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: {
        id: true,
        boardId: true,
        title: true,
        description: true,
        label: true,
        dueDate: true,
      },
    });

    if (!existingIssue) {
      return res.status(404).json({
        success: false,
        error: "ISSUE_NOT_FOUND",
      });
    }
    if (!(await hasBoardAccess(userId, existingIssue.boardId))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const changedFields = [
      data.title !== undefined && data.title !== existingIssue.title
        ? "title"
        : null,
      data.description !== undefined &&
      data.description !== existingIssue.description
        ? "description"
        : null,
      data.label !== undefined && data.label !== existingIssue.label
        ? "label"
        : null,
      data.dueDate !== undefined &&
      (data.dueDate
        ? new Date(`${data.dueDate}T00:00:00.000Z`).getTime()
        : null) !== (existingIssue.dueDate?.getTime() ?? null)
        ? "due date"
        : null,
    ].filter((field): field is string => field !== null);

    const issue = await prisma.$transaction(async (transaction) => {
      const updatedIssue = await transaction.issue.update({
        where: { id: issueId },
        data: {
          title: data.title,
          description: data.description,
          label: data.label,
          ...(data.dueDate !== undefined && {
            dueDate: data.dueDate
              ? new Date(`${data.dueDate}T00:00:00.000Z`)
              : null,
          }),
        },
      });
      if (changedFields.length > 0) {
        await transaction.issueActivity.create({
          data: {
            issueId,
            actorId: userId,
            action: "updated",
            details: changedFields.join(", "),
          },
        });
      }
      return updatedIssue;
    });

    return res.status(200).json({
      success: true,
      data: issue,
    });
  },
);

router.get(
  "/api/v1/issue/:issueId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const issueId = req.params.issueId as string;

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        section: { isDeleted: false },
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: "ISSUE_NOT_FOUND",
      });
    }
    if (!(await hasBoardAccess(userId, issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    return res.status(200).json({
      success: true,
      data: issue,
    });
  },
);

router.delete(
  "/api/v1/issue/:issueId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const issueId = req.params.issueId as string;

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        section: { isDeleted: false },
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: { id: true, boardId: true },
    });
    if (!issue) {
      return res.status(404).json({
        success: false,
        error: "ISSUE_NOT_FOUND",
      });
    }
    if (!(await hasBoardAccess(userId, issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    await prisma.issue.update({
      where: {
        id: issueId,
      },
      data: {
        isDeleted: true,
      },
    });

    return res.status(200).json({
      success: true,
      msg: "DELETED_SUCCESSFULLY",
    });
  },
);

router.put(
  "/api/v1/issue/move/:issueId/:sectionId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const issueId = req.params.issueId as string;
    const newSectionId = req.params.sectionId as string;

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        isDeleted: false,
        section: { isDeleted: false },
        board: { isDeleted: false, organization: { isDeleted: false } },
      },
      select: {
        id: true,
        boardId: true,
        section: { select: { title: true } },
      },
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: "ISSUE_NOT_FOUND",
      });
    }
    if (!(await hasBoardAccess(userId, issue.boardId))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const section = await prisma.section.findFirst({
      where: {
        id: newSectionId,
        boardId: issue.boardId,
        isDeleted: false,
      },
    });

    if (!section) {
      return res.status(404).json({
        success: false,
        error: "SECTION_NOT_FOUND",
      });
    }

    const updatedIssue = await prisma.$transaction(async (transaction) => {
      const movedIssue = await transaction.issue.update({
        where: { id: issueId },
        data: { sectionId: newSectionId },
      });
      await transaction.issueActivity.create({
        data: {
          issueId,
          actorId: userId,
          action: "moved",
          details: `${issue.section.title} to ${section.title}`,
        },
      });
      return movedIssue;
    });

    return res.status(200).json({
      success: true,
      data: updatedIssue,
    });
  },
);

export default router;
