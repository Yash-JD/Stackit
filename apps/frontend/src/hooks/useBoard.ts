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
import type { BoardColumn, Card, CardLabel } from "../types";

const SECTION_COLORS = ["#8d9baa", "#edb44f", "#6ec5b8", "#88a9df"];

export function useBoard(boardId: string | undefined) {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [title, setTitle] = useState("Board");
  const [organizationId, setOrganizationId] = useState("");
  const [canManageBoard, setCanManageBoard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingMoveIds, setPendingMoveIds] = useState<string[]>([]);
  const [moveError, setMoveError] = useState("");
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
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

    setIsLoading(true);
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
      setColumns([]);
      setTitle("Board");
      setOrganizationId("");
      setCanManageBoard(false);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load board data.",
      );
    } finally {
      if (requestSequence.current === requestId) setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

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
    },
    [boardId],
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
    [boardId, refresh],
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
    },
    [],
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
    },
    [],
  );

  const deleteCard = useCallback(async (cardId: string) => {
    await deleteIssue(cardId);
    setColumns((current) =>
      current.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => card.id !== cardId),
      })),
    );
  }, []);

  const moveCard = useCallback(
    async (cardId: string, sourceColumnId: string, targetColumnId: string) => {
      if (
        sourceColumnId === targetColumnId ||
        pendingMoveIds.includes(cardId)
      ) {
        return;
      }

      const sourceColumn = columns.find(
        (column) => column.id === sourceColumnId,
      );
      const sourceIndex =
        sourceColumn?.cards.findIndex((card) => card.id === cardId) ?? -1;
      const card =
        sourceIndex >= 0 ? sourceColumn?.cards[sourceIndex] : undefined;

      if (!card || !columns.some((column) => column.id === targetColumnId))
        return;

      setMoveError("");
      setPendingMoveIds((current) => [...current, cardId]);
      setColumns((current) =>
        current.map((column) => {
          if (column.id === sourceColumnId) {
            return {
              ...column,
              cards: column.cards.filter((item) => item.id !== cardId),
            };
          }
          if (column.id === targetColumnId) {
            return { ...column, cards: [...column.cards, card] };
          }
          return column;
        }),
      );

      try {
        await moveIssue(cardId, targetColumnId);
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
    [columns, pendingMoveIds],
  );

  return {
    columns,
    title,
    organizationId,
    canManageBoard,
    isLoading,
    error,
    pendingMoveIds,
    moveError,
    refresh,
    rename,
    addSection,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
  };
}
