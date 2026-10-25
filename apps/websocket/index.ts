import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "../../packages/db";
import { canMembershipAccessBoard } from "../backend/helper/boardAccessPolicy";

const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
})();

type Payload = {
  id: string;
  email: string;
};

const WS_PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 8080;

async function hasBoardAccess(userId: string, boardId: string) {
  const board = await prisma.boards.findFirst({
    where: {
      id: boardId,
      isDeleted: false,
      organization: { isDeleted: false },
    },
    select: { orgId: true },
  });
  if (!board) return false;

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      orgId: board.orgId,
      isDeleted: false,
      user: { isDeleted: false },
      organization: { isDeleted: false },
    },
    select: { role: true },
  });
  if (!membership) return false;
  if (canMembershipAccessBoard(membership.role, false)) return true;

  // Regular members need an explicit grant in addition to workspace membership.
  const grant = await prisma.boardMembership.findFirst({
    where: { userId, boardId, isDeleted: false },
    select: { id: true },
  });
  return canMembershipAccessBoard(membership.role, Boolean(grant));
}

class WsManager {
  private static instance: WsManager;

  private wss: WebSocketServer;

  private boards: Record<
    string,
    {
      id: string;
      email: string;
      profile: string | null;
      socket: WebSocket;
    }[]
  > = {};

  // A socket can be connected to one board at a time.
  private joinedRooms = new Map<WebSocket, string>();

  private organizations: Record<string, { id: string; socket: WebSocket }[]> =
    {};

  private joinedOrganizations = new Map<WebSocket, Set<string>>();

  private constructor(server?: import("node:http").Server) {
    if (server) {
      this.wss = new WebSocketServer({ server });
    } else {
      this.wss = new WebSocketServer({
        port: WS_PORT,
      });
    }

    this.initialize();
  }

  public static getInstance(server?: import("node:http").Server): WsManager {
    if (!WsManager.instance) {
      WsManager.instance = new WsManager(server);
    }

    return WsManager.instance;
  }

  private initialize() {
    this.wss.on("connection", (socket, req) => {
      // The client sends its JWT in the WebSocket URL query string.
      const query = req.url?.split("?")[1] ?? "";
      const token = new URLSearchParams(query).get("token");

      if (!token) {
        socket.close();
        return;
      }

      let payload: Payload;

      try {
        // Verify the token before accepting any messages from this socket.
        payload = jwt.verify(token, JWT_SECRET) as Payload;
      } catch {
        socket.close();
        return;
      }

      socket.on("message", async (data) => {
        // Every client action is sent as a JSON message.
        await this.handleMessage(data, payload, socket);
      });

      socket.on("close", () => {
        // Remove the user and notify the other board members.
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleMessage(
    data: RawData,
    payload: Payload,
    socket: WebSocket,
  ) {
    try {
      let parsedData;
      try {
        parsedData = JSON.parse(data.toString());
      } catch {
        return;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: payload.id,
          isDeleted: false,
        },
      });

      if (!user) {
        // A valid JWT is not enough if the account no longer exists.
        socket.close();
        return;
      }

      const profilePhoto = user.profilePhoto;

      if (parsedData.type === "join") {
        const boardId = parsedData.boardId;
        if (typeof boardId !== "string") {
          socket.close();
          return;
        }

        if (!(await hasBoardAccess(payload.id, boardId))) {
          socket.close();
          return;
        }

        const previousBoardId = this.joinedRooms.get(socket);
        if (
          previousBoardId === boardId &&
          this.boards[boardId]?.some((member) => member.socket === socket)
        ) {
          return;
        }
        if (
          previousBoardId &&
          previousBoardId !== boardId &&
          this.boards[previousBoardId]
        ) {
          // Move the socket out of its old room before joining the new one.
          this.boards[previousBoardId] = this.boards[previousBoardId].filter(
            (member) => member.socket !== socket,
          );

          if (
            !this.boards[previousBoardId].some(
              (member) => member.id === payload.id,
            )
          ) {
            await this.broadcastToBoard(previousBoardId, socket, {
              type: "leave",
              id: payload.id,
            });
          }

          if (this.boards[previousBoardId].length === 0) {
            delete this.boards[previousBoardId];
          }
        }
        this.joinedRooms.set(socket, boardId);

        // Create the room the first time someone joins it.
        if (!this.boards[boardId]) {
          this.boards[boardId] = [];
        }
        const isAlreadyPresent = this.boards[boardId].some(
          (member) => member.id === payload.id,
        );

        // Track each connection, but announce presence only once per user.
        this.boards[boardId].push({
          id: payload.id,
          email: user.email,
          profile: profilePhoto,
          socket,
        });

        if (!isAlreadyPresent) {
          await this.broadcastToBoard(boardId, socket, {
            type: "join",
            id: payload.id,
            email: user.email,
            profile: profilePhoto,
          });
        }

        // Send the new member the users who are already in the room.
        const presentMembers = await Promise.all(
          this.boards[boardId]
            .filter((member) => member.id !== payload.id)
            .map(async (member) => ({
              member,
              canAccess: await hasBoardAccess(member.id, boardId),
            })),
        );
        socket.send(
          JSON.stringify({
            type: "initial_state",
            users: presentMembers
              .filter(({ member, canAccess }) => {
                if (!canAccess && member.socket.readyState === WebSocket.OPEN) {
                  member.socket.close();
                }
                return canAccess;
              })
              .reduce<{ id: string; email: string; profile: string | null }[]>(
                (users, { member }) => {
                  if (!users.some((present) => present.id === member.id)) {
                    users.push({
                      id: member.id,
                      email: member.email,
                      profile: member.profile,
                    });
                  }
                  return users;
                },
                [],
              ),
          }),
        );
      } else if (parsedData.type === "join_organization") {
        const organizationId = parsedData.organizationId;
        if (typeof organizationId !== "string") {
          return;
        }

        const membership = await prisma.membership.findFirst({
          where: {
            userId: payload.id,
            orgId: organizationId,
            role: { in: ["admin", "superadmin"] },
            isDeleted: false,
            organization: { isDeleted: false },
          },
        });
        if (!membership) {
          socket.send(JSON.stringify({ type: "organization_access_denied" }));
          return;
        }

        let joinedOrganizations = this.joinedOrganizations.get(socket);
        if (!joinedOrganizations) {
          joinedOrganizations = new Set();
          this.joinedOrganizations.set(socket, joinedOrganizations);
        }

        if (joinedOrganizations.has(organizationId)) {
          return;
        }
        joinedOrganizations.add(organizationId);

        this.organizations[organizationId] ??= [];
        this.organizations[organizationId].push({
          id: payload.id,
          socket,
        });
        socket.send(
          JSON.stringify({
            type: "organization_joined",
            organizationId,
          }),
        );
      } else if (parsedData.type === "invitation_failed") {
        const { invitationId, organizationId } = parsedData;
        if (
          typeof invitationId !== "string" ||
          typeof organizationId !== "string" ||
          !this.joinedOrganizations.get(socket)?.has(organizationId)
        ) {
          return;
        }

        // Recheck the persisted failure and admin role before relaying a client notification.
        const [invitation, membership, adminMemberships] = await Promise.all([
          prisma.invitation.findFirst({
            where: {
              id: invitationId,
              orgId: organizationId,
              status: "FAILED",
              isDeleted: false,
            },
            select: { id: true },
          }),
          prisma.membership.findFirst({
            where: {
              userId: payload.id,
              orgId: organizationId,
              role: { in: ["admin", "superadmin"] },
              isDeleted: false,
              organization: { isDeleted: false },
            },
            select: { userId: true },
          }),
          prisma.membership.findMany({
            where: {
              orgId: organizationId,
              role: { in: ["admin", "superadmin"] },
              isDeleted: false,
              organization: { isDeleted: false },
            },
            select: { userId: true },
          }),
        ]);

        if (!invitation || !membership) {
          return;
        }

        const activeAdminIds = new Set(
          adminMemberships.map((admin) => admin.userId),
        );
        this.organizations[organizationId]
          ?.filter(
            (member) =>
              activeAdminIds.has(member.id) &&
              member.socket.readyState === WebSocket.OPEN,
          )
          .forEach((member) => {
            member.socket.send(
              JSON.stringify({
                type: "invitation_failed",
                invitationId,
                organizationId,
              }),
            );
          });
      } else if (parsedData.type === "issue_moved") {
        // Treat this as a notification only; the API has already committed the move.
        const boardId = this.joinedRooms.get(socket);
        if (!boardId) {
          return;
        }

        if (!(await hasBoardAccess(payload.id, boardId))) {
          socket.close();
          return;
        }

        if (
          typeof parsedData.issueId !== "string" ||
          typeof parsedData.sectionId !== "string"
        ) {
          return;
        }
        const issue = await prisma.issue.findFirst({
          where: {
            id: parsedData.issueId,
            boardId,
            sectionId: parsedData.sectionId,
            isDeleted: false,
            section: { isDeleted: false },
          },
          select: { id: true, position: true },
        });
        if (!issue) return;

        await this.broadcastToBoard(boardId, socket, {
          type: "issue_moved",
          issueId: issue.id,
          sectionId: parsedData.sectionId,
          position: issue.position,
        });
      } else if (parsedData.type === "board_deleted") {
        // The deleting client may no longer be in the room, so authorize via its workspace role.
        const boardId =
          typeof parsedData.boardId === "string"
            ? parsedData.boardId
            : this.joinedRooms.get(socket);
        if (!boardId) return;

        const board = await prisma.boards.findFirst({
          where: {
            id: boardId,
            isDeleted: true,
            organization: { isDeleted: false },
          },
          select: { orgId: true },
        });
        const senderMembership = board
          ? await prisma.membership.findFirst({
              where: {
                userId: payload.id,
                orgId: board.orgId,
                role: { in: ["admin", "superadmin"] },
                isDeleted: false,
                organization: { isDeleted: false },
              },
              select: { id: true },
            })
          : null;
        if (!board || !senderMembership) {
          socket.close();
          return;
        }

        const recipients = await Promise.all(
          (this.boards[boardId] ?? []).map(async (member) => {
            const membership = await prisma.membership.findFirst({
              where: {
                userId: member.id,
                orgId: board.orgId,
                isDeleted: false,
                organization: { isDeleted: false },
              },
              select: { role: true },
            });
            if (!membership) return { member, canAccess: false };
            if (canMembershipAccessBoard(membership.role, false)) {
              return { member, canAccess: true };
            }
            const grant = await prisma.boardMembership.findFirst({
              where: { userId: member.id, boardId, isDeleted: false },
              select: { id: true },
            });
            return {
              member,
              canAccess: canMembershipAccessBoard(
                membership.role,
                Boolean(grant),
              ),
            };
          }),
        );
        recipients.forEach(({ member, canAccess }) => {
          if (member.socket.readyState !== WebSocket.OPEN || !canAccess) {
            if (member.socket.readyState === WebSocket.OPEN) {
              member.socket.close();
            }
            return;
          }
          member.socket.send(
            JSON.stringify({ type: "board_deleted", boardId }),
          );
          member.socket.close(4004, "Board deleted");
        });
        if (socket.readyState === WebSocket.OPEN) {
          // Acknowledge one-off notification sockets so the caller can close cleanly.
          socket.send(JSON.stringify({ type: "board_event_sent" }));
        }
      } else if (parsedData.type === "board_changed") {
        // Tell other members to refresh after a board-level change.
        const boardId =
          this.joinedRooms.get(socket) ??
          (typeof parsedData.boardId === "string"
            ? parsedData.boardId
            : undefined);
        if (!boardId) {
          return;
        }

        if (!(await hasBoardAccess(payload.id, boardId))) {
          socket.close();
          return;
        }

        const issueId =
          typeof parsedData.issueId === "string" &&
          (await prisma.issue.findFirst({
            where: {
              id: parsedData.issueId,
              boardId,
              isDeleted: false,
              section: { isDeleted: false },
            },
            select: { id: true },
          }))
            ? parsedData.issueId
            : undefined;
        await this.broadcastToBoard(boardId, socket, {
          type: "board_changed",
          ...(issueId && { issueId }),
        });
        if (
          !this.joinedRooms.has(socket) &&
          socket.readyState === WebSocket.OPEN
        ) {
          // Rename notifications can also come from a temporary, unjoined socket.
          socket.send(JSON.stringify({ type: "board_event_sent" }));
        }
      }
    } catch (error) {
      console.error("Failed to handle message:", error);
    }
  }

  private async broadcastToBoard(
    boardId: string,
    sender: WebSocket,
    message: Record<string, unknown>,
  ) {
    const members = this.boards[boardId] ?? [];
    // Revalidate recipients at delivery time so revoked access ends live updates immediately.
    const recipients = await Promise.all(
      members.map(async (member) => ({
        member,
        canAccess:
          member.socket.readyState === WebSocket.OPEN &&
          (await hasBoardAccess(member.id, boardId)),
      })),
    );

    recipients.forEach(({ member, canAccess }) => {
      if (member.socket === sender) return;
      if (!canAccess) {
        if (member.socket.readyState === WebSocket.OPEN) {
          member.socket.close();
        }
        return;
      }
      member.socket.send(JSON.stringify(message));
    });
  }

  private handleDisconnect(socket: WebSocket) {
    const joinedOrganizations = this.joinedOrganizations.get(socket);
    joinedOrganizations?.forEach((organizationId) => {
      const members = this.organizations[organizationId];
      if (!members) return;

      this.organizations[organizationId] = members.filter(
        (member) => member.socket !== socket,
      );
      if (this.organizations[organizationId].length === 0) {
        delete this.organizations[organizationId];
      }
    });
    this.joinedOrganizations.delete(socket);

    // Find the room this connection belonged to.
    const joinedRoom = this.joinedRooms.get(socket);

    if (!joinedRoom) {
      this.joinedRooms.delete(socket);
      return;
    }

    if (!this.boards[joinedRoom]) {
      this.joinedRooms.delete(socket);
      return;
    }

    const leaving = this.boards[joinedRoom].find(
      (user) => user.socket === socket,
    );

    this.boards[joinedRoom] = this.boards[joinedRoom].filter(
      (user) => user.socket !== socket,
    );

    if (
      leaving &&
      !this.boards[joinedRoom].some((member) => member.id === leaving.id)
    ) {
      // Presence represents users, so only announce leave after their final socket closes.
      this.boards[joinedRoom].forEach((member) => {
        if (member.socket.readyState === WebSocket.OPEN) {
          member.socket.send(JSON.stringify({ type: "leave", id: leaving.id }));
        }
      });
    }

    if (this.boards[joinedRoom].length === 0) {
      // Delete empty rooms so memory is not kept forever.
      delete this.boards[joinedRoom];
    }
    this.joinedRooms.delete(socket);
  }
}

export function initWebSocketServer(
  server?: import("node:http").Server,
): WsManager {
  return WsManager.getInstance(server);
}

// Auto-start standalone WebSocket server if executed directly (e.g. bun apps/websocket/index.ts)
if (import.meta.main || process.env.RUN_STANDALONE_WS === "true") {
  WsManager.getInstance();
}
