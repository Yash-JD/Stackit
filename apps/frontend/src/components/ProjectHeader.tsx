// ProjectHeader – hero section displaying the Stackit logo, name, and description.
// Used at the top of the Home (WorkspaceHome) page.
// Styled to match the Stackit dark/teal design system.

import { StackitLogo } from "./StackitLogo";

export interface ProjectHeaderProps {
  /** Human-readable project name, e.g. "Stackit" */
  name: string;
  /** Short tagline / purpose of the project */
  description: string;
}

/**
 * Hero-style header for the Home page.
 * Shows the Stackit logo, name, and a description/goal line.
 */
export const ProjectHeader = ({
  name,
  description,
}: ProjectHeaderProps) => {
  return (
    <div className="project-hero">
      <div className="project-hero-glow" aria-hidden="true" />
      <div className="project-hero-content">
        <div className="project-hero-logo-wrap">
          <StackitLogo className="project-hero-logo" />
        </div>
        <div className="project-hero-text">
          <h1 className="project-hero-name">{name}</h1>
          <p className="project-hero-description">{description}</p>
        </div>
      </div>
      <div className="project-hero-divider" aria-hidden="true" />
    </div>
  );
};
