export type CardLabel = "Design" | "Build" | "Research";

export type Card = {
  id: string;
  title: string;
  label: CardLabel;
  description: string;
  dueDate: string | null;
};

export type BoardColumn = {
  id: string;
  title: string;
  color: string;
  cards: Card[];
};

export type WorkspaceLayoutContext = {
  workspaces: Array<{
    organization: import("./api").Organization;
    boards: import("./api").BoardSummary[];
  }>;
  selectedOrgId: string;
  onSelectOrganization: (organizationId: string) => void;
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
  toggleSidebar: () => void;
};
