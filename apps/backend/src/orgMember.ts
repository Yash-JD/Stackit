import express, { type Response, type Request } from "express";
import { MembershipSchema } from "../zod";
import { prisma } from "db/client";

import { authMiddleware } from "../helper/authMiddleware";
import { hasRole } from "../helper/hasRole";
import { sendInviteEmail } from "../helper/email";

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

    if (!(await hasRole(adminId, data.orgId, "admin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: data.email,
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
        email: data.email,
        orgId: data.orgId,
        invitedBy: adminId,
        role: "member",
      },
    });

    const org = await prisma.organization.findUnique({
      where: {
        id: data.orgId,
        isDeleted: false,
      },
    });
    try {
      await sendInviteEmail(
        `${org?.name || "Stackit"} <onboarding@resend.dev>`,
        data.email,
        org?.name ?? "an organization",
        invitation.id,
      );
    } catch {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "FAILED" },
      });

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

    const invite = await prisma.invitation.findUnique({
      where: {
        id: inviteId,
        isDeleted: false,
      },
    });
    if (!invite) {
      return res.status(404).json({
        success: false,
        error: "INVITATION_NOT_FOUND",
      });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        error: "INVITATION_ACCEPTED_OR_DECLINED",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        isDeleted: false,
      },
    });

    if (user?.email !== invite.email) {
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
    });
    if (existingMembership) {
      return res.status(400).json({
        success: false,
        error: "ALREADY_ADDED",
      });
    }
    await prisma.membership.create({
      data: {
        userId: userId,
        orgId: invite.orgId,
        role: invite.role,
      },
    });
    await prisma.invitation.update({
      where: {
        id: invite.id,
      },
      data: {
        status: "ACCEPTED",
      },
    });

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

    if (user?.email !== invitation.email) {
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
      where: { orgId, isDeleted: false },
      include: {
        user: { select: { id: true, email: true, profilePhoto: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: { membership },
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

    if (!(await hasRole(adminId, orgId, "admin"))) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
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

    if (!targetMembership) {
      return res.status(404).json({
        success: false,
        error: "MEMBERSHIP_NOT_FOUND",
      });
    }

    if (targetMembership.role === "admin") {
      const adminCount = await prisma.membership.count({
        where: { orgId, role: "admin", isDeleted: false },
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: "CANNOT_REMOVE_LAST_ADMIN",
        });
      }
    }

    await prisma.membership.update({
      where: {
        userId_orgId: {
          userId: userId,
          orgId: orgId,
        },
      },
      data: {
        isDeleted: true,
      },
    });

    return res.status(200).json({
      success: true,
      msg: "USER_SUCCESSFULLY_DELETED",
    });
  },
);

export default router;
