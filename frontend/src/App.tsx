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
import PiecesProduced from "./pages/PiecesProduced";
import Leftover from "./pages/Leftover";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Permissions from "./pages/Permissions";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // Wait for session check before deciding

  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProtectedRoute permissions={['analytics.read']}><Dashboard /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permissions={['inventory.read']}><Inventory /></ProtectedRoute>} />
        <Route path="/recipes" element={<ProtectedRoute permissions={['recipes.read']}><Recipes /></ProtectedRoute>} />
        <Route path="/batches" element={<ProtectedRoute permissions={['batches.read']}><Batches /></ProtectedRoute>} />
        <Route path="/pieces-produced" element={<ProtectedRoute permissions={['pieces.read']}><PiecesProduced /></ProtectedRoute>} />
        <Route path="/leftover" element={<ProtectedRoute permissions={['leftover.read']}><Leftover /></ProtectedRoute>} />
        <Route path="/quality" element={<ProtectedRoute permissions={['quality.read']}><Quality /></ProtectedRoute>} />
        <Route path="/estimation" element={<ProtectedRoute permissions={['estimation.read']}><Estimation /></ProtectedRoute>} />
<Route path="/customers" element={<ProtectedRoute permissions={['customers.read']}><Customers /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute permissions={['suppliers.read']}><Suppliers /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute permissions={['sales.read']}><Sales /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute permissions={['analytics.read']}><Analytics /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute permissions={['users.read']}><UserManagement /></ProtectedRoute>} />
        <Route path="/permissions" element={<ProtectedRoute permissions={['users.read']}><Permissions /></ProtectedRoute>} />
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
