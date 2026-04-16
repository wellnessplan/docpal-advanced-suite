import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute, { AuthOnlyRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";

const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientProfile = lazy(() => import("./pages/PatientProfile"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Billing = lazy(() => import("./pages/Billing"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Settings = lazy(() => import("./pages/Settings"));
const AIGenerator = lazy(() => import("./pages/AIGenerator"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const DentalChart = lazy(() => import("./pages/DentalChart"));
const Queue = lazy(() => import("./pages/Queue"));
const Inventory = lazy(() => import("./pages/Inventory"));
const TreatmentCosting = lazy(() => import("./pages/TreatmentCosting"));
const Finance = lazy(() => import("./pages/Finance"));
const Reports = lazy(() => import("./pages/Reports"));
const PatientSelfRegister = lazy(() => import("./pages/PatientSelfRegister"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Orthodontics = lazy(() => import("./pages/Orthodontics"));
const OrthoCase = lazy(() => import("./pages/OrthoCase"));
const LabOrders = lazy(() => import("./pages/LabOrders"));
const Tasks = lazy(() => import("./pages/Tasks"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TodaySchedule = lazy(() => import("./pages/TodaySchedule"));
const TreatmentPlans = lazy(() => import("./pages/TreatmentPlans"));
const Payments = lazy(() => import("./pages/Payments"));
const InsuranceClaims = lazy(() => import("./pages/InsuranceClaims"));
const Revenue = lazy(() => import("./pages/Revenue"));
const Performance = lazy(() => import("./pages/Performance"));
const Leads = lazy(() => import("./pages/Leads"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Memberships = lazy(() => import("./pages/Memberships"));
const Staff = lazy(() => import("./pages/Staff"));
const DrDashboard = lazy(() => import("./pages/DrDashboard"));
const Integrations = lazy(() => import("./pages/Integrations"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Partners = lazy(() => import("./pages/Partners"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground">Loading...</div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/onboarding" element={<AuthOnlyRoute><Onboarding /></AuthOnlyRoute>} />
                <Route path="/register" element={<PatientSelfRegister />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/dr-dashboard" element={<ProtectedRoute><DrDashboard /></ProtectedRoute>} />
                <Route path="/today-schedule" element={<ProtectedRoute><TodaySchedule /></ProtectedRoute>} />
                <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
                <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
                <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
                <Route path="/treatment-plans" element={<ProtectedRoute><TreatmentPlans /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/insurance" element={<ProtectedRoute><InsuranceClaims /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/ai-generator" element={<ProtectedRoute><AIGenerator /></ProtectedRoute>} />
                <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
                <Route path="/dental-chart/:patientId" element={<ProtectedRoute><DentalChart /></ProtectedRoute>} />
                <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
                <Route path="/lab-orders" element={<ProtectedRoute><LabOrders /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/treatment-costing" element={<ProtectedRoute><TreatmentCosting /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/revenue" element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
                <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
                <Route path="/memberships" element={<ProtectedRoute><Memberships /></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
                <Route path="/partners" element={<ProtectedRoute><Partners /></ProtectedRoute>} />
                <Route path="/ortho" element={<ProtectedRoute><Orthodontics /></ProtectedRoute>} />
                <Route path="/ortho/:caseId" element={<ProtectedRoute><OrthoCase /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/super-admin" element={<SuperAdmin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
