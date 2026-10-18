import { useCallback, useEffect, useRef, useState } from "react";
import { getBoards, getOrganizations } from "../api";
import type { BoardSummary, Organization } from "../api";

export type WorkspaceBoards = {
  organization: Organization;
  boards: BoardSummary[];
};

export function useWorkspaceBoards() {
  const [workspaces, setWorkspaces] = useState<WorkspaceBoards[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError("");
    try {
      const organizations = await getOrganizations();
      const groups = await Promise.all(
        organizations.map(async (organization) => ({
          organization,
          boards: await getBoards(organization.id),
        })),
      );
      if (requestSequence.current !== requestId) return;
      setWorkspaces(groups);
    } catch (loadError) {
      if (requestSequence.current !== requestId) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load workspace boards.",
      );
    } finally {
      if (requestSequence.current === requestId) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  useEffect(() => {
    window.addEventListener("stackit:organizations-changed", refresh);
    window.addEventListener("stackit:boards-changed", refresh);
    return () => {
      window.removeEventListener("stackit:organizations-changed", refresh);
      window.removeEventListener("stackit:boards-changed", refresh);
    };
  }, [refresh]);

  const boardCount = workspaces.reduce(
    (total, workspace) => total + workspace.boards.length,
    0,
  );

  return { workspaces, boardCount, isLoading, error, refresh };
}
