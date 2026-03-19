import { Navigate, Route, Routes } from "react-router-dom";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminHomePage from "./pages/AdminHomePage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import AdminArtistsPage from "./pages/AdminArtistsPage";
import AdminArtistDetailPage from "./pages/AdminArtistDetailPage";
import AdminContentApprovalQueuePage from "./pages/AdminContentApprovalQueuePage";
import AdminArtistApplicationsPage from "./pages/AdminArtistApplicationsPage";
import AdminLayout from "./components/AdminLayout";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />

      <Route element={<AdminLayout />}>
        <Route path="/admin/home" element={<AdminHomePage />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/admin/artists" element={<AdminArtistsPage />} />
        <Route path="/admin/artist-applications" element={<AdminArtistApplicationsPage />} />
        <Route path="/admin/artists/:id" element={<AdminArtistDetailPage />} />
        <Route path="/admin/moderation" element={<AdminContentApprovalQueuePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}
