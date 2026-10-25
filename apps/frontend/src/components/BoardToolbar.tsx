import {
  Filter,
  LayoutGrid,
  ListFilter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { CardLabel } from "../types";
import { MenuSelect } from "./MenuSelect";

type BoardToolbarProps = {
  query: string;
  activeFilter: "all" | CardLabel;
  onQueryChange: (query: string) => void;
  onFilterChange: (filter: "all" | CardLabel) => void;
};

export function BoardToolbar({
  query,
  activeFilter,
  onQueryChange,
  onFilterChange,
}: BoardToolbarProps) {
  return (
    <div className="board-toolbar">
      <div className="toolbar-left">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search cards"
            aria-label="Search cards"
          />
        </div>
        <MenuSelect
          className="toolbar-filter-select"
          ariaLabel="Filter cards"
          prefix={<Filter size={15} aria-hidden="true" />}
          value={activeFilter}
          options={[
            { value: "all", label: "All cards" },
            { value: "Design", label: "Design" },
            { value: "Build", label: "Build" },
            { value: "Research", label: "Research" },
          ]}
          onChange={(filter) => onFilterChange(filter as "all" | CardLabel)}
        />
      </div>
      <div className="toolbar-right">
        <button className="toolbar-button">
          <ListFilter size={15} /> Sort
        </button>
        <button className="toolbar-button">
          <SlidersHorizontal size={15} /> Filters
        </button>
        <button className="icon-button view-button" aria-label="Grid view">
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
}
