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

Phase 3 will create the authenticated API client and load organization and board data from the backend.
