import { useEffect, useState } from "react";
import "./index.css";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router";
import { useAuth } from "./auth";
import { SigninPage, SignupPage } from "./components/AuthPage";
import { ProfilePage } from "./components/ProfilePage";
import { Sidebar } from "./components/Sidebar";
import { WorkspaceHome } from "./pages/WorkspaceHome";
import { BoardsPage } from "./pages/BoardsPage";
import { BoardPage } from "./pages/BoardPage";
import { MembersPage } from "./pages/MembersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useWorkspaceBoards } from "./hooks/useWorkspaceBoards";
import type { WorkspaceLayoutContext } from "./types";

export function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/signin" element={<SigninPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<WorkspaceLayout />}>
            <Route path="/" element={<WorkspaceHome />} />
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/board/:boardId" element={<BoardPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/signin" replace />;
}

function WorkspaceLayout() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const workspaceBoards = useWorkspaceBoards();
  const [selectedOrgId, setSelectedOrgId] = useState(
    () => localStorage.getItem("stackit_selected_org") ?? "",
  );

  useEffect(() => {
    if (workspaceBoards.isLoading || workspaceBoards.workspaces.length === 0) {
      if (
        !workspaceBoards.isLoading &&
        workspaceBoards.workspaces.length === 0
      ) {
        setSelectedOrgId("");
        localStorage.removeItem("stackit_selected_org");
      }
      return;
    }
    if (
      !workspaceBoards.workspaces.some(
        ({ organization }) => organization.id === selectedOrgId,
      )
    ) {
      const firstOrganizationId =
        workspaceBoards.workspaces[0]?.organization.id ?? "";
      setSelectedOrgId(firstOrganizationId);
      localStorage.setItem("stackit_selected_org", firstOrganizationId);
    }
  }, [selectedOrgId, workspaceBoards.isLoading, workspaceBoards.workspaces]);

  const handleSelectOrganization = (organizationId: string) => {
    setSelectedOrgId(organizationId);
    localStorage.setItem("stackit_selected_org", organizationId);
  };

  return (
    <div
      className={`workspace-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}
    >
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        isCollapsed={isSidebarCollapsed}
        selectedOrgId={selectedOrgId}
        onSelectOrganization={handleSelectOrganization}
        onToggleCollapse={() =>
          setIsSidebarCollapsed((isCollapsed) => !isCollapsed)
        }
      />
      <Outlet
        context={{
          ...workspaceBoards,
          selectedOrgId,
          onSelectOrganization: handleSelectOrganization,
          toggleSidebar: () => setShowSidebar((current) => !current),
        } satisfies WorkspaceLayoutContext}
      />
    </div>
  );
}

export default App;
