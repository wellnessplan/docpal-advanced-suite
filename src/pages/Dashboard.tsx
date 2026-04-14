import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { UserPlus, Play, CalendarDays, FileText, Download } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/DashboardLayout";
import KPICards from "@/components/dashboard/KPICards";
import UpNextWidget from "@/components/dashboard/UpNextWidget";
import LiveQueueWidget from "@/components/dashboard/LiveQueueWidget";
import TodayAppointments from "@/components/dashboard/TodayAppointments";
import FinancialSummary from "@/components/dashboard/FinancialSummary";
import DailyTodoPanel from "@/components/dashboard/DailyTodoPanel";
import SmartInsights from "@/components/dashboard/SmartInsights";
import DailyActionCenter from "@/components/dashboard/DailyActionCenter";
import { AppointmentHeatmap, RevenueTrendMini, WalkinVsBookedChart } from "@/components/dashboard/ClinicOverviewCharts";

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <DashboardLayout>
      <div className="space-y-5 md:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
              {greeting}, {profile?.full_name?.split(" ")[0] || "Doctor"} 👋
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">Here's what's happening at your clinic today.</p>
          </div>
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 -mx-1 px-1">
            <Button size="sm" onClick={() => navigate("/patients")} className="gap-1.5 shrink-0">
              <UserPlus className="h-3.5 w-3.5" /> Walk-in
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/queue")} className="gap-1.5 shrink-0">
              <Play className="h-3.5 w-3.5" /> Queue
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/appointments")} className="gap-1.5 shrink-0">
              <CalendarDays className="h-3.5 w-3.5" /> Appointment
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/reports")} className="gap-1.5 shrink-0">
              <Download className="h-3.5 w-3.5" /> Reports
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards />

        {isMobile ? (
          <div className="space-y-4">
            <SmartInsights />
            <DailyActionCenter />
            <div className="overflow-x-auto -mx-4 px-4">
              <div className="flex gap-3 w-max">
                <div className="w-[280px] shrink-0"><UpNextWidget /></div>
                <div className="w-[280px] shrink-0"><LiveQueueWidget /></div>
                <div className="w-[280px] shrink-0"><FinancialSummary /></div>
              </div>
            </div>
            <TodayAppointments />
            <RevenueTrendMini />
            <DailyTodoPanel />
          </div>
        ) : (
          <>
            {/* Row 1: Insights + Action Center */}
            <div className="grid gap-6 lg:grid-cols-2">
              <SmartInsights />
              <DailyActionCenter />
            </div>

            {/* Row 2: Key Widgets */}
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6">
                <UpNextWidget />
                <FinancialSummary />
              </div>
              <LiveQueueWidget />
              <TodayAppointments />
            </div>

            {/* Row 3: Charts */}
            <div className="grid gap-6 lg:grid-cols-3">
              <RevenueTrendMini />
              <AppointmentHeatmap />
              <WalkinVsBookedChart />
            </div>

            {/* Row 4: Todos */}
            <div className="grid gap-6 lg:grid-cols-2">
              <DailyTodoPanel />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
