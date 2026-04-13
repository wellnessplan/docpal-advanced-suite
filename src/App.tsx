import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute, { AuthOnlyRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientProfile from "./pages/PatientProfile";
import Appointments from "./pages/Appointments";
import Billing from "./pages/Billing";
import Campaigns from "./pages/Campaigns";
import Settings from "./pages/Settings";
import AIGenerator from "./pages/AIGenerator";
import WhatsApp from "./pages/WhatsApp";
import DentalChart from "./pages/DentalChart";
import Queue from "./pages/Queue";
import Inventory from "./pages/Inventory";
import TreatmentCosting from "./pages/TreatmentCosting";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import PatientSelfRegister from "./pages/PatientSelfRegister";
import ResetPassword from "./pages/ResetPassword";
import Orthodontics from "./pages/Orthodontics";
import OrthoCase from "./pages/OrthoCase";
import LabOrders from "./pages/LabOrders";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<AuthOnlyRoute><Onboarding /></AuthOnlyRoute>} />
            <Route path="/register" element={<PatientSelfRegister />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
            <Route path="/ai-generator" element={<ProtectedRoute><AIGenerator /></ProtectedRoute>} />
            <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
            <Route path="/dental-chart/:patientId" element={<ProtectedRoute><DentalChart /></ProtectedRoute>} />
            <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
            <Route path="/lab-orders" element={<ProtectedRoute><LabOrders /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/treatment-costing" element={<ProtectedRoute><TreatmentCosting /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/ortho" element={<ProtectedRoute><Orthodontics /></ProtectedRoute>} />
            <Route path="/ortho/:caseId" element={<ProtectedRoute><OrthoCase /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
