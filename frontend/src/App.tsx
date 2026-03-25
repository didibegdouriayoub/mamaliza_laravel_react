import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
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
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Login />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/batches" element={<Batches />} />
        <Route path="/production" element={<Production />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/estimation" element={<Estimation />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/users" element={<UserManagement />} />
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
