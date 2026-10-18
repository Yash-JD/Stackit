# Frontend Learning Notes

## Phase 1: Component Structure

### What changed

The board screen was split into smaller components:

- `Sidebar`: workspace navigation
- `BoardTopbar`: breadcrumbs and presence controls
- `BoardHeader`: board title and sharing action
- `BoardToolbar`: search and filter controls
- `BoardCanvas`: columns, cards, and add-list controls
- `CardDetail`: selected-card drawer

Shared frontend types live in `apps/frontend/src/types.ts`, and sample board data lives in `apps/frontend/src/board-data.ts`.

### Concepts learned

#### Components

A component is a reusable function that returns UI. Smaller components make a large screen easier to understand and maintain.

#### Props

Props are values passed from a parent component to a child component. For example, `Board` passes `query` and `onQueryChange` to `BoardToolbar`.

```tsx
<BoardToolbar query={query} onQueryChange={setQuery} />
```

A child receives those values through a typed props object.

#### State ownership

`Board` owns the board state because it coordinates columns, filters, selected cards, and list creation. Child components display that state and notify the parent through callback props.

#### Derived state

`visibleColumns` is calculated from `columns`, `query`, and `activeFilter`. It is not stored as another state value because it can always be recalculated from the source state.

#### TypeScript models

`Card`, `BoardColumn`, and `CardLabel` describe the data shape used by the UI. These types help TypeScript catch incorrect props and state updates.

#### Immutable state updates

When a card or list is added, the existing arrays are not changed directly. New arrays are created with spread syntax so React can detect the update.

### Important files

- `apps/frontend/src/App.tsx`: page state and component composition
- `apps/frontend/src/frontend.tsx`: application entry point and router provider
- `apps/frontend/src/types.ts`: shared data types
- `apps/frontend/src/board-data.ts`: temporary local data
- `apps/frontend/src/components/`: focused UI components

### Routing structure

`BrowserRouter` is an application-wide provider, so it belongs at the entry point in `frontend.tsx`. `App.tsx` then focuses on describing which component renders for each URL.

```tsx
<BrowserRouter>
  <App />
</BrowserRouter>
```

This is a common React structure because any component inside `App` can use router features such as `useNavigate`, `useParams`, and `Link`.

## Phase 2: Authentication

### What changed

- Added `/signin` and `/signup` routes.
- Added API requests for the backend authentication endpoints.
- Added an `AuthProvider` and `useAuth` hook.
- Stored the signin JWT in `localStorage`.
- Protected the board route.
- Added logout from the sidebar.
- Moved the frontend development server to port `5173`, leaving the backend on port `3000`.

### Concepts learned

#### Controlled inputs

The input value is stored in React state. Every keystroke calls `setState`, so React remains the source of truth for the form.

#### Form submission

`event.preventDefault()` stops the browser from reloading the page. The submit handler can then call the API with an async function.

#### Loading and error state

`isSubmitting` disables the button while the request is running. `error` displays a useful message when the API rejects the request.

#### Context

`AuthProvider` makes authentication state available to components below it without passing `token` through every component as a prop.

#### Custom hooks

`useAuth()` is a custom hook that reads the authentication context. It gives components a simple interface for signin and logout.

#### Protected routes

`ProtectedRoute` checks `isAuthenticated`. Unauthenticated users are redirected to `/signin`, while authenticated users render the nested route through `Outlet`.

#### localStorage

The JWT is persisted in the browser so refreshing the page does not immediately lose the session. This is temporary frontend authentication storage and should later be reviewed for production security requirements.

### Important files

- `apps/frontend/src/api.ts`: shared authentication requests
- `apps/frontend/src/auth.tsx`: auth context and `useAuth`
- `apps/frontend/src/components/AuthPage.tsx`: signin and signup forms
- `apps/frontend/src/App.tsx`: public and protected routes
- `apps/frontend/src/frontend.tsx`: `AuthProvider` placement

### Next phase

Phase 3 creates a reusable authenticated API client. Organization and board loading is planned for Phase 4.

## Phase 3: API Client

### What changed

- Added a reusable `apiRequest` function for HTTP requests.
- Added optional JWT authentication through the `Authorization` header.
- Kept signup and signin requests unauthenticated.
- Added consistent handling for HTTP errors, API errors, and invalid server responses.
- Used a generic response type so endpoints can describe their own `data` shape.
- Shared the token storage key between the API client and auth context.

### Concepts learned

#### `fetch` and request options

`fetch` sends an HTTP request and returns a `Response`. `RequestInit` describes options such as the method, headers, and body. The API helper centralizes those details so each endpoint can focus on its path and payload.

#### Async functions

`apiRequest` is `async`: it waits for the network response and then reads the response body. A failed HTTP status or an API response with `success: false` becomes an exception for the calling form or component to handle.

#### Request headers and JWTs

The helper adds a JSON content type when sending a JSON body. For protected requests, it reads the saved JWT and sends it in the `Authorization` header. This backend expects the raw JWT value, without a `Bearer` prefix.

#### Typed API responses

`ApiResponse<T>` lets each endpoint specify the expected type of `data`. The response is also checked at runtime for the shared API envelope (`success`, `msg`, and `error`) before it is returned.

### Important files

- `apps/frontend/src/api.ts`: shared HTTP client and authentication endpoint functions
- `apps/frontend/src/auth.tsx`: JWT persistence and auth context

### Next phase

Phase 4 connects the sidebar and board list to the organization and board APIs, with loading, error, and empty states.

## Phase 4: Organization and Board Data

### What changed

- Added typed API functions for the signed-in user's organizations and the boards in a selected organization.
- Replaced the sidebar's hardcoded workspace and recent-board names with API data.
- Added a workspace selector and linked each board to its board route.
- Added loading, retryable error, and empty states for organization and board requests.
- Ignored organizations marked as deleted by the API.

### Concepts learned

#### `useEffect`

`useEffect` runs side effects after React renders. The sidebar uses it to load organizations when it mounts, and to load boards when the selected organization changes.

```tsx
useEffect(() => {
  // Load data for the selected organization.
}, [selectedOrgId]);
```

The dependency array tells React when the effect should run again. A cleanup function marks an older request as stale so its result cannot overwrite data after a workspace switch or unmount.

#### Loading, error, and empty states

These states represent different outcomes. Loading indicates a request is in progress; an error provides a retry action; and an empty state means a successful request returned no organizations or boards.

#### Fetching on selection changes

The organization list is loaded first. Selecting an organization updates `selectedOrgId`, which triggers a second effect to fetch only that organization's boards.

### Important files

- `apps/frontend/src/api.ts`: typed organization and board API functions
- `apps/frontend/src/components/Sidebar.tsx`: data loading, selection, and request states
- `apps/frontend/src/index.css`: workspace selector and sidebar status styling

### Next phase

Phase 5 replaces `initialColumns` with the selected board's real sections and issues.

## Phase 5: Real Board Rendering

### What changed

- Replaced the hardcoded board data in the main board view with data from the backend.
- Loaded the selected board by resolving the current route's `boardId` against the signed-in user's organizations.
- Fetched the sections and issues for that board and transformed the API response into the UI's column/card format.
- Added loading and error states for board fetches while the board screen is still preparing its data.

### Concepts learned

#### Transforming API data into component data

The backend sends sections and issues in a format that is useful for the database, but the UI expects `BoardColumn[]` with nested cards. This means the frontend is responsible for mapping backend records to display models.

```ts
const columns = sections.map((section, index) => ({
  id: section.id,
  title: section.title,
  color: palette[index % palette.length],
  cards: issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    label: "Build",
    description: issue.description,
  })),
}));
```

#### Loading data based on route params

The board route uses a dynamic `boardId` path parameter. Once the route param resolves, the component requests the organization data and then finds the matching board and its sections.

#### Error states for async UI

When a board cannot be loaded or the backend rejects the request, the UI shows a clear error instead of silently leaving the board empty.

### Important files

- `apps/frontend/src/App.tsx`: board loading logic and board-column mapping
- `apps/frontend/src/api.ts`: organization, section, and issue fetch functions
- `apps/frontend/src/components/BoardTopbar.tsx`: dynamic board title in the header

### Next phase

Phase 6 adds board CRUD operations, including creating and editing sections and issues from the UI.

## Phase 6: Board CRUD Operations

### What changed

- Wired board-level actions to the backend API: rename and delete board from the board header.
- Added a `New board` action beside board rename/delete controls and on the boards home page; board creation refreshes the sidebar board list.
- Added list creation from the board canvas using the backend `createSection` endpoint.
- Added card creation, card editing, and card deletion by calling the issue endpoints from the board UI.
- Reused the same async loading pattern after mutations so the board screen refreshes from the server immediately.
- Added organization creation and workspace settings for updating its name/description or deleting it.
- Added a signed-in "Your boards" page, grouped by workspace, and kept the selected workspace's full board list in the sidebar.

### Concepts learned

#### Mutating server data from the UI

The board UI is no longer only reading data; it also triggers API requests to create, update, and delete records. Each mutation is followed by a refresh so the UI stays synchronized with the backend state.

```ts
await createSection(boardId, title.trim());
await loadBoard();
```

#### Error handling for form flows

Create and edit actions use focused in-app forms. When the API rejects a request, the component shows the error instead of silently leaving the screen stale.

#### Optimistic state vs. server truth

A real app should ideally keep the UI responsive with optimistic updates, but here the safe choice is to refresh from the server after each mutation. This keeps the local state consistent with the backend and makes the learning flow easier to reason about.

### Important files

- `apps/frontend/src/App.tsx`: workspace board index, board actions, refresh logic, and CRUD event handlers
- `apps/frontend/src/components/Sidebar.tsx`: organization settings, board creation, board list, and workspace selection
- `apps/frontend/src/components/BoardTopbar.tsx`: rename/delete board controls
- `apps/frontend/src/components/BoardCanvas.tsx`: list and card actions inside the board view
- `apps/frontend/src/api.ts`: backend CRUD operations for organizations, boards, sections, and issues

### Next phase

Phase 7 adds drag-and-drop interactions and optimistic UI behavior while cards move between sections.

## Phase 7: Drag-and-Drop and Optimistic UI

### What changed

- Made issue cards draggable and board sections valid drop targets.
- Added visible feedback for the card being dragged, the destination section, and a move in progress.
- Optimistically moved the card to the destination section before the API request completes.
- Connected drops to the backend issue-move endpoint.
- Restored a failed card move to its original section and position and displayed the API error. The optimistic move logic now lives in `useBoard`.
- Limited this phase to moving cards between sections. The current backend move endpoint does not persist ordering within a section.

### Concepts learned

#### Native drag-and-drop events

Cards use the browser's drag events to carry their identity. Sections handle drag-over and drop events, so the UI can identify the card and destination without adding a drag-and-drop dependency.

#### Optimistic updates

The board state changes immediately when a card is dropped, rather than waiting for the network. The pending state tells the user that the server update is still running.

#### Rollback after failure

If the move request fails, the card is removed from its optimistic location and inserted back into its original section at the remembered position. The error is surfaced on the board.

### Important files

- `apps/frontend/src/components/BoardCanvas.tsx`: draggable cards, section drop targets, and interaction feedback
- `apps/frontend/src/hooks/useBoard.ts`: optimistic board update and rollback behavior
- `apps/frontend/src/api.ts`: API helper for the backend move endpoint
- `apps/frontend/src/index.css`: drag, drop-target, pending, and error styles

### Next phase

Phase 8 extracts board and workspace data loading and mutation behavior into custom hooks.

## Phase 8: Custom Hooks and Frontend Architecture

### What changed

- Added `useBoard` to load board sections and cards, expose board metadata, rename the board, create sections, and manage optimistic card moves with rollback.
- Added `useWorkspaceBoards` to load workspace board groups, calculate the board total, and refresh when workspace or board change events occur.
- Kept page components responsible for rendering and dialog state while moving reusable server-state behavior out of `App`.
- Added request sequencing so older overlapping loads cannot overwrite newer results.
- Continued using the existing `useAuth` context hook for authentication state and sign-in behavior.

### Concepts learned

#### Custom hooks

A custom hook groups React state and behavior that belongs together. `useBoard` owns board data and its loading/mutation state, while the board page consumes that state to render components.

#### Separating server state from view state

Board data, loading feedback, and mutation errors are managed by hooks. Search, filters, selected cards, and open dialogs remain in the page because they describe the current view rather than server data.

#### Keeping asynchronous state current

Each load receives a sequence number. If a later refresh starts first, results from the older request are ignored instead of replacing newer data.

### Important files

- `apps/frontend/src/hooks/useBoard.ts`: board loading, section/card mapping, rename/create-section actions, and optimistic card moves
- `apps/frontend/src/hooks/useWorkspaceBoards.ts`: workspace and board loading, refresh events, and board count
- `apps/frontend/src/App.tsx`: route/page composition and dialog/view state
- `apps/frontend/src/auth.tsx`: existing authentication context and `useAuth` hook

### Remaining phases

- **Phase 9 — Organization and board membership:** invite people, accept invitations, view members and pending invites, and remove members.
- **Phase 10 — Roles and permissions:** define roles and enforce access rules in the frontend and backend.
- **Phase 11 — Project collaboration tools:** add comments, activity history, and task workflow features such as due dates and labels.
- **Phase 12 — Real-time collaboration:** live board updates and presence for multiple users.
- **Phase 13 — Quality and polish:** automated tests, accessibility, responsive behavior, and consistent loading/empty/error states.
- **Phase 14 — Production readiness:** environment configuration, deployment/build setup, and production checks.

Drag-and-drop currently persists the destination section but not a card's order within a section. Persisted ordering can be added when the backend supports it.
