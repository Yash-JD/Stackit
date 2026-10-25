import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSection,
  createIssue,
  deleteIssue,
  getBoardSections,
  getIssuesForSection,
  getOrganizations,
  moveIssue,
  renameBoard,
  updateIssue,
} from "../api";
import { useAuth } from "../auth";
import type { BoardColumn, Card, CardLabel } from "../types";

const SECTION_COLORS = ["#8d9baa", "#edb44f", "#6ec5b8", "#88a9df"];
const WEBSOCKET_URL =
  import.meta.env?.BUN_PUBLIC_WS_URL ?? "ws://localhost:8080";

export type BoardPresenceUser = {
  id: string;
  email: string;
  profile: string | null;
};

export type BoardSocketStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "unavailable";

export function useBoard(boardId: string | undefined) {
  const { token } = useAuth();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [title, setTitle] = useState("Board");
  const [organizationId, setOrganizationId] = useState("");
  const [canManageBoard, setCanManageBoard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingMoveIds, setPendingMoveIds] = useState<string[]>([]);
  const [moveError, setMoveError] = useState("");
  const [presenceUsers, setPresenceUsers] = useState<BoardPresenceUser[]>([]);
  const [socketStatus, setSocketStatus] = useState<BoardSocketStatus>("idle");
  const [socketRetry, setSocketRetry] = useState(0);
  const requestSequence = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const requestId = ++requestSequence.current;
      if (!boardId) {
        setColumns([]);
        setTitle("Board");
        setOrganizationId("");
        setCanManageBoard(false);
        setError("This board could not be found.");
        setIsLoading(false);
        return;
      }

      if (!silent) setIsLoading(true);
      setError("");

      try {
        const organizations = await getOrganizations();

        for (const organization of organizations) {
          const boards = await getBoardSections(organization.id);
          const board = boards.find((item) => item.id === boardId);
          if (!board) continue;

          const nextColumns = await Promise.all(
            board.sections
              .filter((section) => !section.isDeleted)
              .map(async (section, index) => {
                const issues = await getIssuesForSection(section.id);
                return {
                  id: section.id,
                  title: section.title,
                  color:
                    SECTION_COLORS[index % SECTION_COLORS.length] ?? "#8d9baa",
                  cards: issues
                    .filter((issue) => !issue.isDeleted)
                    .map((issue) => ({
                      id: issue.id,
                      title: issue.title,
                      label: issue.label,
                      description:
                        issue.description || "No description added yet.",
                      dueDate: issue.dueDate,
                    })),
                } satisfies BoardColumn;
              }),
          );

          if (requestSequence.current !== requestId) return;
          setTitle(board.title);
          setOrganizationId(board.orgId);
          setCanManageBoard(organization.membershipRole !== "member");
          setColumns(nextColumns);
          return;
        }

        if (requestSequence.current !== requestId) return;
        setColumns([]);
        setTitle("Board");
        setOrganizationId("");
        setCanManageBoard(false);
        setError("This board could not be found.");
      } catch (loadError) {
        if (requestSequence.current !== requestId) return;
        if (!silent) {
          setColumns([]);
          setTitle("Board");
          setOrganizationId("");
          setCanManageBoard(false);
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load board data.",
        );
      } finally {
        if (requestSequence.current === requestId) setIsLoading(false);
      }
    },
    [boardId],
  );

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    if (!boardId || !token) {
      setPresenceUsers([]);
      setSocketStatus("idle");
      return;
    }

    let isDisposed = false;
    let attempts = 0;
    let reconnectTimer: number | undefined;
    let stableConnectionTimer: number | undefined;
    let socket: WebSocket | null = null;
    setPresenceUsers([]);

    const connect = () => {
      if (isDisposed) return;
      setSocketStatus(attempts === 0 ? "connecting" : "reconnecting");
      const connection = new WebSocket(
        `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`,
      );
      socket = connection;
      socketRef.current = connection;

      connection.onopen = () => {
        if (isDisposed || connection.readyState !== WebSocket.OPEN) return;
        setSocketStatus("connected");
        connection.send(JSON.stringify({ type: "join", boardId }));
        stableConnectionTimer = window.setTimeout(() => {
          attempts = 0;
        }, 30_000);
      };

      connection.onmessage = (event) => {
        let message: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(String(event.data));
          if (!parsed || typeof parsed !== "object") return;
          message = parsed as Record<string, unknown>;
        } catch {
          return;
        }

        if (message.type === "initial_state" && Array.isArray(message.users)) {
          setPresenceUsers(
            message.users.filter(isPresenceUser).filter((user) => user.id),
          );
        } else if (
          message.type === "join" &&
          typeof message.id === "string" &&
          typeof message.email === "string"
        ) {
          setPresenceUsers((current) => [
            ...current.filter((user) => user.id !== message.id),
            {
              id: message.id as string,
              email: message.email as string,
              profile:
                typeof message.profile === "string" ? message.profile : null,
            },
          ]);
        } else if (message.type === "leave" && typeof message.id === "string") {
          setPresenceUsers((current) =>
            current.filter((user) => user.id !== message.id),
          );
        } else if (
          message.type === "board_changed" ||
          message.type === "issue_moved"
        ) {
          void refresh({ silent: true });
          if (typeof message.issueId === "string") {
            window.dispatchEvent(
              new CustomEvent("stackit:issue-activity-changed", {
                detail: { issueId: message.issueId },
              }),
            );
          }
        } else if (message.type === "board_deleted") {
          window.dispatchEvent(new Event("stackit:board-deleted"));
        }
      };

      connection.onerror = () => connection.close();
      connection.onclose = () => {
        if (stableConnectionTimer !== undefined) {
          window.clearTimeout(stableConnectionTimer);
        }
        if (socketRef.current === connection) socketRef.current = null;
        if (isDisposed) return;

        attempts += 1;
        if (attempts > 5) {
          setSocketStatus("unavailable");
          setPresenceUsers([]);
          return;
        }

        setSocketStatus("reconnecting");
        reconnectTimer = window.setTimeout(
          connect,
          Math.min(500 * 2 ** (attempts - 1), 8_000),
        );
      };
    };

    connect();
    return () => {
      isDisposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      if (stableConnectionTimer !== undefined) {
        window.clearTimeout(stableConnectionTimer);
      }
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [boardId, token, socketRetry, refresh]);

  const sendBoardChanged = useCallback((issueId?: string) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "board_changed",
        ...(issueId && { issueId }),
      }),
    );
  }, []);

  const retrySocket = useCallback(() => {
    setSocketRetry((current) => current + 1);
  }, []);

  useEffect(() => {
    const refreshAccess = () => void refresh();
    window.addEventListener("stackit:organizations-changed", refreshAccess);
    return () =>
      window.removeEventListener(
        "stackit:organizations-changed",
        refreshAccess,
      );
  }, [refresh]);

  const rename = useCallback(
    async (nextTitle: string) => {
      if (!boardId) return;
      await renameBoard(boardId, nextTitle);
      setTitle(nextTitle);
      sendBoardChanged();
    },
    [boardId, sendBoardChanged],
  );

  const addSection = useCallback(
    async (sectionTitle: string) => {
      if (!boardId) return false;
      try {
        const section = await createSection(boardId, sectionTitle);
        setColumns((current) => [
          ...current,
          {
            id: section.id,
            title: section.title,
            color:
              SECTION_COLORS[current.length % SECTION_COLORS.length] ??
              "#8d9baa",
            cards: [],
          },
        ]);
        sendBoardChanged();
        return true;
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Unable to create this list.",
        );
        return false;
      }
    },
    [boardId, refresh, sendBoardChanged],
  );

  const createCard = useCallback(
    async (
      sectionId: string,
      cardTitle: string,
      description: string,
      label: CardLabel,
      dueDate: string | null,
    ) => {
      const issue = await createIssue(
        sectionId,
        cardTitle,
        description,
        label,
        dueDate,
      );
      setColumns((current) =>
        current.map((column) =>
          column.id === sectionId
            ? {
                ...column,
                cards: [
                  ...column.cards,
                  {
                    id: issue.id,
                    title: issue.title,
                    label: issue.label,
                    description:
                      issue.description || "No description added yet.",
                    dueDate: issue.dueDate,
                  },
                ],
              }
            : column,
        ),
      );
      window.dispatchEvent(
        new CustomEvent("stackit:issue-activity-changed", {
          detail: { issueId: issue.id },
        }),
      );
      sendBoardChanged(issue.id);
    },
    [sendBoardChanged],
  );

  const updateCard = useCallback(
    async (
      cardId: string,
      cardTitle: string,
      description: string,
      label: CardLabel,
      dueDate: string | null,
    ) => {
      const issue = await updateIssue(
        cardId,
        cardTitle,
        description,
        label,
        dueDate,
      );
      setColumns((current) =>
        current.map((column) => ({
          ...column,
          cards: column.cards.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  title: issue.title,
                  label: issue.label,
                  description: issue.description || "No description added yet.",
                  dueDate: issue.dueDate,
                }
              : card,
          ),
        })),
      );
      window.dispatchEvent(
        new CustomEvent("stackit:issue-activity-changed", {
          detail: { issueId: cardId },
        }),
      );
      sendBoardChanged(cardId);
    },
    [sendBoardChanged],
  );

  const deleteCard = useCallback(
    async (cardId: string) => {
      await deleteIssue(cardId);
      setColumns((current) =>
        current.map((column) => ({
          ...column,
          cards: column.cards.filter((card) => card.id !== cardId),
        })),
      );
      sendBoardChanged();
    },
    [sendBoardChanged],
  );

  const moveCard = useCallback(
    async (
      cardId: string,
      sourceColumnId: string,
      targetColumnId: string,
      targetCardId: string | null,
    ) => {
      if (pendingMoveIds.includes(cardId)) return;

      const sourceColumn = columns.find(
        (column) => column.id === sourceColumnId,
      );
      const sourceIndex =
        sourceColumn?.cards.findIndex((card) => card.id === cardId) ?? -1;
      const card =
        sourceIndex >= 0 ? sourceColumn?.cards[sourceIndex] : undefined;
      const targetColumn = columns.find(
        (column) => column.id === targetColumnId,
      );

      if (!card || !targetColumn) return;
      const targetCardIndex = targetCardId
        ? targetColumn.cards.findIndex((item) => item.id === targetCardId)
        : targetColumn.cards.length;
      if (targetCardId && targetCardIndex < 0) return;
      const position =
        sourceColumnId === targetColumnId && sourceIndex < targetCardIndex
          ? targetCardIndex - 1
          : targetCardIndex;
      if (sourceColumnId === targetColumnId && sourceIndex === position) return;

      setMoveError("");
      setPendingMoveIds((current) => [...current, cardId]);
      setColumns((current) => {
        const withoutCard = current.map((column) => ({
          ...column,
          cards: column.cards.filter((item) => item.id !== cardId),
        }));
        return withoutCard.map((column) => {
          if (column.id !== targetColumnId) return column;
          const cards = [...column.cards];
          cards.splice(Math.min(position, cards.length), 0, card);
          return { ...column, cards };
        });
      });

      try {
        await moveIssue(cardId, targetColumnId, position);
        void refresh({ silent: true });
        const socket = socketRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "issue_moved",
              issueId: cardId,
              sectionId: targetColumnId,
            }),
          );
        }
        window.dispatchEvent(
          new CustomEvent("stackit:issue-activity-changed", {
            detail: { issueId: cardId },
          }),
        );
      } catch (moveError) {
        setColumns((current) => {
          let latestCard = card;
          const columnsWithoutCard = current.map((column) => {
            const currentCard = column.cards.find((item) => item.id === cardId);
            if (currentCard) latestCard = currentCard;
            return {
              ...column,
              cards: column.cards.filter((item) => item.id !== cardId),
            };
          });

          return columnsWithoutCard.map((column) => {
            if (column.id !== sourceColumnId) return column;
            const cards = [...column.cards];
            cards.splice(Math.min(sourceIndex, cards.length), 0, latestCard);
            return { ...column, cards };
          });
        });
        setMoveError(
          moveError instanceof Error
            ? `Unable to move card: ${moveError.message}`
            : "Unable to move card. The card was returned to its original list.",
        );
      } finally {
        setPendingMoveIds((current) =>
          current.filter((pendingId) => pendingId !== cardId),
        );
      }
    },
    [columns, pendingMoveIds, refresh],
  );

  const retryBoardSocket = retrySocket;

  return {
    columns,
    title,
    organizationId,
    canManageBoard,
    isLoading,
    error,
    pendingMoveIds,
    moveError,
    presenceUsers,
    socketStatus,
    retryBoardSocket,
    notifyBoardChanged: sendBoardChanged,
    refresh,
    rename,
    addSection,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  };
}

function isPresenceUser(value: unknown): value is BoardPresenceUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    (typeof user.profile === "string" || user.profile === null)
  );
}
