import type { BoardColumn } from "./types";

export const initialColumns: BoardColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    color: "#8d9baa",
    cards: [
      {
        id: "brief",
        title: "Shape the product brief",
        label: "Research",
        description: "Collect the core problems this workspace needs to solve.",
      },
      {
        id: "competitors",
        title: "Review competitor flows",
        label: "Research",
        description: "Map the best patterns for boards, lists, and cards.",
      },
    ],
  },
  {
    id: "progress",
    title: "In progress",
    color: "#edb44f",
    cards: [
      {
        id: "board",
        title: "Build the board canvas",
        label: "Build",
        description:
          "Create a focused board view with a clear visual hierarchy.",
        due: "Today",
      },
      {
        id: "sidebar",
        title: "Polish the workspace sidebar",
        label: "Design",
        description: "Make navigation feel calm, quick, and easy to scan.",
      },
    ],
  },
  {
    id: "review",
    title: "Ready for review",
    color: "#6ec5b8",
    cards: [
      {
        id: "tokens",
        title: "Choose the visual language",
        label: "Design",
        description: "Lock the colors, spacing, and type scale for Stackit.",
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    color: "#88a9df",
    cards: [
      {
        id: "schema",
        title: "Model the first workspace",
        label: "Build",
        description:
          "Organizations, boards, sections, issues, and comments are mapped.",
      },
    ],
  },
];
