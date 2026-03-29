import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./layouts/AdminLayout";
import CustomerLayout from "./layouts/CustomerLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import CustomersPage from "./pages/admin/CustomersPage";
import CustomerProfilePage from "./pages/admin/CustomerProfilePage";
import FeedbackPage from "./pages/admin/FeedbackPage";
import ReportsPage from "./pages/admin/ReportsPage";
import ReportDetailPage from "./pages/admin/ReportDetailPage";
import SendFeedbackPage from "./pages/admin/SendFeedbackPage";
import CustomerDashboardPage from "./pages/customer/CustomerDashboardPage";
import CustomerFeedbackFormPage from "./pages/customer/CustomerFeedbackFormPage";
import CustomerPreviousFeedbackPage from "./pages/customer/CustomerPreviousFeedbackPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthRedirect() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/customer'} replace />;
  }

  return <Navigate to="/login" replace />;
}

function RequireAuth({ role }: { role?: 'admin' | 'customer' }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return null;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/customer'} replace />;
  }

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="customers/:id" element={<CustomerProfilePage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:quarterId" element={<ReportDetailPage />} />
              <Route path="send-feedback" element={<SendFeedbackPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route path="/customer" element={<CustomerLayout />}>
              <Route index element={<CustomerDashboardPage />} />
              <Route path="feedback" element={<CustomerFeedbackFormPage />} />
              <Route path="history" element={<CustomerPreviousFeedbackPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;