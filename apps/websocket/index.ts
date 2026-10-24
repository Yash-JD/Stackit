import { WebSocket, WebSocketServer } from "ws";
import type { RawData } from "ws";
import jwt from "jsonwebtoken";
import { prisma } from "../../packages/db";

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
  if (membership.role !== "member") return true;

  const grant = await prisma.boardMembership.findFirst({
    where: { userId, boardId, isDeleted: false },
    select: { id: true },
  });
  return Boolean(grant);
}

class WsManager {
  private static instance: WsManager;

  private wss: WebSocketServer;

  private boards: Record<
    string,
    {
      id: string;
      profile: string | null;
      socket: WebSocket;
    }[]
  > = {};

  // A socket can be connected to one board at a time.
  private joinedRooms = new Map<WebSocket, string>();

  private organizations: Record<string, { id: string; socket: WebSocket }[]> =
    {};

  private joinedOrganizations = new Map<WebSocket, Set<string>>();

  private constructor() {
    this.wss = new WebSocketServer({
      port: WS_PORT,
    });

    this.initialize();
  }

  public static getInstance(): WsManager {
    if (!WsManager.instance) {
      WsManager.instance = new WsManager();
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

        // Only organization members may join a board's real-time room.
        const board = await prisma.boards.findFirst({
          where: {
            id: boardId,
            isDeleted: false,
            organization: { isDeleted: false },
          },
          select: {
            id: true,
            orgId: true,
          },
        });

        if (!board) {
          socket.close();
          return;
        }
        const membership = await prisma.membership.findFirst({
          where: {
            userId: payload.id,
            orgId: board.orgId,
            isDeleted: false,
            organization: { isDeleted: false },
          },
          select: { role: true },
        });
        const hasBoardGrant =
          Boolean(membership) &&
          (membership?.role === "superadmin" ||
            membership?.role === "admin" ||
            Boolean(
              await prisma.boardMembership.findFirst({
                where: { userId: payload.id, boardId, isDeleted: false },
                select: { id: true },
              }),
            ));
        if (!hasBoardGrant) {
          socket.close();
          return;
        }

        const previousBoardId = this.joinedRooms.get(socket);
        if (
          previousBoardId &&
          previousBoardId !== boardId &&
          this.boards[previousBoardId]
        ) {
          // Move the socket out of its old room before joining the new one.
          this.boards[previousBoardId] = this.boards[previousBoardId].filter(
            (member) => member.socket !== socket,
          );

          this.boards[previousBoardId].forEach((member) => {
            member.socket.send(
              JSON.stringify({ type: "leave", id: payload.id }),
            );
          });

          if (this.boards[previousBoardId].length === 0) {
            delete this.boards[previousBoardId];
          }
        }
        this.joinedRooms.set(socket, boardId);

        // Create the room the first time someone joins it.
        if (!this.boards[boardId]) {
          this.boards[boardId] = [];
        }

        // Tell existing members that this user has arrived.
        this.boards[boardId].forEach(({ socket }) => {
          socket.send(
            JSON.stringify({
              type: "join",
              id: payload.id,
              profile: profilePhoto,
            }),
          );
        });

        this.boards[boardId].push({
          id: payload.id,
          profile: profilePhoto,
          socket,
        });

        // Send the new member the users who are already in the room.
        socket.send(
          JSON.stringify({
            type: "initial_state",
            users: this.boards[boardId]
              .filter((user) => user.id !== payload.id)
              .map((user) => user.id),
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
        // Relay a card movement to everyone else viewing this board.
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
          select: { id: true },
        });
        if (!issue) return;

        await this.broadcastToBoard(boardId, socket, {
          type: "issue_moved",
          issueId: issue.id,
          sectionId: parsedData.sectionId,
        });
      } else if (parsedData.type === "board_changed") {
        // Tell other members to refresh after a board-level change.
        const boardId = this.joinedRooms.get(socket);
        if (!boardId) {
          return;
        }

        if (!(await hasBoardAccess(payload.id, boardId))) {
          socket.close();
          return;
        }

        await this.broadcastToBoard(boardId, socket, {
          type: "board_changed",
        });
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
      return;
    }

    if (!this.boards[joinedRoom]) {
      return;
    }

    const leaving = this.boards[joinedRoom].find(
      (user) => user.socket === socket,
    );

    this.boards[joinedRoom] = this.boards[joinedRoom].filter(
      (user) => user.socket !== socket,
    );

    if (leaving) {
      // Notify the remaining members that the user left.
      this.boards[joinedRoom].forEach((member) => {
        member.socket.send(JSON.stringify({ type: "leave", id: leaving.id }));
      });
    }

    if (this.boards[joinedRoom].length === 0) {
      // Delete empty rooms so memory is not kept forever.
      delete this.boards[joinedRoom];
    }

    this.joinedRooms.delete(socket);
  }
}

WsManager.getInstance();
