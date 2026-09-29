import {
  Filter,
  LayoutGrid,
  ListFilter,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { CardLabel } from "../types";

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
          />
        </div>
        <div className="filter-wrap">
          <Filter size={15} />
          <select
            value={activeFilter}
            onChange={(event) =>
              onFilterChange(event.target.value as "all" | CardLabel)
            }
            aria-label="Filter cards"
          >
            <option value="all">All cards</option>
            <option value="Design">Design</option>
            <option value="Build">Build</option>
            <option value="Research">Research</option>
          </select>
        </div>
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
