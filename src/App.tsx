// src/App.tsx
import React from "react";
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
import MembersPage from "./pages/admin/MembersPage";

// Created ONCE at module level — never inside a component body.
// If placed inside <App>, a new QueryClient is created on every render
// which resets all cached data.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

/* ---------------- FULL-SCREEN LOADER ---------------- */
// Shown while Supabase restores the session from localStorage.
// Replaces the bare "Loading app..." text.
function AppLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
        gap: "16px",
        backgroundColor: "var(--background, #fafafa)",
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid #e5e7eb",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "spin 0.75s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ---------------- AUTH REDIRECT ---------------- */
// Sends authenticated users to their correct dashboard,
// and unauthenticated users to /login.
const AuthRedirect = React.memo(function AuthRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated) {
    return (
      <Navigate
        to={user?.role === "customer" ? "/customer" : "/admin"}
        replace
      />
    );
  }

  return <Navigate to="/login" replace />;
});

/* ---------------- REQUIRE AUTH ---------------- */
// Guards routes by role. If not authenticated → /login.
// If authenticated but wrong role → own dashboard.
const RequireAuth = React.memo(function RequireAuth({
  role,
  children,
}: {
  role?: "admin" | "customer";
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (role === "customer" && user?.role !== "customer") {
    return <Navigate to="/admin" replace />;
  }
  if (role === "admin" && user?.role === "customer") {
    return <Navigate to="/customer" replace />;
  }

  return <>{children}</>;
});

/* ---------------- ROUTES ---------------- */
function AppRoutes() {
  const { loading } = useAuth();

  // Block rendering until the session is restored from Supabase.
  // Without this guard, the router evaluates isAuthenticated = false
  // (because the async restore hasn't finished yet) and redirects
  // the user to /login on every hard refresh.
  if (loading) {
    return <AppLoader />;
  }

  return (
    <Routes>
      {/* Root — redirects based on auth state */}
      <Route path="/" element={<AuthRedirect />} />

      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="customers/:id" element={<CustomerProfilePage />} />
        <Route path="feedback" element={<FeedbackPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/:quarterId" element={<ReportDetailPage />} />
        <Route path="send-feedback" element={<SendFeedbackPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Customer routes */}
      <Route
        path="/customer"
        element={
          <RequireAuth role="customer">
            <CustomerLayout />
          </RequireAuth>
        }
      >
        <Route index element={<CustomerDashboardPage />} />
        <Route path="feedback" element={<CustomerFeedbackFormPage />} />
        <Route path="history" element={<CustomerPreviousFeedbackPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/* ---------------- ROOT APP ---------------- */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;