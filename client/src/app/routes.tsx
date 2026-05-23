import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "../features/auth/RequireAuth";
import { LoginPage } from "../pages/LoginPage";
import { AppShell } from "./AppShell";
import { DashboardPage } from "../pages/DashboardPage";
import { UploadPage } from "../pages/UploadPage";
import { UsersPage } from "../pages/UsersPage";
import { ShareDownloadPage } from "../pages/ShareDownloadPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/share/:token" element={<ShareDownloadPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

