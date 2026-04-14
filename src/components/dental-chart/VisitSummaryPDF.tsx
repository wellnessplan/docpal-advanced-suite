import jsPDF from "jspdf";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { FileText, Share2 } from "lucide-react";
import { toast } from "sonner";

interface VisitSummaryProps {
  patient: any;
  patientId: string;
  clinic: any;
  treatments?: { tooth_number?: number | string; treatment_name?: string; status?: string; cost?: number }[];
  medications?: { name: string; dosage: string; frequency: string; duration: string }[];
  chiefComplaint?: string;
  diagnosisNotes?: string;
  appointments?: { appointment_date: string; appointment_time: string; type?: string; status?: string }[];
  invoices?: { invoice_number?: string; total: number; paid_amount: number; status?: string }[];
}

export default function VisitSummaryPDF({
  patient, patientId, clinic, treatments = [], medications = [],
  chiefComplaint, diagnosisNotes, appointments = [], invoices = [],
}: VisitSummaryProps) {

  const buildPDF = async () => {
    const doc = new jsPDF({ format: "a4", unit: "mm" });
    const lm = 15, rm = 195, pw = rm - lm;
    let y = 15;

    const checkPage = (needed: number) => {
      if (y + needed > 275) { doc.addPage(); y = 15; }
    };

    // Header
    doc.setFillColor(237, 247, 255);
    doc.rect(0, 0, 210, 40, "F");
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 110);
    doc.text(clinic?.name || "Clinic", lm, 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (clinic?.address) doc.text(clinic.address, lm, 22);
    if (clinic?.phone) doc.text(`Phone: ${clinic.phone}`, lm, 27);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 110);
    doc.text("Visit Summary", rm, 16, { align: "right" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, rm, 22, { align: "right" });

    y = 45;

    // Patient info
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(lm, y, pw, 20, 2, 2, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(patient?.full_name || "Patient", lm + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    const infoLine = [
      patient?.phone && `📱 ${patient.phone}`,
      patient?.date_of_birth && `DOB: ${patient.date_of_birth}`,
      patient?.gender && patient.gender,
      patient?.blood_group && `Blood: ${patient.blood_group}`,
    ].filter(Boolean).join("  |  ");
    doc.text(infoLine, lm + 4, y + 13);
    if (patient?.allergies) {
      doc.setTextColor(200, 0, 0);
      doc.text(`⚠ Allergies: ${patient.allergies}`, lm + 4, y + 18);
      doc.setTextColor(80);
    }
    y += 25;

    // Section helper
    const section = (title: string) => {
      checkPage(12);
      doc.setDrawColor(200);
      doc.line(lm, y, rm, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 110);
      doc.text(title, lm, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.setFontSize(8);
    };

    // Chief Complaint
    if (chiefComplaint) {
      section("Chief Complaint");
      doc.text(chiefComplaint, lm + 2, y);
      y += 6;
    }

    // Diagnosis
    if (diagnosisNotes) {
      section("Diagnosis");
      const lines = doc.splitTextToSize(diagnosisNotes, pw - 4);
      checkPage(lines.length * 4);
      doc.text(lines, lm + 2, y);
      y += lines.length * 4 + 2;
    }

    // Treatments performed today
    const todayTx = treatments.filter(t => t.status === "completed" || t.status === "in_progress");
    if (todayTx.length > 0) {
      section("Treatments");
      todayTx.forEach((t, i) => {
        checkPage(6);
        doc.text(`${i + 1}. Tooth #${t.tooth_number || "—"} — ${t.treatment_name || "—"} (${t.status})`, lm + 2, y);
        y += 5;
      });
      y += 2;
    }

    // Medications
    if (medications.length > 0) {
      section("Medications Prescribed");
      // Table header
      doc.setFillColor(230, 240, 250);
      doc.rect(lm, y - 3, pw, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.text("Medicine", lm + 2, y);
      doc.text("Dosage", lm + 70, y);
      doc.text("Frequency", lm + 100, y);
      doc.text("Duration", lm + 140, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      medications.forEach(m => {
        checkPage(6);
        doc.text(m.name, lm + 2, y);
        doc.text(m.dosage, lm + 70, y);
        doc.text(m.frequency, lm + 100, y);
        doc.text(m.duration, lm + 140, y);
        y += 5;
      });
      y += 2;
    }

    // Today's appointments
    const todayStr = new Date().toISOString().split("T")[0];
    const todayAppts = appointments.filter(a => a.appointment_date === todayStr);
    if (todayAppts.length > 0) {
      section("Today's Appointments");
      todayAppts.forEach((a, i) => {
        checkPage(6);
        doc.text(`${i + 1}. ${a.appointment_time} — ${a.type || "General"} (${a.status || "scheduled"})`, lm + 2, y);
        y += 5;
      });
      y += 2;
    }

    // Billing summary
    const activeInvoices = invoices.filter(inv => inv.status !== "cancelled");
    if (activeInvoices.length > 0) {
      section("Billing Summary");
      const totalBilled = activeInvoices.reduce((s, i) => s + Number(i.total), 0);
      const totalPaid = activeInvoices.reduce((s, i) => s + Number(i.paid_amount), 0);
      doc.text(`Total Billed: ₹${totalBilled.toLocaleString()}`, lm + 2, y);
      y += 5;
      doc.text(`Total Paid: ₹${totalPaid.toLocaleString()}`, lm + 2, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.text(`Balance: ₹${(totalBilled - totalPaid).toLocaleString()}`, lm + 2, y);
      doc.setFont("helvetica", "normal");
      y += 6;
    }

    // QR Code
    try {
      const qrUrl = `${window.location.origin}/patients/${patientId}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 100, margin: 1 });
      checkPage(30);
      doc.addImage(qrDataUrl, "PNG", lm, y, 22, 22);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text("Scan to view patient record", lm, y + 25);
    } catch { /* skip QR */ }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text(`Generated by DoctorsBuddy • ${new Date().toLocaleString("en-IN")}`, 105, 290, { align: "center" });
      doc.text(`Page ${i} of ${pageCount}`, rm, 290, { align: "right" });
    }

    return doc;
  };

  const handleDownload = async () => {
    try {
      const doc = await buildPDF();
      doc.save(`VisitSummary_${patient?.full_name?.replace(/\s/g, "_") || "patient"}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Visit summary downloaded");
    } catch (e: any) {
      toast.error("Failed to generate PDF");
    }
  };

  const handleShare = async () => {
    try {
      const doc = await buildPDF();
      const blob = doc.output("blob");
      const file = new File([blob], `VisitSummary_${patient?.full_name || "patient"}.pdf`, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Visit Summary" });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5">
        <FileText className="h-3.5 w-3.5" /> Visit Summary
      </Button>
      <Button size="sm" variant="ghost" onClick={handleShare} className="gap-1.5">
        <Share2 className="h-3.5 w-3.5" /> Share
      </Button>
    </div>
  );
}
