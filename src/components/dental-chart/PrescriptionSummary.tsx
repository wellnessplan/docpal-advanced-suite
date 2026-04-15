import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Printer, Download, Share2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import type { Medication } from "./MedicationPanel";

interface PrescriptionSummaryProps {
  patient: any;
  clinic: any;
  chiefComplaint: string;
  gumCondition: string;
  alignmentCondition: string;
  diagnosisNotes: string;
  treatmentPlan: string;
  medications: Medication[];
  items: any[];
  status: string;
  onConfirm: () => void;
  isConfirming: boolean;
}

export default function PrescriptionSummary({
  patient, clinic, chiefComplaint, gumCondition, alignmentCondition,
  diagnosisNotes, treatmentPlan, medications, items, status, onConfirm, isConfirming,
}: PrescriptionSummaryProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Prescription - ${patient?.full_name}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',system-ui,sans-serif;padding:40px;color:#1a1f2e;background:#fff}
      .rx-card{max-width:720px;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #7ec8e3}
      .clinic-name{font-size:22px;font-weight:700;color:#1a1f2e;letter-spacing:-0.3px}
      .clinic-detail{font-size:11px;color:#64748b;margin-top:2px}
      .patient-box{text-align:right}
      .patient-box p{font-size:11px;color:#64748b;margin:1px 0}
      .patient-name{font-size:13px;font-weight:600;color:#1a1f2e}
      .section{margin-top:20px}
      .section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7ec8e3;margin-bottom:8px}
      .section-body{font-size:13px;line-height:1.6;color:#334155}
      .clinical-tags{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
      .tag{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;background:#f0f9ff;color:#0284c7;border:1px solid #bae6fd}
      .findings-table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0}
      .findings-table th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;border-bottom:1px solid #e2e8f0}
      .findings-table td{padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9}
      .findings-table tr:last-child td{border-bottom:none}
      .findings-table .total-row{background:#f8fafc;font-weight:700}
      .rx-symbol{font-size:28px;font-weight:800;color:#7ec8e3;margin-right:8px;font-style:italic}
      .med-row{display:flex;align-items:baseline;gap:12px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
      .med-row:last-child{border-bottom:none}
      .med-name{font-weight:600;min-width:140px}
      .med-detail{color:#64748b}
      .footer{margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end}
      .footer-left{font-size:9px;color:#94a3b8}
      .signature-box{border-top:1px solid #1a1f2e;padding-top:6px;text-align:center;width:180px;font-size:11px;color:#64748b}
      @media print{body{padding:20px}@page{margin:15mm}}
    </style></head><body>${printContent.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lm = 20;
    const pw = 170;

    // Header with accent line
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(clinic?.name || "Dental Clinic", lm, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (clinic?.address) { doc.text(clinic.address, lm, y); y += 4; }
    if (clinic?.phone || clinic?.email) { doc.text(`${clinic?.phone || ""} · ${clinic?.email || ""}`, lm, y); y += 4; }

    // Patient info right-aligned
    const ptAge = patient?.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;
    const ptMeta = [
      patient?.op_number,
      ptAge ? `${ptAge}y` : null,
      patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null,
    ].filter(Boolean).join(" · ");

    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, lm + pw, 20, { align: "right" });
    doc.setTextColor(30);
    doc.text(`${patient?.full_name || ""}`, lm + pw, 25, { align: "right" });
    doc.setTextColor(100);
    if (patient?.phone) doc.text(`Ph: ${patient.phone}`, lm + pw, 29, { align: "right" });
    if (ptMeta) doc.text(ptMeta, lm + pw, 33, { align: "right" });

    // Accent line
    y += 2;
    doc.setDrawColor(126, 200, 227);
    doc.setLineWidth(1);
    doc.line(lm, y, lm + pw, y);
    y += 10;
    doc.setTextColor(30);

    // Chief Complaint
    if (chiefComplaint) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(126, 200, 227);
      doc.text("CHIEF COMPLAINT", lm, y);
      doc.setTextColor(30);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(chiefComplaint, pw);
      doc.text(lines, lm, y); y += lines.length * 4.5 + 5;
    }

    // Clinical
    const tags: string[] = [];
    if (gumCondition && gumCondition !== "normal") tags.push(`Gum: ${gumCondition}`);
    if (alignmentCondition && alignmentCondition !== "normal") tags.push(`Alignment: ${alignmentCondition}`);
    if (tags.length) {
      doc.setFontSize(9);
      doc.text(tags.join("  ·  "), lm, y);
      y += 5;
    }
    if (diagnosisNotes) {
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(diagnosisNotes, pw);
      doc.text(lines, lm, y); y += lines.length * 4 + 5;
    }

    // Findings table
    if (items.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(126, 200, 227);
      doc.text("DENTAL FINDINGS", lm, y);
      doc.setTextColor(30);
      y += 6;

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const cols = [lm, lm + 18, lm + 68, lm + 118, lm + 148];
      const heads = ["Tooth", "Condition", "Treatment", "Status", ""];
      doc.setFillColor(248, 250, 252);
      doc.rect(lm, y - 4, pw, 7, "F");
      doc.setFont("helvetica", "bold");
      heads.forEach((h, i) => doc.text(h, cols[i], y));
      y += 6;
      doc.setFont("helvetica", "normal");

      items.forEach((item: any) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(String(item.tooth_number || "—"), cols[0], y);
        doc.text(item.condition || "—", cols[1], y);
        doc.text(item.treatment || "—", cols[2], y);
        doc.text(item.treatment_status?.replace("_", " ") || "—", cols[3], y);
        y += 5;
      });
      y += 4;
    }

    // Treatment Plan
    if (treatmentPlan) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(126, 200, 227);
      doc.text("TREATMENT PLAN", lm, y);
      doc.setTextColor(30);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(treatmentPlan, pw);
      doc.text(lines, lm, y); y += lines.length * 4.5 + 5;
    }

    // Medications
    if (medications.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(16);
      doc.setFont("helvetica", "bolditalic");
      doc.setTextColor(126, 200, 227);
      doc.text("℞", lm, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("MEDICATIONS", lm + 12, y);
      doc.setTextColor(30);
      y += 7;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      medications.forEach((med, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. ${med.name}`, lm, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`${med.dosage}  ·  ${med.frequency}  ·  ${med.duration}`, lm + 60, y);
        doc.setTextColor(30);
        y += 5;
      });
      y += 5;
    }

    // Footer
    if (y > 260) { doc.addPage(); y = 20; }
    y += 12;
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated ${new Date().toLocaleString()}`, lm, y);
    doc.setTextColor(30);
    doc.line(lm + 120, y - 2, lm + pw, y - 2);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Doctor's Signature", lm + 130, y + 4);

    doc.save(`Rx_${patient?.full_name}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF downloaded");
  };

  const handleShare = async () => {
    const text = `Prescription for ${patient?.full_name}\nDate: ${new Date().toLocaleDateString()}\n\nChief Complaint: ${chiefComplaint}\n\nMedications:\n${medications.map((m, i) => `${i + 1}. ${m.name} - ${m.dosage} - ${m.frequency} - ${m.duration}`).join("\n")}\n\nTreatment Plan: ${treatmentPlan}`;
    if (navigator.share) {
      await navigator.share({ title: "Dental Prescription", text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <Card className="shadow-elevated border-0 overflow-hidden">
      {/* Premium header bar */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold italic text-primary">℞</span>
          <span className="font-heading text-base font-semibold">Prescription</span>
          {status === "confirmed" && (
            <Badge className="bg-success/10 text-success border-0 text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-1" />Confirmed
            </Badge>
          )}
        </div>
        <div className="flex gap-1.5">
          {status === "draft" && (
            <Button size="sm" onClick={onConfirm} disabled={isConfirming} className="gap-1 shadow-sm">
              <CheckCircle2 className="h-3 w-3" />{isConfirming ? "Confirming..." : "Confirm"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handlePrint} className="shadow-sm"><Printer className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="shadow-sm"><Download className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={handleShare} className="shadow-sm"><Share2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <CardContent className="p-6">
        <div ref={printRef} className="rx-card">
          {/* Clinic + Patient Header */}
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 16, borderBottom: "3px solid hsl(197, 71%, 73%)" }}>
            <div>
              <div className="clinic-name" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px" }}>{clinic?.name || "Dental Clinic"}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{clinic?.address}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{clinic?.phone}{clinic?.email ? ` · ${clinic.email}` : ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748b" }}>Date: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{patient?.full_name}</div>
              {patient?.phone && <div style={{ fontSize: 11, color: "#64748b" }}>Ph: {patient.phone}</div>}
              {(patient as any)?.op_number && <div style={{ fontSize: 10, color: "#94a3b8" }}>{(patient as any).op_number}</div>}
              <div style={{ fontSize: 10, color: "#94a3b8" }}>
                {[
                  patient?.date_of_birth ? `${Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))}y` : null,
                  patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null,
                ].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>

          {/* Chief Complaint */}
          {chiefComplaint && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "hsl(197, 71%, 63%)", marginBottom: 6 }}>Chief Complaint</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#334155" }}>{chiefComplaint}</div>
            </div>
          )}

          {/* Clinical tags */}
          {(gumCondition !== "normal" || alignmentCondition !== "normal") && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {gumCondition && gumCondition !== "normal" && (
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd" }}>Gum: {gumCondition}</span>
              )}
              {alignmentCondition && alignmentCondition !== "normal" && (
                <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd" }}>Alignment: {alignmentCondition}</span>
              )}
            </div>
          )}
          {diagnosisNotes && <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>{diagnosisNotes}</div>}

          {/* Findings */}
          {items.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "hsl(197, 71%, 63%)", marginBottom: 8 }}>Dental Findings</div>
              <table style={{ width: "100%", borderCollapse: "collapse", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ background: "#f8fafc", padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Tooth</th>
                    <th style={{ background: "#f8fafc", padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Condition</th>
                    <th style={{ background: "#f8fafc", padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Treatment</th>
                    <th style={{ background: "#f8fafc", padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                    <th style={{ background: "#f8fafc", padding: "8px 12px", textAlign: "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontWeight: 600 }}>{item.tooth_number}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{item.condition || "—"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{item.treatment || "—"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>{item.treatment_status?.replace("_", " ") || "—"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 600 }}>{Number(item.cost) > 0 ? `Rs ${Number(item.cost).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                  {items.some((i: any) => Number(i.cost) > 0) && (
                    <tr style={{ background: "#f8fafc" }}>
                      <td colSpan={4} style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right" }}>Total</td>
                      <td style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right", color: "#0284c7" }}>Rs {items.reduce((s: number, i: any) => s + (Number(i.cost) || 0), 0).toLocaleString()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Treatment Plan */}
          {treatmentPlan && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "hsl(197, 71%, 63%)", marginBottom: 6 }}>Treatment Plan</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "#334155" }}>{treatmentPlan}</div>
            </div>
          )}

          {/* Medications */}
          {medications.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: "hsl(197, 71%, 63%)", fontStyle: "italic" }}>℞</span>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "hsl(197, 71%, 63%)" }}>Medications</span>
              </div>
              {medications.map((med, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0", borderBottom: idx < medications.length - 1 ? "1px solid #f1f5f9" : "none", fontSize: 12 }}>
                  <span style={{ color: "#94a3b8", width: 16 }}>{idx + 1}.</span>
                  <span style={{ fontWeight: 600, minWidth: 140 }}>{med.name}</span>
                  <span style={{ color: "#64748b" }}>{med.dosage} · {med.frequency} · {med.duration}</span>
                </div>
              ))}
            </div>
          )}

          {/* Signature */}
          <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 9, color: "#94a3b8" }}>Generated on {new Date().toLocaleString()}</div>
            <div style={{ borderTop: "1px solid #1a1f2e", paddingTop: 6, textAlign: "center", width: 180, fontSize: 11, color: "#64748b" }}>Doctor's Signature</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
