import jsPDF from "jspdf";
import QRCode from "qrcode";

// Formats a number with a regular space as the thousands separator and a comma
// for decimals. We avoid `toLocaleString()` because it emits narrow no-break
// space characters that jsPDF's default font cannot render, producing garbled
// output like "1 / 439 / 725".
function formatNumber(value: number, decimals = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const fixed = safe.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const sign = intPart.startsWith("-") ? "-" : "";
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart ? `${sign}${grouped},${decPart}` : `${sign}${grouped}`;
}

interface PDFOptions {
  title: string;
  filename: string;
  orientation?: "portrait" | "landscape";
}

interface POData {
  reference: string;
  counterpartyName: string;
  status: string;
  estimatedWeight: number;
  purityFactor: number;
  totalValue: number;
  currency: string;
  incoterms?: string;
  deliveryVault?: string;
  createdAt: string;
}

interface DispatchData {
  dispatchId: string;
  poReference: string;
  trackingId: string;
  counterpartyName: string;
  carrier: string;
  pickupDate: string;
  estimatedWeight: number;
  originCountry: string;
  destinationVault: string;
  status: string;
  qrCodeData?: string; // Optional base64 encoded QR code image
}

// Draws the purchase order document and returns the jsPDF instance. Shared by
// the client-side download helper and the server-side email attachment builder.
function renderPurchaseOrderPDF(data: POData, options: PDFOptions): jsPDF {
  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 20);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Gold Acquisition & Compliance", 20, 30);
  
  // Document Title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, 20, 55);
  
  // Reference Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(20, 65, pageWidth - 40, 25, 3, 3, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Référence / Reference", 25, 75);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.reference, 25, 85);
  
  // Status Badge
  const statusColors: Record<string, [number, number, number]> = {
    draft: [100, 116, 139],
    pending_approval: [234, 179, 8],
    approved: [34, 197, 94],
    in_transit: [59, 130, 246],
    delivered: [34, 197, 94],
    completed: [34, 197, 94],
    rejected: [239, 68, 68],
  };
  
  const statusColor = statusColors[data.status] || [100, 116, 139];
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - 60, 70, 40, 15, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.status.toUpperCase().replace("_", " "), pageWidth - 55, 80);
  
  // Content Section
  let yPos = 105;
  
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Détails de la Contrepartie / Counterparty Details", 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Nom / Name:", 20, yPos);
  doc.setTextColor(30, 41, 59);
  doc.text(data.counterpartyName, 70, yPos);
  
  yPos += 20;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Détails du Métal / Metal Details", 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const metalDetails = [
    ["Poids Estimé / Estimated Weight:", `${data.estimatedWeight.toFixed(2)} kg`],
    ["Facteur de Pureté / Purity Factor:", `${(data.purityFactor * 100).toFixed(1)}%`],
    ["Valeur Totale / Total Value:", `${data.currency} ${formatNumber(data.totalValue)}`],
    ["Incoterms:", data.incoterms || "N/A"],
    ["Coffre de Livraison / Delivery Vault:", data.deliveryVault || "N/A"],
  ];
  
  metalDetails.forEach(([label, value]) => {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 20, yPos);
    doc.setTextColor(30, 41, 59);
    doc.text(value, 100, yPos);
    yPos += 8;
  });
  
  yPos += 15;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Informations Temporelles / Timeline", 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Date de Création / Created:", 20, yPos);
  doc.setTextColor(30, 41, 59);
  doc.text(new Date(data.createdAt).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }), 100, yPos);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 20, footerY);
  doc.text("GAC Sourcing - Confidentiel", pageWidth - 60, footerY);

  return doc;
}

// Client-side: renders the PO and triggers a browser download.
export function generatePurchaseOrderPDF(data: POData, options: PDFOptions): void {
  const doc = renderPurchaseOrderPDF(data, options);
  doc.save(options.filename);
}

// Server-side: renders the PO and returns the raw bytes (e.g. to attach to an email).
export function buildPurchaseOrderPDFArrayBuffer(data: POData, options: PDFOptions): ArrayBuffer {
  const doc = renderPurchaseOrderPDF(data, options);
  return doc.output("arraybuffer");
}

export async function generateDispatchPDF(data: DispatchData, options: PDFOptions): Promise<void> {
  // Generate QR code if not provided
  let qrCodeImage = data.qrCodeData;
  if (!qrCodeImage) {
    try {
      qrCodeImage = await QRCode.toDataURL(data.trackingId, {
        errorCorrectionLevel: "H",
        type: "image/png",
        quality: 0.95,
        margin: 1,
        width: 200,
      });
    } catch (error) {
      console.error("Error generating QR code:", error);
    }
  }

  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 20);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Gold Acquisition & Compliance", 20, 30);
  
  // Document Title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, 20, 55);
  
  // Dispatch ID Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, 65, (pageWidth - 50) / 2, 25, 3, 3, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Dispatch ID", 25, 75);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.dispatchId, 25, 85);
  
  // Tracking ID Box
  doc.setFillColor(219, 234, 254); // blue-100
  doc.roundedRect((pageWidth + 10) / 2, 65, (pageWidth - 50) / 2, 25, 3, 3, "F");
  
  doc.setFontSize(10);
  doc.setTextColor(59, 130, 246);
  doc.text("Tracking ID", (pageWidth + 20) / 2, 75);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.setFont("helvetica", "bold");
  doc.text(data.trackingId, (pageWidth + 20) / 2, 85);
  
  // Content
  let yPos = 105;
  
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Référence Ordre d'Achat / Purchase Order Reference", 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Réf. PO:", 20, yPos);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.poReference, 70, yPos);
  
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Contrepartie:", 20, yPos);
  doc.setTextColor(30, 41, 59);
  doc.text(data.counterpartyName, 70, yPos);
  
  yPos += 15;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Détails de Transport / Transport Details", 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const transportDetails = [
    ["Transporteur / Carrier:", data.carrier],
    ["Date d'Enlèvement / Pickup Date:", data.pickupDate],
    ["Poids Estimé / Estimated Weight:", `${data.estimatedWeight} kg`],
    ["Pays d'Origine / Origin Country:", data.originCountry],
    ["Coffre Destination / Destination Vault:", data.destinationVault],
    ["Statut / Status:", data.status.toUpperCase()],
  ];
  
  transportDetails.forEach(([label, value]) => {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 20, yPos);
    doc.setTextColor(30, 41, 59);
    doc.text(value || "N/A", 100, yPos);
    yPos += 8;
  });
  
  // QR Code
  yPos += 15;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(20, yPos, 50, 50, 3, 3, "F");
  
  if (qrCodeImage) {
    // Add the generated QR code image
    doc.addImage(qrCodeImage, "PNG", 22, yPos + 2, 46, 46);
  } else {
    // Fallback text if QR code generation failed
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text("QR Code", 35, yPos + 30);
    doc.text(data.trackingId, 30, yPos + 40);
  }
  
  // QR Code label
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Code QR / QR Code", 75, yPos + 10);
  
  // Tracking ID below QR
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Tracking ID:", 75, yPos + 20);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.trackingId, 75, yPos + 27);
  
  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 20, footerY);
  doc.text("GAC Sourcing - Confidentiel", pageWidth - 60, footerY);
  
  // Save
  doc.save(options.filename);
}

interface AllocationCertificateData {
  settlementId: string;
  poReference: string;
  counterpartyName: string;
  counterpartyIban: string;
  counterpartySwift: string;
  counterpartyJurisdiction: string;
  netWeightKg: number;
  purity: number;
  pureAuWeightKg: number;
  pricePerOz: number;
  totalGrossValue: number;
  totalDeductions: number;
  netPayable: number;
  currency: string;
  reserveAccountId: string;
  auditHash: string;
  valuationDate: string;
}

export function generateAllocationCertificatePDF(data: AllocationCertificateData, options: PDFOptions): void {
  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header with gold accent
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 50, "F");
  
  // Gold accent bar
  doc.setFillColor(234, 179, 8);
  doc.rect(0, 50, pageWidth, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 20);
  
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(options.title || "Certificat d'Allocation", 20, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - 50, 20);
  doc.text(`ID: ${data.settlementId}`, pageWidth - 50, 28);
  
  // Certificate seal
  doc.setFillColor(16, 185, 129);
  doc.circle(pageWidth - 30, 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.text("CERTIFIED", pageWidth - 36, 41);
  
  let yPos = 65;
  
  // Settlement Reference Section
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, yPos, pageWidth - 40, 25, 3, 3, "F");
  
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text("SETTLEMENT REFERENCE", 25, yPos + 8);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.settlementId, 25, yPos + 18);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`PO Reference: ${data.poReference}`, pageWidth - 80, yPos + 15);
  
  yPos += 35;
  
  // Counterparty Section
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("COUNTERPARTY DETAILS", 20, yPos);
  
  yPos += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const counterpartyDetails = [
    ["Name:", data.counterpartyName],
    ["IBAN:", data.counterpartyIban],
    ["SWIFT:", data.counterpartySwift],
    ["Jurisdiction:", data.counterpartyJurisdiction],
  ];
  
  counterpartyDetails.forEach(([label, value]) => {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 25, yPos);
    doc.setTextColor(30, 41, 59);
    doc.text(value || "N/A", 70, yPos);
    yPos += 7;
  });
  
  yPos += 10;
  
  // Gold Allocation Section
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GOLD ALLOCATION", 20, yPos);
  
  yPos += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 10;
  
  // Gold details box
  doc.setFillColor(254, 249, 195);
  doc.roundedRect(20, yPos, pageWidth - 40, 35, 3, 3, "F");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  doc.setTextColor(100, 116, 139);
  doc.text("Net Weight:", 25, yPos + 10);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.netWeightKg.toFixed(3)} kg`, 70, yPos + 10);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Purity:", 25, yPos + 20);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.purity.toFixed(2)}%`, 70, yPos + 20);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Pure Au Weight:", 25, yPos + 30);
  doc.setTextColor(234, 179, 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${data.pureAuWeightKg.toFixed(3)} kg`, 70, yPos + 30);
  
  const troyOunces = data.pureAuWeightKg * 32.1507;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(`(${troyOunces.toFixed(2)} troy oz)`, 110, yPos + 30);
  
  yPos += 45;
  
  // Financial Summary Section
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("FINANCIAL SUMMARY", 20, yPos);
  
  yPos += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const financialDetails = [
  ["Price per Troy Oz:", `$${formatNumber(data.pricePerOz)}`],
  ["Gross Value:", `$${formatNumber(data.totalGrossValue)}`],
  ["Total Deductions:", `($${formatNumber(data.totalDeductions)})`],
  ];
  
  financialDetails.forEach(([label, value]) => {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 25, yPos);
    doc.setTextColor(30, 41, 59);
    doc.text(value, 100, yPos);
    yPos += 7;
  });
  
  // Net Payable highlight
  yPos += 5;
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(20, yPos, pageWidth - 40, 15, 3, 3, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("NET PAYABLE:", 25, yPos + 10);
  doc.setFontSize(14);
  doc.text(`${data.currency} ${formatNumber(data.netPayable)}`, 100, yPos + 10);
  
  yPos += 25;
  
  // Audit Trail Section
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("AUDIT TRAIL", 20, yPos);
  
  yPos += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);
  
  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  doc.setTextColor(100, 116, 139);
  doc.text("Reserve Account ID:", 25, yPos);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(data.reserveAccountId, 80, yPos);
  
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Valuation Date:", 25, yPos);
  doc.setTextColor(30, 41, 59);
  doc.text(data.valuationDate, 80, yPos);
  
  yPos += 8;
  doc.setTextColor(100, 116, 139);
  doc.text("Audit Hash:", 25, yPos);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(7);
  doc.text(data.auditHash, 80, yPos);
  
  // Footer with signatures
  const certFooterY = pageHeight - 35;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(20, certFooterY - 15, pageWidth - 20, certFooterY - 15);
  
  doc.setDrawColor(100, 116, 139);
  doc.line(25, certFooterY, 80, certFooterY);
  doc.line(pageWidth / 2 - 25, certFooterY, pageWidth / 2 + 30, certFooterY);
  doc.line(pageWidth - 80, certFooterY, pageWidth - 25, certFooterY);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Finance Officer", 35, certFooterY + 5);
  doc.text("Treasury Director", pageWidth / 2 - 15, certFooterY + 5);
  doc.text("Compliance", pageWidth - 65, certFooterY + 5);
  
  doc.setFontSize(7);
  doc.text(`Document généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 20, pageHeight - 10);
  doc.text("GAC Sourcing - Certificat d'Allocation - Document Officiel", pageWidth - 85, pageHeight - 10);
  
  doc.save(options.filename);
}

// =============================================================================
// REPORT GENERATION FUNCTIONS
// =============================================================================

interface ReportData {
  period: string;
  periodLabel: string;
  generatedAt: string;
  language: "en" | "fr";
}

interface AcquisitionSummaryData extends ReportData {
  totalPurchaseOrders: number;
  totalWeightKg: number;
  totalValue: number;
  currency: string;
  byStatus: { status: string; count: number; weight: number; value: number }[];
  byCounterparty: { name: string; count: number; weight: number; value: number }[];
}

export function generateAcquisitionSummaryReport(data: AcquisitionSummaryData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 18);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "Rapport - Résumé des Acquisitions" : "Report - Acquisition Summary", 20, 30);
  
  doc.setFontSize(9);
  doc.text(`${data.periodLabel} | ${data.generatedAt}`, pageWidth - 70, 25);
  
  let yPos = 55;
  
  // Summary Cards
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "RÉSUMÉ GLOBAL" : "GLOBAL SUMMARY", 20, yPos);
  
  yPos += 10;
  
  // Summary boxes
  const boxWidth = (pageWidth - 50) / 3;
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, yPos, boxWidth, 25, 2, 2, "F");
  doc.roundedRect(25 + boxWidth, yPos, boxWidth, 25, 2, 2, "F");
  doc.roundedRect(30 + boxWidth * 2, yPos, boxWidth, 25, 2, 2, "F");
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(data.language === "fr" ? "Total Ordres" : "Total Orders", 25, yPos + 8);
  doc.text(data.language === "fr" ? "Poids Total (kg)" : "Total Weight (kg)", 30 + boxWidth, yPos + 8);
  doc.text(data.language === "fr" ? "Valeur Totale" : "Total Value", 35 + boxWidth * 2, yPos + 8);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.totalPurchaseOrders.toString(), 25, yPos + 18);
  doc.text(formatNumber(data.totalWeightKg), 30 + boxWidth, yPos + 18);
  doc.text(`${data.currency} ${formatNumber(data.totalValue)}`, 35 + boxWidth * 2, yPos + 18);
  
  yPos += 40;
  
  // By Status Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "PAR STATUT" : "BY STATUS", 20, yPos);
  
  yPos += 8;
  
  // Table header
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("Status", 25, yPos + 5.5);
  doc.text(data.language === "fr" ? "Nombre" : "Count", 80, yPos + 5.5);
  doc.text(data.language === "fr" ? "Poids (kg)" : "Weight (kg)", 110, yPos + 5.5);
  doc.text(data.language === "fr" ? "Valeur" : "Value", 150, yPos + 5.5);
  
  yPos += 8;
  
  data.byStatus.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.status, 25, yPos + 5);
    doc.text(row.count.toString(), 80, yPos + 5);
  doc.text(formatNumber(row.weight), 110, yPos + 5);
  doc.text(`${data.currency} ${formatNumber(row.value)}`, 150, yPos + 5);
    yPos += 7;
  });
  
  yPos += 15;
  
  // By Counterparty Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "PAR CONTREPARTIE" : "BY COUNTERPARTY", 20, yPos);
  
  yPos += 8;
  
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(data.language === "fr" ? "Contrepartie" : "Counterparty", 25, yPos + 5.5);
  doc.text(data.language === "fr" ? "Nombre" : "Count", 100, yPos + 5.5);
  doc.text(data.language === "fr" ? "Poids (kg)" : "Weight (kg)", 125, yPos + 5.5);
  doc.text(data.language === "fr" ? "Valeur" : "Value", 160, yPos + 5.5);
  
  yPos += 8;
  
  data.byCounterparty.slice(0, 10).forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.name.substring(0, 35), 25, yPos + 5);
    doc.text(row.count.toString(), 100, yPos + 5);
  doc.text(formatNumber(row.weight), 125, yPos + 5);
  doc.text(`${data.currency} ${formatNumber(row.value)}`, 160, yPos + 5);
    yPos += 7;
  });
  
  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${data.generatedAt}`, 20, pageHeight - 12);
  doc.text("GAC Sourcing - Rapport Confidentiel", pageWidth - 60, pageHeight - 12);
  
  doc.save(`acquisition-summary-${data.period}.pdf`);
}

interface CounterpartyOverviewData extends ReportData {
  totalCounterparties: number;
  activeCounterparties: number;
  pendingOnboarding: number;
  byRiskTier: { tier: string; count: number; color: string }[];
  byCountry: { country: string; count: number }[];
  recentOnboarded: { name: string; country: string; status: string; date: string }[];
}

export function generateCounterpartyOverviewReport(data: CounterpartyOverviewData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 18);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "Rapport - Aperçu des Contreparties" : "Report - Counterparty Overview", 20, 30);
  
  doc.setFontSize(9);
  doc.text(`${data.periodLabel} | ${data.generatedAt}`, pageWidth - 70, 25);
  
  let yPos = 55;
  
  // Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "STATISTIQUES" : "STATISTICS", 20, yPos);
  
  yPos += 10;
  
  const boxWidth = (pageWidth - 50) / 3;
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, yPos, boxWidth, 25, 2, 2, "F");
  doc.roundedRect(25 + boxWidth, yPos, boxWidth, 25, 2, 2, "F");
  doc.roundedRect(30 + boxWidth * 2, yPos, boxWidth, 25, 2, 2, "F");
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(data.language === "fr" ? "Total" : "Total", 25, yPos + 8);
  doc.text(data.language === "fr" ? "Actives" : "Active", 30 + boxWidth, yPos + 8);
  doc.text(data.language === "fr" ? "En attente" : "Pending", 35 + boxWidth * 2, yPos + 8);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.totalCounterparties.toString(), 25, yPos + 18);
  doc.setTextColor(16, 185, 129);
  doc.text(data.activeCounterparties.toString(), 30 + boxWidth, yPos + 18);
  doc.setTextColor(245, 158, 11);
  doc.text(data.pendingOnboarding.toString(), 35 + boxWidth * 2, yPos + 18);
  
  yPos += 40;
  
  // Risk Tier Distribution
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "DISTRIBUTION PAR NIVEAU DE RISQUE" : "RISK TIER DISTRIBUTION", 20, yPos);
  
  yPos += 10;
  
  data.byRiskTier.forEach((tier) => {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, yPos, pageWidth - 40, 12, 2, 2, "F");
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(tier.tier, 25, yPos + 8);
    doc.setFont("helvetica", "bold");
    doc.text(tier.count.toString(), pageWidth - 35, yPos + 8);
    yPos += 15;
  });
  
  yPos += 10;
  
  // By Country
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "PAR PAYS" : "BY COUNTRY", 20, yPos);
  
  yPos += 8;
  
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(data.language === "fr" ? "Pays" : "Country", 25, yPos + 5.5);
  doc.text(data.language === "fr" ? "Nombre" : "Count", pageWidth - 50, yPos + 5.5);
  
  yPos += 8;
  
  data.byCountry.slice(0, 8).forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.country, 25, yPos + 5);
    doc.text(row.count.toString(), pageWidth - 50, yPos + 5);
    yPos += 7;
  });
  
  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${data.generatedAt}`, 20, pageHeight - 12);
  doc.text("GAC Sourcing - Rapport Confidentiel", pageWidth - 60, pageHeight - 12);
  
  doc.save(`counterparty-overview-${data.period}.pdf`);
}

interface GoldInventoryData extends ReportData {
  totalWeightKg: number;
  totalValue: number;
  currency: string;
  byVault: { vault: string; weightKg: number; value: number }[];
  byPurity: { purity: string; weightKg: number; percentage: number }[];
  bySource: { source: string; weightKg: number; value: number }[];
}

export function generateGoldInventoryReport(data: GoldInventoryData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 18);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "Rapport - Inventaire d'Or" : "Report - Gold Inventory", 20, 30);
  
  doc.setFontSize(9);
  doc.text(`${data.periodLabel} | ${data.generatedAt}`, pageWidth - 70, 25);
  
  let yPos = 55;
  
  // Total summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "INVENTAIRE TOTAL" : "TOTAL INVENTORY", 20, yPos);
  
  yPos += 10;
  
  doc.setFillColor(254, 249, 195);
  doc.roundedRect(20, yPos, pageWidth - 40, 30, 3, 3, "F");
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(`${formatNumber(data.totalWeightKg)} kg`, 30, yPos + 15);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.currency} ${formatNumber(data.totalValue)}`, 30, yPos + 25);
  
  yPos += 45;
  
  // By Vault
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "PAR COFFRE" : "BY VAULT", 20, yPos);
  
  yPos += 8;
  
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(data.language === "fr" ? "Coffre" : "Vault", 25, yPos + 5.5);
  doc.text(data.language === "fr" ? "Poids (kg)" : "Weight (kg)", 100, yPos + 5.5);
  doc.text(data.language === "fr" ? "Valeur" : "Value", 150, yPos + 5.5);
  
  yPos += 8;
  
  data.byVault.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.vault, 25, yPos + 5);
  doc.text(formatNumber(row.weightKg), 100, yPos + 5);
  doc.text(`${data.currency} ${formatNumber(row.value)}`, 150, yPos + 5);
    yPos += 7;
  });
  
  yPos += 15;
  
  // By Purity
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "PAR PURETÉ" : "BY PURITY", 20, yPos);
  
  yPos += 8;
  
  data.byPurity.forEach((row) => {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, yPos, pageWidth - 40, 10, 2, 2, "F");
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(row.purity, 25, yPos + 7);
    doc.text(`${formatNumber(row.weightKg)} kg`, 80, yPos + 7);
    doc.setFont("helvetica", "bold");
    doc.text(`${row.percentage.toFixed(1)}%`, pageWidth - 35, yPos + 7);
    yPos += 12;
  });
  
  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${data.generatedAt}`, 20, pageHeight - 12);
  doc.text("GAC Sourcing - Rapport Confidentiel", pageWidth - 60, pageHeight - 12);
  
  doc.save(`gold-inventory-${data.period}.pdf`);
}

interface SettlementReportData extends ReportData {
  totalSettlements: number;
  totalPaid: number;
  totalPending: number;
  currency: string;
  byStatus: { status: string; count: number; amount: number }[];
  recentSettlements: { id: string; counterparty: string; amount: number; status: string; date: string }[];
}

export function generateSettlementReport(data: SettlementReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(147, 51, 234);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 18);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "Rapport - Règlements" : "Report - Settlements", 20, 30);
  
  doc.setFontSize(9);
  doc.text(`${data.periodLabel} | ${data.generatedAt}`, pageWidth - 70, 25);
  
  let yPos = 55;
  
  // Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "RÉSUMÉ FINANCIER" : "FINANCIAL SUMMARY", 20, yPos);
  
  yPos += 10;
  
  const boxWidth = (pageWidth - 50) / 3;
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, yPos, boxWidth, 25, 2, 2, "F");
  doc.roundedRect(25 + boxWidth, yPos, boxWidth, 25, 2, 2, "F");
  doc.roundedRect(30 + boxWidth * 2, yPos, boxWidth, 25, 2, 2, "F");
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(data.language === "fr" ? "Total Règlements" : "Total Settlements", 25, yPos + 8);
  doc.text(data.language === "fr" ? "Montant Payé" : "Amount Paid", 30 + boxWidth, yPos + 8);
  doc.text(data.language === "fr" ? "En Attente" : "Pending", 35 + boxWidth * 2, yPos + 8);
  
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.totalSettlements.toString(), 25, yPos + 18);
  doc.setTextColor(16, 185, 129);
  doc.text(`${data.currency} ${formatNumber(data.totalPaid)}`, 30 + boxWidth, yPos + 18);
  doc.setTextColor(245, 158, 11);
  doc.text(`${data.currency} ${formatNumber(data.totalPending)}`, 35 + boxWidth * 2, yPos + 18);
  
  yPos += 40;
  
  // Recent Settlements
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "RÈGLEMENTS RÉCENTS" : "RECENT SETTLEMENTS", 20, yPos);
  
  yPos += 8;
  
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text("ID", 25, yPos + 5.5);
  doc.text(data.language === "fr" ? "Contrepartie" : "Counterparty", 55, yPos + 5.5);
  doc.text(data.language === "fr" ? "Montant" : "Amount", 115, yPos + 5.5);
  doc.text("Status", 155, yPos + 5.5);
  
  yPos += 8;
  
  data.recentSettlements.forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.id, 25, yPos + 5);
    doc.text(row.counterparty.substring(0, 25), 55, yPos + 5);
    doc.text(`${data.currency} ${formatNumber(row.amount)}`, 115, yPos + 5);
    doc.text(row.status, 155, yPos + 5);
    yPos += 7;
  });
  
  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${data.generatedAt}`, 20, pageHeight - 12);
  doc.text("GAC Sourcing - Rapport Confidentiel", pageWidth - 60, pageHeight - 12);
  
  doc.save(`settlement-report-${data.period}.pdf`);
}

interface ComplianceAuditData extends ReportData {
  totalScreenings: number;
  sanctionsHits: number;
  pepHits: number;
  clearedCounterparties: number;
  pendingReview: number;
  screeningResults: { counterparty: string; sanctions: string; pep: string; status: string }[];
}

export function generateComplianceAuditReport(data: ComplianceAuditData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(239, 68, 68);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 18);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "Rapport - Audit de Conformité" : "Report - Compliance Audit", 20, 30);
  
  doc.setFontSize(9);
  doc.text(`${data.periodLabel} | ${data.generatedAt}`, pageWidth - 70, 25);
  
  let yPos = 55;
  
  // Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "RÉSUMÉ DE CONFORMITÉ" : "COMPLIANCE SUMMARY", 20, yPos);
  
  yPos += 10;
  
  // Stats grid
  const stats = [
    { label: data.language === "fr" ? "Total Screenings" : "Total Screenings", value: data.totalScreenings.toString(), color: [30, 41, 59] },
    { label: data.language === "fr" ? "Hits Sanctions" : "Sanctions Hits", value: data.sanctionsHits.toString(), color: [239, 68, 68] },
    { label: data.language === "fr" ? "Hits PEP" : "PEP Hits", value: data.pepHits.toString(), color: [245, 158, 11] },
    { label: data.language === "fr" ? "Validés" : "Cleared", value: data.clearedCounterparties.toString(), color: [16, 185, 129] },
  ];
  
  const statWidth = (pageWidth - 50) / 4;
  stats.forEach((stat, i) => {
    const x = 20 + i * (statWidth + 3);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, yPos, statWidth, 22, 2, 2, "F");
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.label, x + 5, yPos + 8);
    
    doc.setFontSize(14);
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.setFont("helvetica", "bold");
    doc.text(stat.value, x + 5, yPos + 18);
  });
  
  yPos += 35;
  
  // Screening Results
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "RÉSULTATS DE SCREENING" : "SCREENING RESULTS", 20, yPos);
  
  yPos += 8;
  
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(data.language === "fr" ? "Contrepartie" : "Counterparty", 25, yPos + 5.5);
  doc.text("Sanctions", 90, yPos + 5.5);
  doc.text("PEP", 125, yPos + 5.5);
  doc.text("Status", 155, yPos + 5.5);
  
  yPos += 8;
  
  data.screeningResults.slice(0, 12).forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.counterparty.substring(0, 28), 25, yPos + 5);
    doc.setTextColor(row.sanctions === "Clear" ? 16 : 239, row.sanctions === "Clear" ? 185 : 68, row.sanctions === "Clear" ? 129 : 68);
    doc.text(row.sanctions, 90, yPos + 5);
    doc.setTextColor(row.pep === "Clear" ? 16 : 245, row.pep === "Clear" ? 185 : 158, row.pep === "Clear" ? 129 : 11);
    doc.text(row.pep, 125, yPos + 5);
    doc.setTextColor(30, 41, 59);
    doc.text(row.status, 155, yPos + 5);
    yPos += 7;
  });
  
  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${data.generatedAt}`, 20, pageHeight - 12);
  doc.text("GAC Sourcing - Rapport Confidentiel", pageWidth - 60, pageHeight - 12);
  
  doc.save(`compliance-audit-${data.period}.pdf`);
}

interface RiskAssessmentData extends ReportData {
  totalAssessed: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  pendingEDD: number;
  riskDistribution: { tier: string; count: number; percentage: number; color: string }[];
  eddStatus: { counterparty: string; riskTier: string; eddStatus: string; dueDate: string }[];
}

export function generateRiskAssessmentReport(data: RiskAssessmentData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, pageWidth, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 18);
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "Rapport - Évaluation des Risques" : "Report - Risk Assessment", 20, 30);
  
  doc.setFontSize(9);
  doc.text(`${data.periodLabel} | ${data.generatedAt}`, pageWidth - 70, 25);
  
  let yPos = 55;
  
  // Risk Summary
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "DISTRIBUTION DES RISQUES" : "RISK DISTRIBUTION", 20, yPos);
  
  yPos += 10;
  
  const riskBoxWidth = (pageWidth - 55) / 4;
  const riskColors: [number, number, number][] = [[16, 185, 129], [245, 158, 11], [239, 68, 68], [100, 116, 139]];
  const riskLabels = [
    data.language === "fr" ? "Faible" : "Low",
    data.language === "fr" ? "Moyen" : "Medium", 
    data.language === "fr" ? "Élevé" : "High",
    data.language === "fr" ? "En attente EDD" : "Pending EDD"
  ];
  const riskValues = [data.lowRisk, data.mediumRisk, data.highRisk, data.pendingEDD];
  
  riskLabels.forEach((label, i) => {
    const x = 20 + i * (riskBoxWidth + 5);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, yPos, riskBoxWidth, 25, 2, 2, "F");
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, x + 5, yPos + 8);
    
    doc.setFontSize(16);
    doc.setTextColor(riskColors[i][0], riskColors[i][1], riskColors[i][2]);
    doc.setFont("helvetica", "bold");
    doc.text(riskValues[i].toString(), x + 5, yPos + 20);
  });
  
  yPos += 40;
  
  // Risk Distribution bars
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "RÉPARTITION PAR TIER" : "TIER BREAKDOWN", 20, yPos);
  
  yPos += 10;
  
  data.riskDistribution.forEach((tier) => {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, yPos, pageWidth - 40, 14, 2, 2, "F");
    
    // Progress bar
    const barWidth = ((pageWidth - 80) * tier.percentage) / 100;
    if (tier.tier.includes("Low") || tier.tier.includes("Faible")) {
      doc.setFillColor(16, 185, 129);
    } else if (tier.tier.includes("Medium") || tier.tier.includes("Moyen")) {
      doc.setFillColor(245, 158, 11);
    } else {
      doc.setFillColor(239, 68, 68);
    }
    doc.roundedRect(70, yPos + 4, barWidth, 6, 1, 1, "F");
    
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(tier.tier, 25, yPos + 9);
    doc.setFont("helvetica", "bold");
    doc.text(`${tier.count} (${tier.percentage.toFixed(1)}%)`, pageWidth - 50, yPos + 9);
    
    yPos += 17;
  });
  
  yPos += 10;
  
  // EDD Status Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(data.language === "fr" ? "STATUT EDD" : "EDD STATUS", 20, yPos);
  
  yPos += 8;
  
  doc.setFillColor(30, 41, 59);
  doc.rect(20, yPos, pageWidth - 40, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(data.language === "fr" ? "Contrepartie" : "Counterparty", 25, yPos + 5.5);
  doc.text(data.language === "fr" ? "Tier" : "Tier", 90, yPos + 5.5);
  doc.text("Status", 120, yPos + 5.5);
  doc.text(data.language === "fr" ? "Échéance" : "Due Date", 160, yPos + 5.5);
  
  yPos += 8;
  
  data.eddStatus.slice(0, 8).forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(20, yPos, pageWidth - 40, 7, "F");
    }
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.text(row.counterparty.substring(0, 25), 25, yPos + 5);
    doc.text(row.riskTier, 90, yPos + 5);
    doc.text(row.eddStatus, 120, yPos + 5);
    doc.text(row.dueDate, 160, yPos + 5);
    yPos += 7;
  });
  
  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Document généré le ${data.generatedAt}`, 20, pageHeight - 12);
  doc.text("GAC Sourcing - Rapport Confidentiel", pageWidth - 60, pageHeight - 12);
  
  doc.save(`risk-assessment-${data.period}.pdf`);
}

// =============================================================================
// ASSAY CERTIFICATE PDF
// =============================================================================

interface AssayCertificateData {
  batchNumber: string;
  counterpartyName: string;
  counterpartyCountry: string;
  grossWeightKg: number;
  netWeightKg: number;
  purityPercentage: number;
  fineGoldWeightKg: number;
  assayMethod: string;
  laboratory: string;
  assayDate: string;
  status: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export function generateAssayCertificatePDF(data: AssayCertificateData, options: PDFOptions): void {
  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header with gold gradient effect
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 55, "F");
  
  // Gold accent bar
  doc.setFillColor(234, 179, 8);
  doc.rect(0, 55, pageWidth, 4, "F");

  // Logo and title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("GAC SOURCING", 20, 22);

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(options.title || "Assay Certificate", 20, 35);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`Batch: ${data.batchNumber}`, pageWidth - 60, 22);
  doc.text(`Date: ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - 60, 30);

  // Verification seal
  if (data.status === "verified") {
    doc.setFillColor(16, 185, 129);
    doc.circle(pageWidth - 35, 45, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("VERIFIED", pageWidth - 43, 46);
  }

  let yPos = 75;

  // Certificate Title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GOLD ASSAY CERTIFICATE", pageWidth / 2, yPos, { align: "center" });

  yPos += 15;

  // Batch Reference Box
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, yPos, pageWidth - 40, 25, 3, 3, "F");

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("BATCH REFERENCE", 30, yPos + 10);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.batchNumber, 30, yPos + 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Laboratory: ${data.laboratory}`, pageWidth - 80, yPos + 15);

  yPos += 40;

  // Supplier Information
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("SUPPLIER INFORMATION", 20, yPos);

  yPos += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);

  yPos += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const supplierInfo = [
    ["Supplier Name:", data.counterpartyName],
    ["Country of Origin:", data.counterpartyCountry],
    ["Assay Method:", data.assayMethod],
    ["Assay Date:", new Date(data.assayDate).toLocaleDateString("fr-FR")],
  ];

  supplierInfo.forEach(([label, value]) => {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 25, yPos);
    doc.setTextColor(30, 41, 59);
    doc.text(value || "N/A", 80, yPos);
    yPos += 8;
  });

  yPos += 15;

  // Gold Analysis Results
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GOLD ANALYSIS RESULTS", 20, yPos);

  yPos += 8;
  doc.setDrawColor(226, 232, 240);
  doc.line(20, yPos, pageWidth - 20, yPos);

  yPos += 10;

  // Results in gold-themed box
  doc.setFillColor(254, 249, 195);
  doc.roundedRect(20, yPos, pageWidth - 40, 50, 3, 3, "F");

  // Results grid
  const colWidth = (pageWidth - 40) / 4;

  const results = [
    { label: "Gross Weight", value: `${data.grossWeightKg.toFixed(3)} kg` },
    { label: "Net Weight", value: `${data.netWeightKg.toFixed(3)} kg` },
    { label: "Purity", value: `${(data.purityPercentage * 100).toFixed(2)}%` },
    { label: "Fine Gold", value: `${data.fineGoldWeightKg.toFixed(3)} kg` },
  ];

  results.forEach((result, i) => {
    const x = 25 + i * colWidth;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(result.label, x, yPos + 15);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(result.value, x, yPos + 28);
  });

  // Troy ounces conversion
  const troyOunces = data.fineGoldWeightKg * 32.1507;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Fine Gold in Troy Ounces: ${troyOunces.toFixed(2)} oz t`, pageWidth / 2, yPos + 43, { align: "center" });

  yPos += 65;

  // Verification Section
  if (data.status === "verified" && data.verifiedBy) {
    doc.setFillColor(16, 185, 129, 0.1);
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(20, yPos, pageWidth - 40, 30, 3, 3, "F");

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("VERIFICATION", 30, yPos + 12);

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Verified by: ${data.verifiedBy}`, 30, yPos + 22);
    doc.text(
      `Verification Date: ${data.verifiedAt ? new Date(data.verifiedAt).toLocaleDateString("fr-FR") : "N/A"}`,
      120,
      yPos + 22
    );

    yPos += 40;
  }

  // Declaration
  yPos += 10;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  const declaration =
    "This certificate confirms that the gold sample identified above has been analyzed according to industry standards. " +
    "The results presented are accurate to the best of our knowledge and testing capabilities.";
  const splitDeclaration = doc.splitTextToSize(declaration, pageWidth - 40);
  doc.text(splitDeclaration, 20, yPos);

  // Footer with signatures
  const footerY = pageHeight - 40;

  doc.setDrawColor(226, 232, 240);
  doc.line(20, footerY - 10, pageWidth - 20, footerY - 10);

  // Signature lines
  doc.setDrawColor(100, 116, 139);
  doc.line(30, footerY + 5, 80, footerY + 5);
  doc.line(pageWidth / 2 - 25, footerY + 5, pageWidth / 2 + 25, footerY + 5);
  doc.line(pageWidth - 80, footerY + 5, pageWidth - 30, footerY + 5);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text("Laboratory Analyst", 40, footerY + 10);
  doc.text("Quality Manager", pageWidth / 2 - 10, footerY + 10);
  doc.text("Compliance Officer", pageWidth - 65, footerY + 10);

  // Document footer
  doc.setFontSize(7);
  doc.text(
    `Document generated on ${new Date().toLocaleDateString("fr-FR")} at ${new Date().toLocaleTimeString("fr-FR")}`,
    20,
    pageHeight - 10
  );
  doc.text("GAC Sourcing - Official Assay Certificate", pageWidth - 70, pageHeight - 10);

  doc.save(options.filename);
}

// =============================================================================
// APPLICATION DOCUMENTATION PDF
// =============================================================================

interface DocumentationSection {
  id: string;
  name: string;
  route: string;
  category: string;
  businessDescription: string;
  technicalDescription: string;
  userStory: string;
  dataFlow: string;
  permissions: string;
  algorithm?: string;
  businessRules?: string[];
}

interface DocumentationPDFData {
  title: string;
  subtitle: string;
  language: "en" | "fr";
  sections: DocumentationSection[];
  databaseTables?: Array<{ name: string; description: string; columns: string }>;
}

export function generateDocumentationPDF(data: DocumentationPDFData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Set document metadata
  doc.setProperties({
    title: "Konex - Documentation Technique",
    subject: "Documentation complete de l'application Konex",
    author: "EmergenceRDC",
    keywords: "Konex, Gold Acquisition, Compliance, Documentation",
    creator: "Konex by EmergenceRDC",
  });

  // Helper function for page footer
  const addPageFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Konex - EmergenceRDC`, margin, pageHeight - 10);
    doc.text(`Page ${pageNum}`, pageWidth - margin - 15, pageHeight - 10);
  };

  // Helper function to check if new page is needed
  let currentPage = 1;
  const checkNewPage = (yPos: number, requiredSpace: number): number => {
    if (yPos + requiredSpace > pageHeight - 30) {
      addPageFooter(currentPage);
      doc.addPage();
      currentPage++;
      return 30;
    }
    return yPos;
  };

  // ===== COVER PAGE =====
  // Background
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Gold accent
  doc.setFillColor(234, 179, 8);
  doc.rect(0, pageHeight * 0.4, pageWidth, 5, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(42);
  doc.setFont("helvetica", "bold");
  doc.text("KONEX", pageWidth / 2, pageHeight * 0.3, { align: "center" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(data.title, pageWidth / 2, pageHeight * 0.35, { align: "center" });

  // Subtitle
  doc.setFontSize(12);
  doc.setTextColor(148, 163, 184);
  const subtitleLines = doc.splitTextToSize(data.subtitle, contentWidth);
  doc.text(subtitleLines, pageWidth / 2, pageHeight * 0.5, { align: "center" });

  // Metadata box
  doc.setFillColor(51, 65, 85);
  doc.roundedRect(margin, pageHeight * 0.65, contentWidth, 40, 3, 3, "F");

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(10);
  doc.text(data.language === "fr" ? "Application" : "Application", margin + 10, pageHeight * 0.65 + 12);
  doc.text(data.language === "fr" ? "Auteur" : "Author", margin + 10, pageHeight * 0.65 + 24);
  doc.text(data.language === "fr" ? "Date de generation" : "Generated on", margin + 10, pageHeight * 0.65 + 36);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Konex", margin + 60, pageHeight * 0.65 + 12);
  doc.text("EmergenceRDC", margin + 60, pageHeight * 0.65 + 24);
  doc.text(new Date().toLocaleDateString(data.language === "fr" ? "fr-FR" : "en-US"), margin + 60, pageHeight * 0.65 + 36);

  // Footer on cover
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Konex - Gold Acquisition Platform by EmergenceRDC", pageWidth / 2, pageHeight - 15, { align: "center" });

  // ===== TABLE OF CONTENTS =====
  doc.addPage();
  currentPage++;

  let yPos = 30;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Table des Matieres" : "Table of Contents", margin, yPos);

  yPos += 15;
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(1);
  doc.line(margin, yPos, margin + 40, yPos);

  yPos += 15;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Group sections by category
  const categories = [...new Set(data.sections.map((s) => s.category))];
  let tocPageNum = 3;

  categories.forEach((category) => {
    yPos = checkNewPage(yPos, 20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(category, margin, yPos);
    yPos += 8;

    const categorySections = data.sections.filter((s) => s.category === category);
    categorySections.forEach((section) => {
      yPos = checkNewPage(yPos, 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      // Truncate section name if too long for TOC
      const maxNameWidth = contentWidth - 30;
      let sectionName = section.name;
      while (doc.getTextWidth(`  ${sectionName}`) > maxNameWidth && sectionName.length > 10) {
        sectionName = sectionName.slice(0, -4) + "...";
      }
      doc.text(`  ${sectionName}`, margin, yPos);
      doc.text(`${tocPageNum}`, pageWidth - margin - 10, yPos, { align: "right" });
      yPos += 6;
      tocPageNum++;
    });

    yPos += 5;
  });

  addPageFooter(currentPage);

  // ===== CONTENT PAGES =====
  data.sections.forEach((section) => {
    doc.addPage();
    currentPage++;
    yPos = 30;

    // Section header
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 0, pageWidth, 50, "F");
    doc.setFillColor(234, 179, 8);
    doc.rect(0, 50, pageWidth, 3, "F");

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    // Wrap section name if too long
    const sectionNameLines = doc.splitTextToSize(section.name, contentWidth - 40);
    doc.text(sectionNameLines[0], margin, 25);
    if (sectionNameLines.length > 1) {
      doc.setFontSize(14);
      doc.text(sectionNameLines[1], margin, 33);
    }

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(`Route: ${section.route}`, margin, sectionNameLines.length > 1 ? 40 : 35);
    // Wrap user story if too long
    const userStoryText = `User Story: ${section.userStory}`;
    const userStoryLines = doc.splitTextToSize(userStoryText, contentWidth - 40);
    doc.text(userStoryLines[0], margin, sectionNameLines.length > 1 ? 46 : 42);

    // Category badge
    doc.setFillColor(234, 179, 8);
    doc.roundedRect(pageWidth - margin - 30, 20, 30, 8, 2, 2, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    doc.text(section.category, pageWidth - margin - 25, 25);

    yPos = 65;

    // Business Description
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(data.language === "fr" ? "Description Metier" : "Business Description", margin, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const businessLines = doc.splitTextToSize(section.businessDescription, contentWidth);
    businessLines.forEach((line: string) => {
      yPos = checkNewPage(yPos, 6);
      doc.text(line, margin, yPos);
      yPos += 5;
    });

    yPos += 8;

    // Technical Description
    yPos = checkNewPage(yPos, 30);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(data.language === "fr" ? "Description Technique" : "Technical Description", margin, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const techLines = doc.splitTextToSize(section.technicalDescription, contentWidth);
    techLines.forEach((line: string) => {
      yPos = checkNewPage(yPos, 6);
      doc.text(line, margin, yPos);
      yPos += 5;
    });

    yPos += 8;

    // Data Flow
    yPos = checkNewPage(yPos, 25);
    doc.setFillColor(241, 245, 249);
    const dataFlowLines = doc.splitTextToSize(section.dataFlow, contentWidth - 15);
    const dataFlowHeight = Math.max(18, dataFlowLines.length * 5 + 12);
    doc.roundedRect(margin, yPos, contentWidth, dataFlowHeight, 2, 2, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(data.language === "fr" ? "Flux de Donnees:" : "Data Flow:", margin + 5, yPos + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    dataFlowLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 5, yPos + 12 + (idx * 5));
    });

    yPos += dataFlowHeight + 8;

    // Permissions
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(data.language === "fr" ? "Permissions:" : "Permissions:", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    const permissionsLines = doc.splitTextToSize(section.permissions, contentWidth - 35);
    permissionsLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 30, yPos + (idx * 5));
    });

    yPos += Math.max(12, permissionsLines.length * 5 + 5);

    // Algorithm (if present)
    if (section.algorithm) {
      yPos = checkNewPage(yPos, 50);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(data.language === "fr" ? "Algorithme" : "Algorithm", margin, yPos);
      yPos += 8;

      doc.setFillColor(30, 41, 59);
      const algoLines = section.algorithm.trim().split("\n");
      // Wrap each algorithm line to fit within content width
      const wrappedAlgoLines: string[] = [];
      algoLines.forEach((line: string) => {
        const wrapped = doc.splitTextToSize(line, contentWidth - 15);
        wrappedAlgoLines.push(...wrapped);
      });
      const algoHeight = Math.min(wrappedAlgoLines.length * 4 + 10, 100);
      doc.roundedRect(margin, yPos, contentWidth, algoHeight, 2, 2, "F");

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      let algoY = yPos + 6;
      wrappedAlgoLines.slice(0, 20).forEach((line: string) => {
        doc.text(line, margin + 5, algoY);
        algoY += 4;
      });

      yPos += algoHeight + 10;
    }

    // Business Rules (if present)
    if (section.businessRules && section.businessRules.length > 0) {
      yPos = checkNewPage(yPos, 30);
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(data.language === "fr" ? "Regles Metier" : "Business Rules", margin, yPos);
      yPos += 8;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      section.businessRules.forEach((rule) => {
        const ruleLines = doc.splitTextToSize(`- ${rule}`, contentWidth - 10);
        ruleLines.forEach((line: string) => {
          yPos = checkNewPage(yPos, 6);
          doc.text(line, margin + 5, yPos);
          yPos += 5;
        });
      });
    }

    addPageFooter(currentPage);
  });

  // ===== DATABASE SCHEMA (if present) =====
  if (data.databaseTables && data.databaseTables.length > 0) {
    doc.addPage();
    currentPage++;
    yPos = 30;

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(data.language === "fr" ? "Schema de Base de Donnees" : "Database Schema", margin, yPos);

    yPos += 15;

    data.databaseTables.forEach((table) => {
      yPos = checkNewPage(yPos, 30);

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, "F");

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(table.name, margin + 5, yPos + 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(table.description, margin + 5, yPos + 15);

      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const colText = doc.splitTextToSize(table.columns, contentWidth - 10);
      doc.text(colText[0], margin + 5, yPos + 21);

      yPos += 30;
    });

    addPageFooter(currentPage);
  }

  doc.save("Konex-Documentation-Technique.pdf");
}

// =============================================================================
// CAHIER DES CHARGES PDF
// =============================================================================

interface CahierDesChargesData {
  language: "en" | "fr";
  projectName: string;
  client: string;
  version: string;
  sections: DocumentationSection[];
}

export function generateCahierDesChargesPDF(data: CahierDesChargesData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Set document metadata
  doc.setProperties({
    title: "Konex - Cahier des Charges",
    subject: "Cahier des charges et specifications techniques de Konex",
    author: "EmergenceRDC",
    keywords: "Konex, Cahier des Charges, Specifications, Requirements",
    creator: "Konex by EmergenceRDC",
  });

  let currentPage = 1;

  const addPageFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Konex - Cahier des Charges v${data.version}`, margin, pageHeight - 10);
    doc.text(`Page ${pageNum}`, pageWidth - margin - 15, pageHeight - 10);
  };

  const checkNewPage = (yPos: number, requiredSpace: number): number => {
    if (yPos + requiredSpace > pageHeight - 30) {
      addPageFooter(currentPage);
      doc.addPage();
      currentPage++;
      return 30;
    }
    return yPos;
  };

  // ===== COVER PAGE =====
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Gold accents
  doc.setFillColor(234, 179, 8);
  doc.rect(margin, pageHeight * 0.25, 5, 50, "F");

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(data.language === "fr" ? "CAHIER DES CHARGES" : "REQUIREMENTS SPECIFICATION", margin + 15, pageHeight * 0.28);

  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("KONEX", margin + 15, pageHeight * 0.35);

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(data.language === "fr" ? "Plateforme d'Acquisition d'Or" : "Gold Acquisition Platform", margin + 15, pageHeight * 0.40);

  // Info box
  doc.setFillColor(51, 65, 85);
  doc.roundedRect(margin, pageHeight * 0.55, contentWidth, 60, 3, 3, "F");

  const infoLabels = data.language === "fr"
    ? ["Projet", "Client", "Version", "Date", "Auteur"]
    : ["Project", "Client", "Version", "Date", "Author"];
  const infoValues = [data.projectName, data.client, data.version, new Date().toLocaleDateString(data.language === "fr" ? "fr-FR" : "en-US"), "EmergenceRDC"];

  doc.setFontSize(10);
  let infoY = pageHeight * 0.55 + 12;
  infoLabels.forEach((label, i) => {
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text(label, margin + 10, infoY);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    // Wrap long values
    const valueLines = doc.splitTextToSize(infoValues[i], contentWidth - 70);
    doc.text(valueLines[0], margin + 50, infoY);
    infoY += 10;
  });

  // Confidential badge
  doc.setFillColor(234, 179, 8);
  doc.roundedRect(pageWidth - margin - 40, pageHeight * 0.55 + 5, 35, 10, 2, 2, "F");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CONFIDENTIEL", pageWidth - margin - 38, pageHeight * 0.55 + 11);

  // Footer
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("EmergenceRDC - Tous droits reserves", pageWidth / 2, pageHeight - 15, { align: "center" });

  // ===== EXECUTIVE SUMMARY =====
  doc.addPage();
  currentPage++;
  let yPos = 30;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Resume Executif" : "Executive Summary", margin, yPos);

  yPos += 10;
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(1);
  doc.line(margin, yPos, margin + 30, yPos);

  yPos += 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  const summaryText = data.language === "fr"
    ? `Konex est une plateforme complete de conformite et de trading concue pour les banques centrales afin de gerer les achats d'or provenant d'exploitations minieres artisanales et a grande echelle. Elle implemente les normes LBMA Responsible Gold Guidance (RGG) et assure une conformite reglementaire complete.

La plateforme couvre l'ensemble du cycle de vie de l'acquisition d'or:
- Enrolement des contreparties avec verification KYC/AML
- Scoring de conformite preliminaire automatise (US-01)
- Workflow de diligence raisonnable base sur le risque (US-02)
- Gestion des bons de commande avec double approbation (US-03)
- Validation pre-expedition et dispatch (US-04)
- Reception en coffre-fort et verification d'essai (US-05)
- Traitement des reglements (US-06)
- Piste d'audit complete et reporting reglementaire`
    : `Konex is a comprehensive compliance and trading platform designed for central banks to manage gold purchases from artisanal and large-scale mining operations. It implements LBMA Responsible Gold Guidance (RGG) standards and ensures full regulatory compliance.

The platform covers the complete gold acquisition lifecycle:
- Counterparty onboarding with KYC/AML verification
- Automated preliminary compliance scoring (US-01)
- Risk-based due diligence workflow (US-02)
- Purchase order management with dual approval (US-03)
- Pre-shipment validation and dispatch (US-04)
- Vault receipt and assay verification (US-05)
- Settlement processing (US-06)
- Complete audit trail and regulatory reporting`;

  const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
  summaryLines.forEach((line: string) => {
    yPos = checkNewPage(yPos, 6);
    doc.text(line, margin, yPos);
    yPos += 5;
  });

  addPageFooter(currentPage);

  // ===== FUNCTIONAL SPECIFICATIONS =====
  doc.addPage();
  currentPage++;
  yPos = 30;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Specifications Fonctionnelles" : "Functional Specifications", margin, yPos);

  yPos += 10;
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(1);
  doc.line(margin, yPos, margin + 40, yPos);

  yPos += 15;

  // Group by user story
  const userStories = [...new Set(data.sections.map((s) => s.userStory).filter((us) => us !== "N/A"))];

  userStories.forEach((us) => {
    yPos = checkNewPage(yPos, 30);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(us, margin + 5, yPos + 7);

    yPos += 15;

    const usSections = data.sections.filter((s) => s.userStory === us);
    usSections.forEach((section) => {
      yPos = checkNewPage(yPos, 25);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(section.name, margin, yPos);

      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(section.businessDescription, contentWidth);
      descLines.slice(0, 4).forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 4;
      });

      yPos += 8;
    });
  });

  addPageFooter(currentPage);

  // ===== TECHNICAL SPECIFICATIONS =====
  doc.addPage();
  currentPage++;
  yPos = 30;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Specifications Techniques" : "Technical Specifications", margin, yPos);

  yPos += 10;
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(1);
  doc.line(margin, yPos, margin + 40, yPos);

  yPos += 15;

  // Architecture section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Architecture Technique" : "Technical Architecture", margin, yPos);

  yPos += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  const archText = data.language === "fr"
    ? `- Framework: Next.js 15+ avec App Router
- Base de donnees: PostgreSQL (Neon Serverless)
- Authentification: Supabase Auth / Custom JWT
- UI Components: shadcn/ui avec Tailwind CSS
- Deploiement: Vercel Edge Network
- Generation PDF: jsPDF
- Validation: Zod Schema
- State Management: SWR pour le data fetching`
    : `- Framework: Next.js 15+ with App Router
- Database: PostgreSQL (Neon Serverless)
- Authentication: Supabase Auth / Custom JWT
- UI Components: shadcn/ui with Tailwind CSS
- Deployment: Vercel Edge Network
- PDF Generation: jsPDF
- Validation: Zod Schema
- State Management: SWR for data fetching`;

  const archLines = archText.split("\n");
  archLines.forEach((line) => {
    doc.text(line, margin, yPos);
    yPos += 6;
  });

  yPos += 10;

  // API Endpoints
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Points d'Acces API" : "API Endpoints", margin, yPos);

  yPos += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  data.sections.forEach((section) => {
    if (section.dataFlow && section.dataFlow.includes("API")) {
      yPos = checkNewPage(yPos, 12);
      const apiText = `${section.name}: ${section.dataFlow}`;
      const apiLines = doc.splitTextToSize(apiText, contentWidth);
      apiLines.forEach((line: string) => {
        doc.text(line, margin, yPos);
        yPos += 4;
      });
      yPos += 2;
    }
  });

  addPageFooter(currentPage);

  // ===== SECURITY REQUIREMENTS =====
  doc.addPage();
  currentPage++;
  yPos = 30;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.language === "fr" ? "Exigences de Securite" : "Security Requirements", margin, yPos);

  yPos += 10;
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(1);
  doc.line(margin, yPos, margin + 30, yPos);

  yPos += 15;

  const securityItems = data.language === "fr"
    ? [
        "Chiffrement TLS 1.3 pour toutes les communications",
        "Chiffrement AES-256 pour les donnees au repos",
        "Authentification multi-facteurs (MFA) pour les approbations",
        "Controle d'acces base sur les roles (RBAC)",
        "Hash SHA-256 pour l'immutabilite des enregistrements d'audit",
        "Segregation des taches pour les doubles approbations",
        "Tokens JWT avec expiration courte",
        "Rate limiting et protection contre les attaques par force brute",
        "Journalisation complete des evenements de securite",
        "Conformite GDPR pour la protection des donnees personnelles",
      ]
    : [
        "TLS 1.3 encryption for all communications",
        "AES-256 encryption for data at rest",
        "Multi-factor authentication (MFA) for approvals",
        "Role-based access control (RBAC)",
        "SHA-256 hashing for audit record immutability",
        "Segregation of duties for dual approvals",
        "JWT tokens with short expiration",
        "Rate limiting and brute force protection",
        "Complete security event logging",
        "GDPR compliance for personal data protection",
      ];

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  securityItems.forEach((item) => {
    const itemLines = doc.splitTextToSize(`- ${item}`, contentWidth);
    itemLines.forEach((line: string) => {
      yPos = checkNewPage(yPos, 6);
      doc.text(line, margin, yPos);
      yPos += 5;
    });
    yPos += 2;
  });

  addPageFooter(currentPage);

  doc.save("Konex-Cahier-des-Charges.pdf");
}
