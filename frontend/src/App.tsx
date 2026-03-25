import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Recipes from "./pages/Recipes";
import Batches from "./pages/Batches";
import Quality from "./pages/Quality";
import Sales from "./pages/Sales";
import Analytics from "./pages/Analytics";
import UserManagement from "./pages/UserManagement";
import Estimation from "./pages/Estimation";
import Production from "./pages/Production";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // Wait for session check before deciding

  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProtectedRoute permissions={['view_analytics']}><Dashboard /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permissions={['manage_inventory']}><Inventory /></ProtectedRoute>} />
        <Route path="/recipes" element={<ProtectedRoute permissions={['manage_recipes']}><Recipes /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute permissions={['manage_batches']}><Batches /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute permissions={['manage_batches']}><Production /></ProtectedRoute>} />
        <Route path="/quality" element={<ProtectedRoute permissions={['manage_quality']}><Quality /></ProtectedRoute>} />
        <Route path="/estimation" element={<ProtectedRoute permissions={['manage_inventory']}><Estimation /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute permissions={['manage_sales']}><Sales /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute permissions={['view_analytics']}><Analytics /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute permissions={['manage_users']}><UserManagement /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
