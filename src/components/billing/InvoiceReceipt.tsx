import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface InvoiceReceiptProps {
  invoice: any;
  clinic: any;
  patient: any;
  items?: any[];
  payments?: any[];
}

export default function InvoiceReceipt({ invoice, clinic, patient, items = [], payments = [] }: InvoiceReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const subtotal = Number(invoice.subtotal || invoice.amount);
  const discountAmt = Number(invoice.discount || invoice.discount_amount || 0);
  const discountPct = Number(invoice.discount_percent || 0);
  const discountTotal = discountAmt + (subtotal * discountPct / 100);
  const taxRate = Number(invoice.tax_rate || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const totalAmount = Number(invoice.amount || invoice.total);
  const paidAmount = Number(invoice.paid_amount || 0);
  const balance = totalAmount - paidAmount;
  const receiptNo = (invoice.invoice_number || invoice.id.slice(0, 8)).toUpperCase();
  const isPaid = balance <= 0;

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Receipt #${receiptNo}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;font-size:12px;color:#1a1a1a;max-width:800px;margin:0 auto}
        h1{font-size:20px;margin:0}h2{font-size:14px;margin:16px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:11px}
        th{background:#f5f5f5;font-weight:600}
        .amount-box{border-radius:8px;padding:12px;text-align:center;margin:16px 0}
        @media print{body{padding:12px}}
      </style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = doc.internal.pageSize.getWidth();
    let y = 15;
    const lm = 15;
    const rm = w - 15;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(clinic?.name || "Dental Clinic", lm, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    if (clinic?.address) { doc.text(clinic.address, lm, y); y += 4; }
    const contactLine = [clinic?.phone, clinic?.email].filter(Boolean).join(" · ");
    if (contactLine) { doc.text(contactLine, lm, y); y += 4; }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50);
    doc.text("RECEIPT", rm, 15, { align: "right" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Receipt #: ${receiptNo}`, rm, 22, { align: "right" });
    doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString("en-IN")}`, rm, 27, { align: "right" });

    y = Math.max(y, 35);
    doc.setDrawColor(50);
    doc.setLineWidth(0.5);
    doc.line(lm, y, rm, y);
    y += 8;

    // Patient box
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(lm, y - 2, rm - lm, 18, 2, 2, "F");
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("Patient:", lm + 4, y + 4);
    doc.setFont("helvetica", "normal");
    doc.text(patient?.full_name || "—", lm + 24, y + 4);
    if (patient?.phone) doc.text(`Phone: ${patient.phone}`, lm + 4, y + 10);
    y += 22;

    // PAID watermark
    if (isPaid) {
      doc.setFontSize(48);
      doc.setTextColor(34, 197, 94);
      doc.saveGraphicsState();
      // @ts-ignore
      doc.setGState(new doc.GState({ opacity: 0.12 }));
      doc.text("PAID", w / 2, y + 40, { align: "center", angle: -15 });
      doc.restoreGraphicsState();
    }

    // Items table
    doc.setTextColor(30);
    if (items.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Treatment Details", lm, y);
      y += 6;

      const cols = [lm, lm + 90, lm + 110, lm + 140];
      doc.setFillColor(240, 240, 240);
      doc.rect(lm, y - 1, rm - lm, 7, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Description", cols[0] + 2, y + 4);
      doc.text("Qty", cols[1] + 2, y + 4);
      doc.text("Unit Price", cols[2] + 2, y + 4);
      doc.text("Amount", cols[3] + 2, y + 4);
      y += 8;

      doc.setFont("helvetica", "normal");
      items.forEach((item: any) => {
        const lineTotal = (item.quantity || 1) * Number(item.unit_price);
        doc.text(String(item.description).substring(0, 50), cols[0] + 2, y + 4);
        doc.text(String(item.quantity || 1), cols[1] + 2, y + 4);
        doc.text(`₹${Number(item.unit_price).toLocaleString()}`, cols[2] + 2, y + 4);
        doc.text(`₹${lineTotal.toLocaleString()}`, cols[3] + 2, y + 4);
        doc.setDrawColor(220);
        doc.line(lm, y + 6, rm, y + 6);
        y += 8;
      });
      y += 4;
    }

    // Summary
    const summaryX = w / 2 + 5;
    const valX = rm - 2;
    doc.setDrawColor(200);
    doc.line(w / 2, y, rm, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal", summaryX, y);
    doc.text(`₹${subtotal.toLocaleString("en-IN")}`, valX, y, { align: "right" });
    y += 6;

    if (discountTotal > 0) {
      doc.setTextColor(22, 163, 74);
      doc.text(`Discount${discountPct > 0 ? ` (${discountPct}%)` : ""}`, summaryX, y);
      doc.text(`-₹${discountTotal.toLocaleString("en-IN")}`, valX, y, { align: "right" });
      y += 6;
      doc.setTextColor(30);
    }

    if (taxRate > 0) {
      doc.text(`Tax (${taxRate}%)`, summaryX, y);
      doc.text(`₹${taxAmount.toLocaleString("en-IN")}`, valX, y, { align: "right" });
      y += 6;
    }

    doc.setDrawColor(50);
    doc.setLineWidth(0.5);
    doc.line(w / 2, y, rm, y);
    y += 6;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total", summaryX, y);
    doc.text(`₹${totalAmount.toLocaleString("en-IN")}`, valX, y, { align: "right" });
    y += 8;

    // Paid & Balance
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(22, 163, 74);
    doc.text("Paid", summaryX, y);
    doc.text(`₹${paidAmount.toLocaleString("en-IN")}`, valX, y, { align: "right" });
    y += 6;

    if (balance > 0) {
      doc.setTextColor(220, 38, 38);
      doc.setFont("helvetica", "bold");
      doc.text("Balance Due", summaryX, y);
      doc.text(`₹${balance.toLocaleString("en-IN")}`, valX, y, { align: "right" });
      y += 6;
    }
    doc.setTextColor(30);

    // Payment history
    if (payments.length > 0) {
      y += 4;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Payment History", lm, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      payments.forEach((p: any) => {
        doc.text(
          `${new Date(p.payment_date).toLocaleDateString("en-IN")} — ₹${Number(p.amount).toLocaleString()} (${(p.payment_method || "cash").toUpperCase()})`,
          lm + 2, y
        );
        y += 4;
      });
    }

    // Notes
    if (invoice.notes) {
      y += 4;
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Notes: ${invoice.notes}`, lm, y);
      y += 6;
    }

    // Footer
    y = Math.max(y + 10, 260);
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, lm, y);
    doc.text("This is a computer-generated receipt.", lm, y + 4);
    doc.setDrawColor(60);
    doc.setLineWidth(0.3);
    doc.line(rm - 50, y, rm, y);
    doc.setTextColor(80);
    doc.text("Authorized Signature", rm - 25, y + 4, { align: "center" });

    doc.save(`Receipt_${patient?.full_name?.replace(/\s/g, "_") || "Patient"}_${receiptNo}.pdf`);
    toast.success("PDF receipt downloaded!");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1">
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button size="sm" onClick={handleDownloadPDF} className="gap-1">
          <FileDown className="h-3.5 w-3.5" /> Download PDF
        </Button>
      </div>

      <div ref={printRef} style={{ position: "relative" }}>
        {isPaid && (
          <div style={{ color: "#22c55e", fontSize: 48, fontWeight: "bold", transform: "rotate(-12deg)", opacity: 0.15, position: "absolute", top: "30%", right: "5%", pointerEvents: "none" }}>
            PAID
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #333", paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0 }}>{clinic?.name || "Dental Clinic"}</h1>
            {clinic?.address && <p style={{ fontSize: 11, color: "#666", margin: "2px 0" }}>{clinic.address}</p>}
            <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
              {[clinic?.phone, clinic?.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#333", borderBottom: "none" }}>RECEIPT</h2>
            <p style={{ fontSize: 11, margin: "4px 0" }}><strong>Receipt #:</strong> {receiptNo}</p>
            <p style={{ fontSize: 11, margin: 0 }}><strong>Date:</strong> {new Date(invoice.created_at).toLocaleDateString("en-IN")}</p>
          </div>
        </div>

        {/* Patient Info */}
        <div style={{ background: "#f9fafb", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 12 }}>
          <p style={{ margin: 0 }}><strong>Patient:</strong> {patient?.full_name}</p>
          {patient?.phone && <p style={{ margin: "2px 0" }}><strong>Phone:</strong> {patient.phone}</p>}
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <>
            <h2 style={{ fontSize: 13, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>Treatment Details</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ border: "1px solid #ddd", padding: "5px 8px" }}>Description</th>
                  <th style={{ border: "1px solid #ddd", padding: "5px 8px", textAlign: "center" }}>Qty</th>
                  <th style={{ border: "1px solid #ddd", padding: "5px 8px", textAlign: "right" }}>Unit Price</th>
                  <th style={{ border: "1px solid #ddd", padding: "5px 8px", textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ border: "1px solid #ddd", padding: "5px 8px" }}>{item.description}</td>
                    <td style={{ border: "1px solid #ddd", padding: "5px 8px", textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ border: "1px solid #ddd", padding: "5px 8px", textAlign: "right" }}>₹{Number(item.unit_price).toLocaleString()}</td>
                    <td style={{ border: "1px solid #ddd", padding: "5px 8px", textAlign: "right" }}>₹{((item.quantity || 1) * Number(item.unit_price)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Summary */}
        <div style={{ marginTop: 16, borderTop: "1px solid #ddd", paddingTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
            <span>Subtotal</span><span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString("en-IN")}</span>
          </div>
          {discountTotal > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "#16a34a" }}>
              <span>Discount{discountPct > 0 ? ` (${discountPct}%)` : ""}</span><span>-₹{discountTotal.toLocaleString("en-IN")}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
              <span>Tax ({taxRate}%)</span><span>₹{taxAmount.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: "bold", padding: "8px 0", borderTop: "2px solid #333" }}>
            <span>Total</span><span>₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", color: "#16a34a" }}>
            <span>Paid</span><span style={{ fontWeight: 600 }}>₹{paidAmount.toLocaleString("en-IN")}</span>
          </div>
          {balance > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: "bold", padding: "4px 0", color: "#dc2626" }}>
              <span>Balance Due</span><span>₹{balance.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>

        {/* Payment History */}
        {payments.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <h2 style={{ fontSize: 12, borderBottom: "1px solid #ccc", paddingBottom: 4 }}>Payment History</h2>
            {payments.map((p: any, i: number) => (
              <div key={i} style={{ fontSize: 11, padding: "3px 0", display: "flex", justifyContent: "space-between" }}>
                <span>{new Date(p.payment_date).toLocaleDateString("en-IN")} — {(p.payment_method || "cash").toUpperCase()}</span>
                <span style={{ fontWeight: 600, color: "#16a34a" }}>₹{Number(p.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {invoice.notes && (
          <div style={{ marginTop: 12, fontSize: 11, color: "#666" }}>
            <strong>Notes:</strong> {invoice.notes}
          </div>
        )}

        <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 10, color: "#999" }}>
            <p style={{ margin: 0 }}>Generated on {new Date().toLocaleString("en-IN")}</p>
            <p style={{ margin: 0 }}>This is a computer-generated receipt.</p>
          </div>
          <div style={{ borderTop: "1px solid #333", paddingTop: 4, textAlign: "center", width: 180, fontSize: 11 }}>
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
}
