import { Navigate, Route, Routes } from "react-router-dom";
import ArtistLoginPage from "./pages/ArtistLoginPage";
import ArtistDashboardPage from "./pages/ArtistDashboardPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import ArtistSignupPage from "./pages/ArtistSignupPage";
import ArtistUnderReviewPage from "./pages/ArtistUnderReviewPage";
import ArtistRejectedPage from "./pages/ArtistRejectedPage";
import ArtistAccountInactivePage from "./pages/ArtistAccountInactivePage";
import ArtistShell from "./components/ArtistShell";
import ArtistAccountPage from "./pages/ArtistAccountPage";
import ArtistPricingPage from "./pages/ArtistPricingPage";
import ArtistAnalyticsSummaryPage from "./pages/ArtistAnalyticsSummaryPage";
import ArtistChannelPreviewPage from "./pages/ArtistChannelPreviewPage";
import ArtistContentHistoryPage from "./pages/ArtistContentHistoryPage";
import ArtistContentUploadPage from "./pages/ArtistContentUploadPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/artist/login" replace />} />
      <Route path="/artist/login" element={<ArtistLoginPage />} />
      <Route path="/artist/signup" element={<ArtistSignupPage />} />
      <Route path="/artist/account-inactive" element={<ArtistAccountInactivePage />} />
      <Route path="/artist/under-review" element={<ArtistUnderReviewPage />} />
      <Route path="/artist/rejected" element={<ArtistRejectedPage />} />
      <Route path="/artist/pending-approval" element={<PendingApprovalPage />} />
      <Route element={<ArtistShell />}>
        <Route path="/artist/dashboard" element={<ArtistDashboardPage />} />
        <Route path="/artist/account" element={<ArtistAccountPage />} />
        <Route path="/artist/pricing" element={<ArtistPricingPage />} />
        <Route path="/artist/analytics-summary" element={<ArtistAnalyticsSummaryPage />} />
        <Route path="/artist/channel-preview" element={<ArtistChannelPreviewPage />} />
        <Route path="/artist/content-upload" element={<ArtistContentUploadPage />} />
        <Route path="/artist/content-history" element={<ArtistContentHistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/artist/login" replace />} />
    </Routes>
  );
}
