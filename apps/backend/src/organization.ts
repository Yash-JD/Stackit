import express, { type Response, type Request } from "express";
import { OrgSchema, updateOrgSchema } from "../zod";
import { prisma } from "db/client";

import { authMiddleware } from "../helper/authMiddleware";
import { hasRole } from "../helper/hasRole";
import { Role } from "../../../packages/db/generated/prisma/enums";
import { COMMON_ERRORS, ORG_ERRORS } from "../helper/errors";

const router = express.Router();

// Create organization route
router.post(
  "/api/v1/organization/create",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = OrgSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: COMMON_ERRORS.INVALID_REQUEST,
      });
    }
    const userId = req.id;

    const org = await prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: {
          name: data.name,
          description: data.description,
        },
      });

      await transaction.membership.create({
        data: {
          userId,
          orgId: organization.id,
          role: Role.superadmin,
        },
      });

      return organization;
    });

    return res.status(200).json({
      success: true,
      data: org,
      msg: "ORG_SUCCESSFULLY_CREATED",
    });
  },
);

// Update organization route
router.put(
  "/api/v1/organization/:orgId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const { success, data } = updateOrgSchema.safeParse(req.body);
    if (!success) {
      return res.status(400).json({
        success: false,
        error: COMMON_ERRORS.INVALID_REQUEST,
      });
    }

    const orgId = req.params.orgId as string;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: ORG_ERRORS.PLEASE_PROVIDE_ORGID,
      });
    }

    const userId = req.id;

    if (!(await hasRole(userId, orgId, "superadmin"))) {
      return res.status(403).json({
        success: false,
        error: ORG_ERRORS.UNAUTHORIZED_ONLY_SUPERADMIN_CAN_EDIT_WORKSPACE,
      });
    }
    const org = await prisma.organization.update({
      where: {
        id: orgId,
        isDeleted: false,
      },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    return res.status(200).json({
      success: true,
      data: org,
    });
  },
);

// Get all organizations for a user
router.get(
  "/api/v1/organization",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = req.id;
    const membership = await prisma.membership.findMany({
      where: {
        userId: userId,
        isDeleted: false,
        organization: { isDeleted: false },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        organization: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        membership,
      },
    });
  },
);

// Get a specific organization for a user
router.get(
  "/api/v1/organization/:orgId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = req.params.orgId as string;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: ORG_ERRORS.PLEASE_PROVIDE_ORGID,
      });
    }
    const userId = req.id;

    const membership = await prisma.membership.findFirst({
      where: {
        userId: userId,
        orgId: orgId,
        isDeleted: false,
        organization: { isDeleted: false },
      },
      include: {
        organization: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: { membership },
    });
  },
);

// Delete an organization
router.delete(
  "/api/v1/organization/:orgId",
  authMiddleware,
  async (req: Request, res: Response) => {
    const orgId = req.params.orgId as string;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: ORG_ERRORS.PLEASE_PROVIDE_ORGID,
      });
    }
    const userId = req.id;

    if (!(await hasRole(userId, orgId, "superadmin"))) {
      return res.status(403).json({
        success: false,
        error: ORG_ERRORS.UNAUTHORIZED_ONLY_SUPERADMIN_CAN_DELETE_WORKSPACE,
      });
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: { isDeleted: true },
    });

    return res.status(200).json({
      success: true,
      msg: "ORGANIZATION_DELETED_SUCCESSFULLY",
    });
  },
);

export default router;
