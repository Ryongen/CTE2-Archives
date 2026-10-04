import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, NavLink, Outlet, RouterProvider } from "react-router";

import { GameDataProvider } from "./game-data.tsx";
import { BuildDetailPage } from "./pages/BuildDetail.tsx";
import { BuildListPage } from "./pages/BuildList.tsx";
import { EditBuildPage } from "./pages/EditBuild.tsx";
import { UploadPage } from "./pages/Upload.tsx";
import "./styles.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/builds" className="brand">
          CTE2 Archives
        </NavLink>
        <nav>
          <NavLink to="/builds" end>
            Builds
          </NavLink>
          <NavLink to="/upload">Upload</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/builds" replace /> },
      { path: "builds", element: <BuildListPage /> },
      { path: "builds/:id", element: <BuildDetailPage /> },
      { path: "builds/:id/edit", element: <EditBuildPage /> },
      { path: "upload", element: <UploadPage /> },
      { path: "*", element: <p className="empty">Nothing here.</p> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GameDataProvider>
        <RouterProvider router={router} />
      </GameDataProvider>
    </QueryClientProvider>
  </StrictMode>,
);
