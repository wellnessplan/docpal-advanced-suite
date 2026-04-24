// Centralized PDF template registry for Prescription & Invoice PDFs.
// Each template defines a visual identity (colors, header style, accents).

export type TemplateId = "classic" | "modern" | "minimal" | "elegant" | "vibrant" | "plain";

export interface PdfTemplate {
  id: TemplateId;
  name: string;
  description: string;
  // Primary brand color [r,g,b]
  primary: [number, number, number];
  // Secondary / accent
  accent: [number, number, number];
  // Header style: solid bar, gradient-like double bar, side bar, minimal line, watermark
  headerStyle: "solidBar" | "doubleBar" | "sideBar" | "thinLine" | "panel";
  // Section title style
  sectionStyle: "underline" | "filled" | "leftBar" | "plain" | "boxed";
  // Table header style
  tableHeader: "filled" | "outlined" | "minimal";
  // Font family used (jsPDF built-in)
  font: "helvetica" | "times" | "courier";
}

export const PDF_TEMPLATES: Record<TemplateId, PdfTemplate> = {
  classic: {
    id: "classic",
    name: "Classic Navy",
    description: "Traditional clinical look with navy header bar",
    primary: [20, 60, 110],
    accent: [220, 230, 245],
    headerStyle: "solidBar",
    sectionStyle: "underline",
    tableHeader: "filled",
    font: "helvetica",
  },
  modern: {
    id: "modern",
    name: "Modern Sky",
    description: "Clean modern design with sky blue accents",
    primary: [14, 165, 200],
    accent: [224, 247, 250],
    headerStyle: "sideBar",
    sectionStyle: "leftBar",
    tableHeader: "outlined",
    font: "helvetica",
  },
  minimal: {
    id: "minimal",
    name: "Minimal Mono",
    description: "Pure typography, no color blocks",
    primary: [40, 40, 40],
    accent: [240, 240, 240],
    headerStyle: "thinLine",
    sectionStyle: "plain",
    tableHeader: "minimal",
    font: "helvetica",
  },
  elegant: {
    id: "elegant",
    name: "Elegant Serif",
    description: "Times serif with subtle emerald accents",
    primary: [22, 101, 78],
    accent: [225, 245, 235],
    headerStyle: "doubleBar",
    sectionStyle: "underline",
    tableHeader: "outlined",
    font: "times",
  },
  vibrant: {
    id: "vibrant",
    name: "Vibrant Coral",
    description: "Warm coral & charcoal with panel header",
    primary: [220, 80, 90],
    accent: [255, 235, 235],
    headerStyle: "panel",
    sectionStyle: "boxed",
    tableHeader: "filled",
    font: "helvetica",
  },
  plain: {
    id: "plain",
    name: "Plain B&W",
    description: "No header or body color — pure black & white text only",
    primary: [0, 0, 0],
    accent: [255, 255, 255],
    headerStyle: "thinLine",
    sectionStyle: "plain",
    tableHeader: "minimal",
    font: "helvetica",
  },
};

export const TEMPLATE_LIST = Object.values(PDF_TEMPLATES);

const RX_KEY = "doctorsbuddy.template.prescription";
const INV_KEY = "doctorsbuddy.template.invoice";

// Clinic-wide defaults (set by admin in Settings) — cached in memory after first load.
// Falls back to local user preference, then to "classic".
let _clinicRxDefault: TemplateId | null = null;
let _clinicInvDefault: TemplateId | null = null;

export function setClinicDefaults(rx?: TemplateId | null, inv?: TemplateId | null) {
  if (rx && PDF_TEMPLATES[rx]) _clinicRxDefault = rx;
  if (inv && PDF_TEMPLATES[inv]) _clinicInvDefault = inv;
}

export function getRxTemplate(): TemplateId {
  if (typeof window === "undefined") return "classic";
  const v = localStorage.getItem(RX_KEY) as TemplateId | null;
  if (v && PDF_TEMPLATES[v]) return v;
  return _clinicRxDefault ?? "classic";
}
export function setRxTemplate(id: TemplateId) {
  localStorage.setItem(RX_KEY, id);
}
export function getInvoiceTemplate(): TemplateId {
  if (typeof window === "undefined") return "classic";
  const v = localStorage.getItem(INV_KEY) as TemplateId | null;
  if (v && PDF_TEMPLATES[v]) return v;
  return _clinicInvDefault ?? "classic";
}
export function setInvoiceTemplate(id: TemplateId) {
  localStorage.setItem(INV_KEY, id);
}

// ===== Helpers used by both PDF builders =====
import type jsPDF from "jspdf";

/**
 * Draws the header for a prescription / invoice based on the chosen template.
 * Returns the y-position where content should begin.
 */
export function drawTemplateHeader(
  doc: jsPDF,
  tpl: PdfTemplate,
  opts: {
    pageWidth: number;
    leftMargin: number;
    rightMargin: number;
    title: string; // e.g. "PRESCRIPTION" or "RECEIPT"
    clinicName: string;
    clinicAddress?: string;
    clinicPhone?: string;
    clinicEmail?: string;
    logoBase64?: string | null;
    documentMeta?: { label: string; value: string }[]; // e.g. [{label:"Receipt #", value:"INV-001"}]
    compact?: boolean; // for small paper sizes
  }
): number {
  const { pageWidth: pw, leftMargin: lm, rightMargin: rm, title, clinicName,
    clinicAddress, clinicPhone, clinicEmail, logoBase64, documentMeta = [], compact } = opts;
  const headerH = compact ? 26 : 36;
  const [pr, pg, pb] = tpl.primary;
  const [ar, ag, ab] = tpl.accent;

  doc.setFont(tpl.font, "normal");

  // ─── Background per style ───
  if (tpl.headerStyle === "solidBar") {
    doc.setFillColor(pr, pg, pb);
    doc.rect(0, 0, pw, headerH, "F");
  } else if (tpl.headerStyle === "doubleBar") {
    doc.setFillColor(pr, pg, pb);
    doc.rect(0, 0, pw, headerH - 4, "F");
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, headerH - 4, pw, 4, "F");
  } else if (tpl.headerStyle === "sideBar") {
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, pw, headerH, "F");
    doc.setFillColor(pr, pg, pb);
    doc.rect(0, 0, 4, headerH, "F");
  } else if (tpl.headerStyle === "panel") {
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, pw, headerH, "F");
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.8);
    doc.line(0, headerH, pw, headerH);
  } else {
    // thinLine - no fill
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.6);
    doc.line(lm, headerH - 2, rm, headerH - 2);
  }

  // ─── Logo ───
  let textX = lm;
  if (logoBase64) {
    try {
      const sz = compact ? 12 : 16;
      doc.addImage(logoBase64, "PNG", lm, 5, sz, sz);
      textX = lm + sz + 3;
    } catch { /* skip */ }
  }

  // ─── Clinic name ───
  const onDark = tpl.headerStyle === "solidBar" || tpl.headerStyle === "doubleBar";
  if (onDark) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(pr, pg, pb);

  doc.setFontSize(compact ? 12 : 16);
  doc.setFont(tpl.font, "bold");
  doc.text(clinicName, textX, compact ? 11 : 13);

  // Contact line
  doc.setFontSize(compact ? 6.5 : 8);
  doc.setFont(tpl.font, "normal");
  if (onDark) doc.setTextColor(220, 230, 245);
  else doc.setTextColor(110, 110, 110);

  let ly = compact ? 15 : 18;
  if (clinicAddress) {
    doc.text(clinicAddress, textX, ly);
    ly += compact ? 3 : 4;
  }
  const contact = [clinicPhone && `Tel: ${clinicPhone}`, clinicEmail && clinicEmail].filter(Boolean).join("  |  ");
  if (contact) doc.text(contact, textX, ly);

  // ─── Document title (right aligned) ───
  if (onDark) doc.setTextColor(255, 255, 255);
  else doc.setTextColor(pr, pg, pb);
  doc.setFontSize(compact ? 11 : 14);
  doc.setFont(tpl.font, "bold");
  doc.text(title, rm, compact ? 11 : 13, { align: "right" });

  // Document meta
  if (onDark) doc.setTextColor(220, 230, 245);
  else doc.setTextColor(100, 100, 100);
  doc.setFontSize(compact ? 6.5 : 8);
  doc.setFont(tpl.font, "normal");
  let metaY = compact ? 16 : 19;
  documentMeta.forEach(m => {
    doc.text(`${m.label}: ${m.value}`, rm, metaY, { align: "right" });
    metaY += compact ? 3 : 4;
  });

  doc.setTextColor(30, 30, 30);
  return headerH + (compact ? 4 : 6);
}

/**
 * Draws a section title in the template's chosen style. Returns new y.
 */
export function drawSectionTitle(
  doc: jsPDF,
  tpl: PdfTemplate,
  text: string,
  y: number,
  opts: { lm: number; rm: number; compact?: boolean }
): number {
  const { lm, rm, compact } = opts;
  const [pr, pg, pb] = tpl.primary;
  const [ar, ag, ab] = tpl.accent;
  const fs = compact ? 8 : 10;
  doc.setFont(tpl.font, "bold");
  doc.setFontSize(fs);

  if (tpl.sectionStyle === "filled") {
    doc.setFillColor(pr, pg, pb);
    doc.rect(lm, y - 4, rm - lm, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(text, lm + 2, y);
    doc.setTextColor(30);
    return y + 5;
  }
  if (tpl.sectionStyle === "leftBar") {
    doc.setFillColor(pr, pg, pb);
    doc.rect(lm, y - 4, 1.5, 6, "F");
    doc.setTextColor(pr, pg, pb);
    doc.text(text, lm + 4, y);
    doc.setTextColor(30);
    return y + 4;
  }
  if (tpl.sectionStyle === "boxed") {
    doc.setFillColor(ar, ag, ab);
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.3);
    doc.roundedRect(lm, y - 4, rm - lm, 6, 1, 1, "FD");
    doc.setTextColor(pr, pg, pb);
    doc.text(text, lm + 2, y);
    doc.setTextColor(30);
    return y + 5;
  }
  if (tpl.sectionStyle === "underline") {
    doc.setTextColor(pr, pg, pb);
    doc.text(text, lm, y);
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.4);
    const w = doc.getTextWidth(text);
    doc.line(lm, y + 1, lm + w, y + 1);
    doc.setTextColor(30);
    return y + 4;
  }
  // plain
  doc.setTextColor(60);
  doc.text(text, lm, y);
  doc.setTextColor(30);
  return y + 4;
}

/**
 * Draws a table header row according to the template style. Returns y after header.
 */
export function drawTableHeader(
  doc: jsPDF,
  tpl: PdfTemplate,
  headers: string[],
  colX: number[],
  y: number,
  opts: { lm: number; rm: number; rowH?: number; compact?: boolean }
): number {
  const { lm, rm, compact } = opts;
  const rowH = opts.rowH ?? (compact ? 5 : 6);
  const [pr, pg, pb] = tpl.primary;
  doc.setFont(tpl.font, "bold");
  doc.setFontSize(compact ? 7 : 8);

  if (tpl.tableHeader === "filled") {
    doc.setFillColor(pr, pg, pb);
    doc.rect(lm, y - rowH + 1, rm - lm, rowH, "F");
    doc.setTextColor(255, 255, 255);
  } else if (tpl.tableHeader === "outlined") {
    doc.setDrawColor(pr, pg, pb);
    doc.setLineWidth(0.3);
    doc.rect(lm, y - rowH + 1, rm - lm, rowH, "S");
    doc.setTextColor(pr, pg, pb);
  } else {
    // minimal: just bottom line
    doc.setDrawColor(120);
    doc.setLineWidth(0.2);
    doc.line(lm, y + 1, rm, y + 1);
    doc.setTextColor(50);
  }
  headers.forEach((h, i) => doc.text(h, colX[i] + 1.5, y));
  doc.setTextColor(30);
  return y + (compact ? 4 : 5);
}
