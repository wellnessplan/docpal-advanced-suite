import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute, { AuthOnlyRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Index from "./pages/Index";

const Auth = lazy(() => import("./pages/Auth"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
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
const GoogleReviews = lazy(() => import("./pages/GoogleReviews"));
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
const Platform = lazy(() => import("./pages/Platform"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const SocialCalendar = lazy(() => import("./pages/SocialCalendar"));
const Incidents = lazy(() => import("./pages/Incidents"));
const FocusToday = lazy(() => import("./pages/focus/FocusToday"));
const FocusPatient = lazy(() => import("./pages/focus/FocusPatient"));
const PatientEducation = lazy(() => import("./pages/PatientEducation"));
const DisplayManager = lazy(() => import("./pages/DisplayManager"));
const DisplayPair = lazy(() => import("./pages/DisplayPair"));
const DisplayScreen = lazy(() => import("./pages/DisplayScreen"));
const PurchaseOrders = lazy(() => import("./pages/PurchaseOrders"));
const WhatsAppStatus = lazy(() => import("./pages/WhatsAppStatus"));
const PatientStatus = lazy(() => import("./pages/PatientStatus"));
const FinanceHub = lazy(() => import("./pages/FinanceHub"));
const AnalyticsHub = lazy(() => import("./pages/AnalyticsHub"));
const FrontDesk = lazy(() => import("./pages/FrontDesk"));
const PublicTreatmentPlanSign = lazy(() => import("./pages/PublicTreatmentPlanSign"));
const PublicPrograms = lazy(() => import("./pages/PublicPrograms"));
const PublicManagePrograms = lazy(() => import("./pages/PublicManagePrograms"));
const PatientPrograms = lazy(() => import("./pages/PatientPrograms"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached data is shown instantly on tab switches; refresh happens silently in background.
      staleTime: 5 * 60 * 1000,        // 5 min — keep tabs feeling instant
      gcTime: 30 * 60 * 1000,          // 30 min — survive deep navigation
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,           // don't re-fetch if cache exists
      placeholderData: keepPreviousData,
      retry: 1,
    },
  },
});

// Hairline progress bar — only visible while a NEW chunk is downloading.
const PageLoader = () => (
  <div className="fixed top-0 left-0 right-0 h-0.5 bg-primary/20 overflow-hidden z-50">
    <div className="h-full w-1/3 bg-primary animate-[slide_1s_ease-in-out_infinite]" />
  </div>
);

// Warm up route chunks at idle so first-time navigation feels instant.
function RoutePrefetcher() {
  useEffect(() => {
    const idle = (cb: () => void) =>
      (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 2500 }) : setTimeout(cb, 800);
    idle(() => {
      // Essentials first
      import("./pages/Dashboard");
      import("./pages/Patients");
      import("./pages/Appointments");
      import("./pages/Billing");
      import("./pages/WhatsApp");
      idle(() => {
        import("./pages/PatientProfile");
        import("./pages/TodaySchedule");
        import("./pages/Settings");
        import("./pages/Tasks");
        import("./pages/DentalChart");
      });
    });
  }, []);
  return null;
}

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <RoutePrefetcher />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/onboarding" element={<AuthOnlyRoute><Onboarding /></AuthOnlyRoute>} />
                <Route path="/register" element={<PatientSelfRegister />} />
                <Route path="/r/status" element={<PatientStatus />} />
                <Route path="/accept-invite/:token" element={<AcceptInvite />} />
                <Route path="/sign/plan/:token" element={<PublicTreatmentPlanSign />} />
                <Route path="/display" element={<DisplayPair />} />
                <Route path="/display/:code" element={<DisplayScreen />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/dr-dashboard" element={<ProtectedRoute><DrDashboard /></ProtectedRoute>} />
                <Route path="/today-schedule" element={<ProtectedRoute><TodaySchedule /></ProtectedRoute>} />
                <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
                <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
                <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
                <Route path="/treatment-plans" element={<ProtectedRoute><TreatmentPlans /></ProtectedRoute>} />
                <Route path="/finance-hub" element={<ProtectedRoute><FinanceHub /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsHub /></ProtectedRoute>} />
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
                <Route path="/insurance" element={<ProtectedRoute><InsuranceClaims /></ProtectedRoute>} />
                <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                <Route path="/programs" element={<ProtectedRoute><ErrorBoundary name="Patient Programs"><PatientPrograms /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/programs/:clinicId" element={<ErrorBoundary name="Public Programs"><PublicPrograms /></ErrorBoundary>} />
                <Route path="/programs/:clinicId/manage" element={<ErrorBoundary name="Manage Programs"><PublicManagePrograms /></ErrorBoundary>} />
                <Route path="/ai-generator" element={<ProtectedRoute><AIGenerator /></ProtectedRoute>} />
                <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
                <Route path="/whatsapp-status" element={<ProtectedRoute><WhatsAppStatus /></ProtectedRoute>} />
                <Route path="/dental-chart/:patientId" element={<ProtectedRoute><DentalChart /></ProtectedRoute>} />
                <Route path="/queue" element={<ProtectedRoute><Queue /></ProtectedRoute>} />
                <Route path="/lab-orders" element={<ProtectedRoute><LabOrders /></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
                <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
                <Route path="/treatment-costing" element={<ProtectedRoute><TreatmentCosting /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                <Route path="/revenue" element={<ProtectedRoute><Revenue /></ProtectedRoute>} />
                <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
                <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
                <Route path="/reviews" element={<ProtectedRoute><Reviews /></ProtectedRoute>} />
                <Route path="/google-reviews" element={<ProtectedRoute><ErrorBoundary name="Google Reviews"><GoogleReviews /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/referrals" element={<ProtectedRoute><Referrals /></ProtectedRoute>} />
                <Route path="/memberships" element={<ProtectedRoute><Memberships /></ProtectedRoute>} />
                <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                <Route path="/agent-preview" element={<ProtectedRoute><AgentPreview /></ProtectedRoute>} />

                <Route path="/audit-log" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
                <Route path="/partners" element={<ProtectedRoute><Partners /></ProtectedRoute>} />
                <Route path="/ortho" element={<ProtectedRoute><Orthodontics /></ProtectedRoute>} />
                <Route path="/ortho/:caseId" element={<ProtectedRoute><OrthoCase /></ProtectedRoute>} />
                <Route path="/social-calendar" element={<ProtectedRoute><SocialCalendar /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/super-admin" element={<Navigate to="/platform" replace />} />
                <Route path="/platform" element={<Platform />} />
                <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
                <Route path="/focus" element={<ProtectedRoute><FocusToday /></ProtectedRoute>} />
                <Route path="/focus/patient/:id" element={<ProtectedRoute><FocusPatient /></ProtectedRoute>} />
                <Route path="/front-desk" element={<ProtectedRoute><FrontDesk /></ProtectedRoute>} />

                <Route path="/patient-education" element={<ProtectedRoute><PatientEducation /></ProtectedRoute>} />
                <Route path="/displays" element={<ProtectedRoute><DisplayManager /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
