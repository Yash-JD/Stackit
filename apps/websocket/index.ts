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
            organization: {
              isDeleted: false,
              membership: {
                some: {
                  userId: payload.id,
                  isDeleted: false,
                },
              },
            },
          },
        });

        if (!board) {
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
      } else if (parsedData.type === "issue_moved") {
        // Relay a card movement to everyone else viewing this board.
        const boardId = this.joinedRooms.get(socket);
        if (!boardId) {
          return;
        }

        if (!this.boards[boardId]) {
          return;
        }

        this.boards[boardId]
          .filter((member) => member.socket !== socket)
          .forEach((member) => {
            member.socket.send(
              JSON.stringify({
                type: "issue_moved",
                issueId: parsedData.issueId,
                sectionId: parsedData.sectionId,
              }),
            );
          });
      } else if (parsedData.type === "board_changed") {
        // Tell other members to refresh after a board-level change.
        const boardId = this.joinedRooms.get(socket);
        if (!boardId) {
          return;
        }

        if (!this.boards[boardId]) {
          return;
        }

        this.boards[boardId]
          .filter((member) => member.socket !== socket)
          .forEach((member) => {
            member.socket.send(JSON.stringify({ type: "board_changed" }));
          });
      }
    } catch (error) {
      console.error("Failed to handle message:", error);
    }
  }

  private handleDisconnect(socket: WebSocket) {
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
