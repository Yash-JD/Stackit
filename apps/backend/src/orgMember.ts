import express, { type Response, type Request } from "express";
import {
  MembershipSchema,
  UpdateMemberBoardsSchema,
  UpdateMemberRoleSchema,
} from "../zod";
import { prisma } from "db/client";

import { authMiddleware } from "../helper/authMiddleware";
import { hasRole } from "../helper/hasRole";
import { sendInviteEmail } from "../helper/email";
import { deliverInvitationEmail } from "../helper/invitationDelivery";
import { getMembershipMutationBlockReason } from "../helper/membershipMutationPolicy";

const router = express.Router();

router.post(
  "/api/v1/invite",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = MembershipSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DATA",
      });
    }

    const adminId = req.id;

    if (!(await hasRole(adminId, data.orgId, "superadmin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED_ONLY_SUPERADMIN_CAN_INVITE",
      });
    }

    const boardIds = [...new Set(data.boardIds)];
    const boards = await prisma.boards.findMany({
      where: {
        id: { in: boardIds },
        orgId: data.orgId,
        isDeleted: false,
        organization: { isDeleted: false },
      },
      select: { id: true },
    });
    if (boards.length !== boardIds.length) {
      return res.status(400).json({
        success: false,
        error: "INVALID_BOARD_ASSIGNMENT",
      });
    }

    const normalizedEmail = data.email.trim().toLowerCase();
    const invitee = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (
      invitee &&
      (await prisma.membership.findFirst({
        where: {
          userId: invitee.id,
          orgId: data.orgId,
          isDeleted: false,
        },
        select: { id: true },
      }))
    ) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_WORKSPACE_MEMBER",
      });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        orgId: data.orgId,
        status: "PENDING",
        isDeleted: false,
      },
    });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        error: "INVITATION_ALREADY_SENT",
      });
    }

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        orgId: data.orgId,
        invitedBy: adminId,
        role: "member",
        boards: {
          create: boardIds.map((boardId) => ({ boardId })),
        },
      },
    });

    const org = await prisma.organization.findUnique({
      where: {
        id: data.orgId,
        isDeleted: false,
      },
    });
    const emailSent = await deliverInvitationEmail(
      () =>
        sendInviteEmail(
          `${org?.name || "Stackit"} <onboarding@resend.dev>`,
          normalizedEmail,
          org?.name ?? "an organization",
          invitation.id,
        ),
      async () => {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: "FAILED" },
        });
      },
    );
    if (!emailSent) {
      return res.status(200).json({
        success: true,
        msg: "INVITATION_EMAIL_FAILED",
        data: { invitationId: invitation.id, emailSent: false },
      });
    }

    return res.status(200).json({
      success: true,
      msg: "INVITATION_SENT",
      data: { invitationId: invitation.id, emailSent: true },
    });
  },
);

router.get(
  "/api/v1/invitation/pending",
  authMiddleware,
  async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.id, isDeleted: false },
      select: { email: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
      });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        email: user.email,
        status: "PENDING",
        isDeleted: false,
      },
      include: {
        org: { select: { id: true, name: true } },
        boards: {
          include: {
            board: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: { invitations },
    });
  },
);

router.get(
  "/api/v1/invitation/organization/:orgId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = req.params.orgId as string;

    if (!(await hasRole(req.id, orgId, "admin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const invitations = await prisma.invitation.findMany({
      where: {
        orgId,
        status: { in: ["PENDING", "FAILED"] },
        isDeleted: false,
      },
      include: {
        inviter: { select: { email: true } },
        boards: {
          include: {
            board: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      data: { invitations },
    });
  },
);

router.post(
  "/api/v1/accept/:inviteId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const inviteId = req.params.inviteId as string;

    const invite = await prisma.invitation.findFirst({
      where: {
        id: inviteId,
        isDeleted: false,
        status: "PENDING",
        org: { isDeleted: false },
      },
      include: {
        boards: { select: { boardId: true } },
      },
    });
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "INVITATION_NOT_FOUND",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        isDeleted: false,
      },
    });

    if (user?.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: "INVITATION_NOT_FOUND",
      });
    }

    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId,
        orgId: invite.orgId,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_ADDED",
      });
    }

    const accepted = await prisma.$transaction(async (transaction) => {
      const claimedInvitation = await transaction.invitation.updateMany({
        where: {
          id: invite.id,
          status: "PENDING",
          isDeleted: false,
        },
        data: { status: "ACCEPTED" },
      });
      if (claimedInvitation.count !== 1) return false;

      const membership = await transaction.membership.findUnique({
        where: {
          userId_orgId: { userId, orgId: invite.orgId },
        },
      });
      if (membership?.isDeleted) {
        await transaction.membership.update({
          where: {
            userId_orgId: { userId, orgId: invite.orgId },
          },
          data: { isDeleted: false, role: "member" },
        });
      } else if (!membership) {
        await transaction.membership.create({
          data: {
            userId,
            orgId: invite.orgId,
            role: "member",
          },
        });
      }

      for (const { boardId } of invite.boards) {
        await transaction.boardMembership.upsert({
          where: { userId_boardId: { userId, boardId } },
          create: { userId, boardId },
          update: { isDeleted: false },
        });
      }

      return true;
    });

    if (!accepted) {
      return res.status(400).json({
        success: false,
        error: "INVITATION_ACCEPTED_OR_DECLINED",
      });
    }

    return res.status(200).json({
      success: true,
      msg: "INVITATION_ACCEPTED.",
    });
  },
);

router.post(
  "/api/v1/reject/:inviteId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const invitation = await prisma.invitation.findUnique({
      where: {
        id: req.params.inviteId as string,
        isDeleted: false,
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: "INVITATION_NOT_FOUND",
      });
    }

    if (invitation.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        error: "INVITATION_ACCEPTED_OR_DECLINED",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.id, isDeleted: false },
      select: { email: true },
    });

    if (user?.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "REJECTED" },
    });

    return res.status(200).json({
      success: true,
      msg: "INVITATION_REJECTED",
    });
  },
);

router.get(
  "/api/v1/membership/:orgId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const adminId = req.id;
    const orgId = req.params.orgId as string;

    if (!(await hasRole(adminId, orgId, "admin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const membership = await prisma.membership.findMany({
      where: {
        orgId,
        isDeleted: false,
        organization: { isDeleted: false },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            profilePhoto: true,
            boardMemberships: {
              where: {
                isDeleted: false,
                board: { isDeleted: false, orgId },
              },
              include: { board: { select: { id: true, title: true } } },
            },
          },
        },
      },
    });
    const members = membership.map(({ user, ...member }) => ({
      ...member,
      isCurrentUser: member.userId === adminId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePhoto: user.profilePhoto,
      },
      boardMemberships: user.boardMemberships,
    }));

    return res.status(200).json({
      success: true,
      data: { membership: members },
    });
  },
);

router.put(
  "/api/v1/membership/:userId/:orgId/role",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = UpdateMemberRoleSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_ROLE",
      });
    }

    const { userId, orgId } = req.params as {
      userId: string;
      orgId: string;
    };
    if (!(await hasRole(req.id, orgId, "superadmin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED_ONLY_SUPERADMIN_CAN_CHANGE_ROLE",
      });
    }

    const targetMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!targetMembership || targetMembership.isDeleted) {
      return res.status(404).json({
        success: false,
        error: "MEMBERSHIP_NOT_FOUND",
      });
    }
    const mutationBlockReason = getMembershipMutationBlockReason(
      req.id,
      userId,
      targetMembership.role,
    );
    if (mutationBlockReason === "SUPERADMIN") {
      return res.status(400).json({
        success: false,
        error: "SUPERADMIN_ROLE_CANNOT_BE_CHANGED",
      });
    }
    if (mutationBlockReason === "SELF") {
      return res.status(400).json({
        success: false,
        error: "CANNOT_CHANGE_OWN_ROLE",
      });
    }

    if (targetMembership.role === "admin" && data.role === "member") {
      const adminCount = await prisma.membership.count({
        where: {
          orgId,
          role: { in: ["admin", "superadmin"] },
          isDeleted: false,
        },
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "CANNOT_DEMOTE_LAST_ADMIN",
        });
      }
    }

    const membership = await prisma.membership.update({
      where: { userId_orgId: { userId, orgId } },
      data: { role: data.role },
      select: { userId: true, orgId: true, role: true },
    });

    return res.status(200).json({ success: true, data: { membership } });
  },
);

router.put(
  "/api/v1/membership/:userId/:orgId/boards",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = UpdateMemberBoardsSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: "INVALID_BOARD_ASSIGNMENT",
      });
    }

    const { userId, orgId } = req.params as {
      userId: string;
      orgId: string;
    };
    if (!(await hasRole(req.id, orgId, "admin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const targetMembership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!targetMembership || targetMembership.isDeleted) {
      return res.status(404).json({
        success: false,
        error: "MEMBERSHIP_NOT_FOUND",
      });
    }
    if (req.id === userId) {
      return res.status(400).json({
        success: false,
        error: "CANNOT_CHANGE_OWN_BOARD_ACCESS",
      });
    }

    if (targetMembership.role !== "member") {
      return res.status(400).json({
        success: false,
        error: "BOARD_ASSIGNMENTS_ONLY_APPLY_TO_MEMBERS",
      });
    }

    const boardIds = [...new Set(data.boardIds)];
    const boards = await prisma.boards.findMany({
      where: {
        id: { in: boardIds },
        orgId,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (boards.length !== boardIds.length) {
      return res.status(400).json({
        success: false,
        error: "INVALID_BOARD_ASSIGNMENT",
      });
    }

    const existingGrants = await prisma.boardMembership.findMany({
      where: {
        userId,
        board: { orgId },
      },
      select: { id: true, boardId: true },
    });
    const grantsToRevoke = existingGrants
      .filter((grant) => !boardIds.includes(grant.boardId))
      .map((grant) => grant.id);

    await prisma.$transaction(async (transaction) => {
      if (grantsToRevoke.length > 0) {
        await transaction.boardMembership.updateMany({
          where: { id: { in: grantsToRevoke } },
          data: { isDeleted: true },
        });
      }

      for (const boardId of boardIds) {
        await transaction.boardMembership.upsert({
          where: { userId_boardId: { userId, boardId } },
          create: { userId, boardId },
          update: { isDeleted: false },
        });
      }
    });

    return res.status(200).json({
      success: true,
      msg: "BOARD_ACCESS_UPDATED",
    });
  },
);

router.delete(
  "/api/v1/membership/:userId/:orgId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const adminId = req.id;
    const userId = req.params.userId as string;
    const orgId = req.params.orgId as string;

    if (!(await hasRole(adminId, orgId, "superadmin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED_ONLY_SUPERADMIN_CAN_REMOVE_MEMBERS",
      });
    }

    const targetMembership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: userId,
          orgId: orgId,
        },
      },
    });

    if (!targetMembership || targetMembership.isDeleted) {
      return res.status(404).json({
        success: false,
        error: "MEMBERSHIP_NOT_FOUND",
      });
    }

    const mutationBlockReason = getMembershipMutationBlockReason(
      adminId,
      userId,
      targetMembership.role,
    );
    if (mutationBlockReason === "SUPERADMIN") {
      return res.status(400).json({
        success: false,
        error: "SUPERADMIN_CANNOT_BE_REMOVED",
      });
    }
    if (mutationBlockReason === "SELF") {
      return res.status(400).json({
        success: false,
        error: "CANNOT_REMOVE_SELF",
      });
    }

    if (targetMembership.role === "admin") {
      const adminCount = await prisma.membership.count({
        where: {
          orgId,
          role: { in: ["admin", "superadmin"] },
          isDeleted: false,
        },
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "CANNOT_REMOVE_LAST_ADMIN",
        });
      }
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.membership.update({
        where: { userId_orgId: { userId, orgId } },
        data: { isDeleted: true },
      });
      await transaction.boardMembership.updateMany({
        where: {
          userId,
          isDeleted: false,
          board: { orgId },
        },
        data: { isDeleted: true },
      });
    });

    return res.status(200).json({
      success: true,
      msg: "USER_SUCCESSFULLY_DELETED",
    });
  },
);

export default router;
