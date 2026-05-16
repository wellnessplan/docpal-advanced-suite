import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPaged } from "@/lib/supabase-paged";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, TrendingUp, Users, Stethoscope, CalendarDays, FileText, FileSpreadsheet } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { toast } from "sonner";
import { loadJsPdf } from "@/lib/pdf-loader";
import * as XLSX from "xlsx";

const COLORS = ["hsl(187,72%,39%)", "hsl(152,44%,46%)", "hsl(38,92%,50%)", "hsl(0,72%,58%)", "hsl(280,60%,50%)", "hsl(199,89%,48%)"];

export default function ReportsPage() {
  const { clinicId, profile } = useAuth();
  const [period, setPeriod] = useState("6");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: clinicInfo } = useQuery({
    queryKey: ["report-clinic-info", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("clinics").select("name, phone, address, email").eq("id", clinicId!).single();
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["report-doctors", clinicId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").eq("clinic_id", clinicId!).in("role", ["doctor", "admin"]);
      return data ?? [];
    },
    enabled: !!clinicId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["report-invoices", clinicId],
    queryFn: async () => fetchAllPaged((from, to) =>
      supabase.from("invoices").select("amount, status, paid_at, created_at, payment_method")
        .eq("clinic_id", clinicId!).range(from, to)
    ),
    enabled: !!clinicId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["report-expenses", clinicId],
    queryFn: async () => fetchAllPaged((from, to) =>
      supabase.from("expenses").select("amount, category, expense_date")
        .eq("clinic_id", clinicId!).range(from, to)
    ),
    enabled: !!clinicId,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["report-appointments", clinicId],
    queryFn: async () => fetchAllPaged((from, to) =>
      supabase.from("appointments").select("status, appointment_date, type, provider_id, doctor_id")
        .eq("clinic_id", clinicId!).range(from, to)
    ),
    enabled: !!clinicId,
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["report-patients", clinicId],
    queryFn: async () => fetchAllPaged((from, to) =>
      supabase.from("patients").select("id, gender, date_of_birth, created_at")
        .eq("clinic_id", clinicId!).range(from, to)
    ),
    enabled: !!clinicId,
  });

  const { data: treatments = [] } = useQuery({
    queryKey: ["report-treatments", clinicId],
    queryFn: async () => fetchAllPaged((from, to) =>
      supabase.from("tooth_treatments")
        .select("treatment_name, cost, status, created_at, performed_by").range(from, to)
    ),
    enabled: !!clinicId,
  });

  // Filter by doctor
  const filteredAppointments = useMemo(() => {
    if (doctorFilter === "all") return appointments;
    return appointments.filter((a: any) => a.doctor_id === doctorFilter || a.provider_id === doctorFilter);
  }, [appointments, doctorFilter]);

  const filteredTreatments = useMemo(() => {
    if (doctorFilter === "all") return treatments;
    return treatments.filter((t: any) => t.performed_by === doctorFilter);
  }, [treatments, doctorFilter]);

  // === REVENUE DATA ===
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; revenue: number; expenses: number; profit: number; invoices: number; noShows: number }> = {};
    const now = new Date();
    const n = parseInt(period);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { month: d.toLocaleString("default", { month: "short", year: "2-digit" }), revenue: 0, expenses: 0, profit: 0, invoices: 0, noShows: 0 };
    }
    invoices.forEach((inv: any) => {
      const d = inv.paid_at || inv.created_at;
      const key = d?.substring(0, 7);
      if (months[key]) {
        if (inv.status === "paid") months[key].revenue += Number(inv.amount);
        months[key].invoices++;
      }
    });
    expenses.forEach((exp: any) => {
      const key = exp.expense_date?.substring(0, 7);
      if (months[key]) months[key].expenses += Number(exp.amount);
    });
    filteredAppointments.forEach((apt: any) => {
      const key = apt.appointment_date?.substring(0, 7);
      if (months[key] && apt.status === "no_show") months[key].noShows++;
    });
    Object.values(months).forEach(m => { m.profit = m.revenue - m.expenses; });
    return Object.values(months);
  }, [invoices, expenses, filteredAppointments, period]);

  const totals = useMemo(() => {
    const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
    const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
    const totalNoShows = monthlyData.reduce((s, m) => s + m.noShows, 0);
    const totalInvoices = monthlyData.reduce((s, m) => s + m.invoices, 0);
    return { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses, totalNoShows, totalInvoices };
  }, [monthlyData]);

  const expenseByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    expenses.forEach((e: any) => { cats[e.category || "Other"] = (cats[e.category || "Other"] || 0) + Number(e.amount); });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const treatmentBreakdown = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number; completed: number }> = {};
    filteredTreatments.forEach((t: any) => {
      if (!map[t.treatment_name]) map[t.treatment_name] = { name: t.treatment_name, count: 0, revenue: 0, completed: 0 };
      map[t.treatment_name].count++;
      map[t.treatment_name].revenue += Number(t.cost || 0);
      if (t.status === "completed") map[t.treatment_name].completed++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filteredTreatments]);

  const treatmentStatusDist = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTreatments.forEach((t: any) => { map[t.status || "unknown"] = (map[t.status || "unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [filteredTreatments]);

  const patientDemographics = useMemo(() => {
    const genderDist: Record<string, number> = {};
    const ageBuckets: Record<string, number> = { "0-18": 0, "19-30": 0, "31-45": 0, "46-60": 0, "60+": 0, "Unknown": 0 };
    patients.forEach((p: any) => {
      genderDist[p.gender || "Unknown"] = (genderDist[p.gender || "Unknown"] || 0) + 1;
      if (p.date_of_birth) {
        const age = Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age <= 18) ageBuckets["0-18"]++;
        else if (age <= 30) ageBuckets["19-30"]++;
        else if (age <= 45) ageBuckets["31-45"]++;
        else if (age <= 60) ageBuckets["46-60"]++;
        else ageBuckets["60+"]++;
      } else {
        ageBuckets["Unknown"]++;
      }
    });
    return {
      gender: Object.entries(genderDist).map(([name, value]) => ({ name, value })),
      age: Object.entries(ageBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })),
    };
  }, [patients]);

  const patientGrowth = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    const n = parseInt(period);
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    patients.forEach((p: any) => {
      const key = p.created_at?.substring(0, 7);
      if (months[key] !== undefined) months[key]++;
    });
    let cumulative = 0;
    return Object.entries(months).map(([key, count]) => {
      cumulative += count;
      const d = new Date(key + "-01");
      return { month: d.toLocaleString("default", { month: "short" }), newPatients: count, totalPatients: cumulative };
    });
  }, [patients, period]);

  const appointmentByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filteredAppointments.forEach((a: any) => { map[a.status || "unknown"] = (map[a.status || "unknown"] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [filteredAppointments]);

  const margin = totals.totalRevenue > 0 ? ((totals.profit / totals.totalRevenue) * 100).toFixed(1) : "0.0";

  // ===================== PDF EXPORT =====================
  const generatePDF = async () => {
    const JsPDF = await loadJsPdf();
    const doc = new JsPDF("p", "mm", "a4");
    const pw = 210;
    const clinicName = clinicInfo?.name || "DoctorsBuddy Clinic";
    const reportPeriod = `Last ${period} Months`;

    // Cover page
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pw, 297, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.text(clinicName, pw / 2, 100, { align: "center" });
    doc.setFontSize(16);
    doc.text("Practice Performance Report", pw / 2, 115, { align: "center" });
    doc.setFontSize(12);
    doc.text(reportPeriod, pw / 2, 130, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}`, pw / 2, 145, { align: "center" });
    if (doctorFilter !== "all") {
      const docName = doctors.find(d => d.id === doctorFilter)?.full_name || "";
      doc.text(`Doctor: ${docName}`, pw / 2, 155, { align: "center" });
    }

    // Page 2: Overview
    doc.addPage();
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.text("1. Overview Summary", 15, 25);
    doc.setDrawColor(100, 181, 219);
    doc.line(15, 28, 195, 28);

    const summaryItems = [
      ["Total Revenue", `Rs ${totals.totalRevenue.toLocaleString()}`],
      ["Total Expenses", `Rs ${totals.totalExpenses.toLocaleString()}`],
      ["Net Profit", `Rs ${totals.profit.toLocaleString()}`],
      ["Profit Margin", `${margin}%`],
      ["Total Patients", `${patients.length}`],
      ["Total Appointments", `${filteredAppointments.length}`],
      ["No-Show Count", `${totals.totalNoShows}`],
      ["Treatments Completed", `${filteredTreatments.filter((t: any) => t.status === "completed").length}`],
    ];

    let y = 40;
    doc.setFontSize(11);
    summaryItems.forEach(([label, value]) => {
      doc.setTextColor(100, 100, 100);
      doc.text(label, 20, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(value, 120, y);
      doc.setFont("helvetica", "normal");
      y += 10;
    });

    // Page 3: Financial Summary
    doc.addPage();
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.text("2. Financial Summary", 15, 25);
    doc.line(15, 28, 195, 28);

    y = 40;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Month", 20, y);
    doc.text("Revenue", 60, y);
    doc.text("Expenses", 100, y);
    doc.text("Profit", 140, y);
    doc.text("Margin", 175, y);
    doc.setFont("helvetica", "normal");
    y += 8;

    monthlyData.forEach(m => {
      doc.text(m.month, 20, y);
      doc.text(`Rs ${m.revenue.toLocaleString()}`, 60, y);
      doc.text(`Rs ${m.expenses.toLocaleString()}`, 100, y);
      const profitColor = m.profit >= 0 ? [46, 125, 50] : [211, 47, 47];
      doc.setTextColor(...(profitColor as [number, number, number]));
      doc.text(`Rs ${m.profit.toLocaleString()}`, 140, y);
      doc.text(`${m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : "0"}%`, 175, y);
      doc.setTextColor(30, 41, 59);
      y += 7;
    });

    // Page 4: Clinical Performance
    doc.addPage();
    doc.setFontSize(18);
    doc.text("3. Clinical Performance", 15, 25);
    doc.line(15, 28, 195, 28);

    y = 40;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Treatment", 20, y);
    doc.text("Count", 90, y);
    doc.text("Completed", 115, y);
    doc.text("Rate", 145, y);
    doc.text("Revenue", 170, y);
    doc.setFont("helvetica", "normal");
    y += 8;

    treatmentBreakdown.slice(0, 15).forEach(t => {
      if (y > 270) { doc.addPage(); y = 25; }
      doc.text(t.name.substring(0, 30), 20, y);
      doc.text(`${t.count}`, 90, y);
      doc.text(`${t.completed}`, 115, y);
      doc.text(`${t.count > 0 ? ((t.completed / t.count) * 100).toFixed(0) : 0}%`, 145, y);
      doc.text(`Rs ${t.revenue.toLocaleString()}`, 170, y);
      y += 7;
    });

    // Page 5: Patient Insights
    doc.addPage();
    doc.setFontSize(18);
    doc.text("4. Patient Insights", 15, 25);
    doc.line(15, 28, 195, 28);

    y = 40;
    doc.setFontSize(11);
    doc.text(`Total Patients: ${patients.length}`, 20, y); y += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Gender Distribution", 20, y);
    doc.setFont("helvetica", "normal");
    y += 8;
    patientDemographics.gender.forEach(g => {
      doc.text(`${g.name}: ${g.value} (${patients.length > 0 ? ((g.value / patients.length) * 100).toFixed(1) : 0}%)`, 25, y);
      y += 7;
    });

    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Age Distribution", 20, y);
    doc.setFont("helvetica", "normal");
    y += 8;
    patientDemographics.age.forEach(a => {
      doc.text(`${a.name}: ${a.value}`, 25, y);
      y += 7;
    });

    // Key Insights Page
    doc.addPage();
    doc.setFontSize(18);
    doc.text("5. Key Insights & Recommendations", 15, 25);
    doc.line(15, 28, 195, 28);

    y = 40;
    doc.setFontSize(11);
    const insights = [];

    if (totals.totalRevenue > 0) {
      insights.push(`• Total revenue for the period: Rs ${totals.totalRevenue.toLocaleString()} with ${margin}% profit margin.`);
    }
    if (totals.totalNoShows > 0) {
      const noShowRate = filteredAppointments.length > 0 ? ((totals.totalNoShows / filteredAppointments.length) * 100).toFixed(1) : "0";
      insights.push(`• No-show rate is ${noShowRate}% (${totals.totalNoShows} patients). Consider SMS/WhatsApp reminders.`);
    }
    if (treatmentBreakdown.length > 0) {
      insights.push(`• Most popular treatment: ${treatmentBreakdown[0].name} (${treatmentBreakdown[0].count} cases).`);
    }
    if (patients.length > 0) {
      const arpp = Math.round(totals.totalRevenue / patients.length);
      insights.push(`• Average Revenue Per Patient: Rs ${arpp.toLocaleString()}.`);
    }
    insights.push(`• ${filteredTreatments.filter((t: any) => t.status === "planned").length} planned treatments pending conversion.`);

    insights.forEach(line => {
      if (y > 270) { doc.addPage(); y = 25; }
      doc.text(line, 20, y, { maxWidth: 170 });
      y += 10;
    });

    // Footer on each page
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`${clinicName} | ${reportPeriod} | Page ${i - 1} of ${totalPages - 1}`, pw / 2, 290, { align: "center" });
    }

    doc.save(`${clinicName.replace(/\s+/g, "_")}_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF report downloaded!");
  };

  // ===================== EXCEL EXPORT =====================
  const generateExcel = () => {
    const wb = XLSX.utils.book_new();

    // Overview sheet
    const overviewData = [
      ["Clinic Performance Report"],
      ["Clinic", clinicInfo?.name || ""],
      ["Period", `Last ${period} Months`],
      ["Generated", new Date().toLocaleDateString()],
      [],
      ["Metric", "Value"],
      ["Total Revenue", totals.totalRevenue],
      ["Total Expenses", totals.totalExpenses],
      ["Net Profit", totals.profit],
      ["Profit Margin", `${margin}%`],
      ["Total Patients", patients.length],
      ["Appointments", filteredAppointments.length],
      ["No-Shows", totals.totalNoShows],
      ["Treatments Completed", filteredTreatments.filter((t: any) => t.status === "completed").length],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
    ws1["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Overview");

    // Monthly financial
    const finData = [
      ["Month", "Revenue", "Expenses", "Profit", "Margin %", "Invoices", "No-Shows"],
      ...monthlyData.map(m => [m.month, m.revenue, m.expenses, m.profit, m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : "0", m.invoices, m.noShows])
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(finData);
    ws2["!cols"] = Array(7).fill({ wch: 15 });
    XLSX.utils.book_append_sheet(wb, ws2, "Financial");

    // Treatments
    const treatData = [
      ["Treatment", "Count", "Completed", "Completion Rate %", "Revenue"],
      ...treatmentBreakdown.map(t => [t.name, t.count, t.completed, t.count > 0 ? ((t.completed / t.count) * 100).toFixed(1) : "0", t.revenue])
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(treatData);
    ws3["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Treatments");

    // Patients
    const patData = [
      ["Patient Demographics"],
      [],
      ["Gender", "Count"],
      ...patientDemographics.gender.map(g => [g.name, g.value]),
      [],
      ["Age Group", "Count"],
      ...patientDemographics.age.map(a => [a.name, a.value]),
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(patData);
    XLSX.utils.book_append_sheet(wb, ws4, "Patients");

    // Appointments
    const apptData = [
      ["Status", "Count"],
      ...appointmentByStatus.map(a => [a.name, a.value]),
    ];
    const ws5 = XLSX.utils.aoa_to_sheet(apptData);
    XLSX.utils.book_append_sheet(wb, ws5, "Appointments");

    XLSX.writeFile(wb, `Clinic_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel report downloaded!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground text-sm">Comprehensive practice performance insights with export</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 Months</SelectItem>
                <SelectItem value="6">Last 6 Months</SelectItem>
                <SelectItem value="12">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="All Doctors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Doctors</SelectItem>
                {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={generatePDF} className="gap-1.5">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={generateExcel} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Revenue", value: `Rs ${totals.totalRevenue.toLocaleString()}`, color: "bg-success/10 text-success" },
            { label: "Net Profit", value: `Rs ${totals.profit.toLocaleString()}`, color: totals.profit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive" },
            { label: "Total Patients", value: patients.length, color: "bg-primary/10 text-primary" },
            { label: "Treatments Done", value: filteredTreatments.filter((t: any) => t.status === "completed").length, color: "bg-accent text-accent-foreground" },
          ].map(kpi => (
            <Card key={kpi.label} className="shadow-card border-0">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold font-heading mt-1">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabbed Reports */}
        <Tabs defaultValue="revenue">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="revenue" className="gap-1"><TrendingUp className="h-3 w-3" /> Revenue</TabsTrigger>
            <TabsTrigger value="treatments" className="gap-1"><Stethoscope className="h-3 w-3" /> Treatments</TabsTrigger>
            <TabsTrigger value="patients" className="gap-1"><Users className="h-3 w-3" /> Patients</TabsTrigger>
            <TabsTrigger value="appointments" className="gap-1"><CalendarDays className="h-3 w-3" /> Appointments</TabsTrigger>
          </TabsList>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-card border-0 lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Revenue Trend</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(152,44%,46%)" fill="hsl(152,44%,46%)" fillOpacity={0.1} name="Revenue" strokeWidth={2} />
                      <Area type="monotone" dataKey="expenses" stroke="hsl(0,72%,58%)" fill="hsl(0,72%,58%)" fillOpacity={0.1} name="Expenses" strokeWidth={2} />
                      <Line type="monotone" dataKey="profit" stroke="hsl(187,72%,39%)" name="Profit" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Breakdown</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Gross Revenue</p>
                    <p className="text-xl font-bold font-heading">Rs {totals.totalRevenue.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Total Expenses</p>
                    <p className="text-xl font-bold font-heading text-destructive">Rs {totals.totalExpenses.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Net Profit</p>
                    <p className={`text-xl font-bold font-heading ${totals.profit >= 0 ? "text-success" : "text-destructive"}`}>Rs {totals.profit.toLocaleString()}</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Profit Margin</span>
                      <span className="font-medium">{margin}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, parseFloat(margin)))}%` }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Expense by Category</CardTitle></CardHeader>
                <CardContent>
                  {expenseByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={expenseByCategory} cx="50%" cy="50%" outerRadius={90} innerRadius={40} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {expenseByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground py-8 text-center">No expense data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0 lg:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Monthly Performance</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Expenses</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData.map(m => (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{m.month}</TableCell>
                          <TableCell>Rs {m.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-destructive">Rs {m.expenses.toLocaleString()}</TableCell>
                          <TableCell className={m.profit >= 0 ? "text-success" : "text-destructive"}>Rs {m.profit.toLocaleString()}</TableCell>
                          <TableCell>{m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : "0.0"}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TREATMENTS TAB */}
          <TabsContent value="treatments" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Top Treatments</CardTitle></CardHeader>
                <CardContent>
                  {treatmentBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={treatmentBreakdown.slice(0, 8)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(187,72%,39%)" name="Procedures" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No treatment data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Treatment Status</CardTitle></CardHeader>
                <CardContent>
                  {treatmentStatusDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={treatmentStatusDist} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {treatmentStatusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card border-0">
              <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Treatment Details</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Treatment</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treatmentBreakdown.map(t => (
                      <TableRow key={t.name}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.count}</TableCell>
                        <TableCell>{t.completed}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {t.count > 0 ? ((t.completed / t.count) * 100).toFixed(0) : 0}%
                          </Badge>
                        </TableCell>
                        <TableCell>Rs {t.revenue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!treatmentBreakdown.length && (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No treatments</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PATIENTS TAB */}
          <TabsContent value="patients" className="mt-4 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Gender Distribution</CardTitle></CardHeader>
                <CardContent>
                  {patientDemographics.gender.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={patientDemographics.gender} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {patientDemographics.gender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Age Distribution</CardTitle></CardHeader>
                <CardContent>
                  {patientDemographics.age.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={patientDemographics.age}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(152,44%,46%)" name="Patients" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Patient Growth</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={patientGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="newPatients" stroke="hsl(187,72%,39%)" fill="hsl(187,72%,39%)" fillOpacity={0.15} name="New Patients" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* APPOINTMENTS TAB */}
          <TabsContent value="appointments" className="mt-4 space-y-6">
            <Card className="shadow-card border-0">
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold font-heading">{filteredAppointments.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-success">{filteredAppointments.filter((a: any) => a.status === "completed").length}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-destructive">{filteredAppointments.filter((a: any) => a.status === "no_show").length}</p>
                    <p className="text-xs text-muted-foreground">No-Shows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading text-warning">{filteredAppointments.filter((a: any) => a.status === "cancelled").length}</p>
                    <p className="text-xs text-muted-foreground">Cancelled</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">By Status</CardTitle></CardHeader>
                <CardContent>
                  {appointmentByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={appointmentByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name} (${value})`}>
                          {appointmentByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">No data</p>}
                </CardContent>
              </Card>

              <Card className="shadow-card border-0">
                <CardHeader className="pb-2"><CardTitle className="text-base font-heading">Monthly Volume</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="invoices" fill="hsl(197,71%,63%)" name="Appointments" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="noShows" fill="hsl(0,72%,58%)" name="No-Shows" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
