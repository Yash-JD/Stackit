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
