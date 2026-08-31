import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3002 });

const BOARDS: Record<string, { userId: string; socket: WebSocket }[]> = {};

wss.on("connection", (socket) => {
  socket.on("message", (data) => {
    const parseData = JSON.parse(data.toString());

    // TODO: handle jwt to identify userId

    if (parseData.type === "join") {
      const boardId = parseData.boardId;

      // create dummy userId for now, in the future we will get it from jwt
      const userId = parseData.userId || `user_${Date.now()}`;

      // if boardId does not exist in BOARDS, create an array for it and add the user
      if (!BOARDS[boardId]) {
        BOARDS[boardId] = [{ userId, socket: socket }];
      }

      // if boardId exists, check if userId already exists in the array
      const userExists = BOARDS[boardId].some((user) => user.userId === userId);

      // if userId does not exist, add the user to the array
      if (!userExists) {
        BOARDS[boardId].push({ userId, socket: socket });
      }

      // send a message to all users in the board that a new user has joined
      // TODO: also send userid, name, profile picture from db
      // TODO: handle it in frontend
      BOARDS[boardId]
        .filter((user) => user.userId !== userId)
        .forEach(({ socket }) => {
          socket.send(JSON.stringify({ type: "join", userId }));
        });

      // send this user the list of all users in the board
      const usersInBoard = BOARDS[boardId]
        .filter((user) => user.userId !== userId)
        .map((user) => user.userId);
      socket.send(
        JSON.stringify({ type: "initial_state", users: usersInBoard }),
      );
    }
  });

  socket.on("close", () => {
    // Check if the user is in the board before removing
    Object.entries(BOARDS).map(([boardId, users]) => {
      const isUserInBoard = users.find((user) => user.socket == socket);
      if (isUserInBoard) {
        // Remove the user from the board
        const remainingUsers = users.filter((user) => user.socket !== socket);
        BOARDS[boardId] = remainingUsers;

        // Notify remaining users in the board that a user has left
        remainingUsers.forEach(({ socket }) => {
          socket.send(
            JSON.stringify({ type: "leave", userId: isUserInBoard.userId }),
          );
        });
      }
    });
  });
});
