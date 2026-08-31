import { useEffect, useState } from "react";
import "./index.css";
import { Routes, Route, BrowserRouter, useParams } from "react-router";

export function App() {
  return (
    <div className="app">
      <BrowserRouter>
        <Routes>
          <Route path="/board/:boardId" element={<Board />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

function Board() {
  const { boardId } = useParams();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3002");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "initial_state") {
        setUsers(data.users);
      }

      if (data.type === "join") {
        setUsers((prevUsers) => [...prevUsers, data.userId]);
      }

      if (data.type === "leave") {
        setUsers((prevUsers) =>
          prevUsers.filter((userId) => userId !== data.userId),
        );
      }
    };

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ type: "join", boardId }), // TODO: replace with actual userId
      );
    };
  }, []);

  return (
    <div>
      You are on Board: {boardId}
      Currently connected users: {JSON.stringify(users)}
    </div>
  );
}

export default App;
