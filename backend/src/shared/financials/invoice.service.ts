import PDFDocument from "pdfkit";
import { logger } from "../../common/logger";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  artistName?: string;
  amount: number;
  currency: string;
  status: string;
  billingCycle: string;
}

export class InvoiceService {
  /**
   * Generates a PDF invoice as a buffer.
   */
  static async generateInvoiceBuffer(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        // --- Header (Branded) ---
        doc
          .fillColor("#FF7A18")
          .fontSize(22)
          .text("MUSIC PLATFORM", 50, 50)
          .fillColor("#444444")
          .fontSize(10)
          .text("Premium Digital Music Experience", 50, 78)
          .text("Securely processed via Razorpay", 50, 92)
          .moveDown();

        doc
          .fillColor("#000000")
          .fontSize(20)
          .text("Receipt", 0, 50, { align: "right" })
          .fontSize(10)
          .text(`Invoice #: ${data.invoiceNumber}`, 0, 75, { align: "right" })
          .text(`Date: ${data.date}`, 0, 90, { align: "right" });

        this.generateHr(doc, 115);

        // --- Bill To Grid ---
        const infoTop = 140;
        doc
          .fillColor("#888888")
          .fontSize(10)
          .text("BILL TO", 50, infoTop)
          .fillColor("#000000")
          .font("Helvetica-Bold")
          .text(data.customerName, 50, infoTop + 15)
          .font("Helvetica")
          .text(data.customerEmail, 50, infoTop + 30);

        doc
          .fillColor("#888888")
          .text("PAYMENT STATUS", 350, infoTop)
          .fillColor(data.status.toUpperCase() === 'CAPTURED' ? '#10B981' : '#FF7A18')
          .font("Helvetica-Bold")
          .text(data.status.toUpperCase(), 350, infoTop + 15);

        doc.moveDown(4);

        // --- Items Table ---
        const tableTop = 240;
        doc.font("Helvetica-Bold").fillColor("#000000");
        this.generateTableRow(doc, tableTop, "Plan Description", "Cycle", "Total");
        this.generateHr(doc, tableTop + 18);
        
        doc.font("Helvetica");
        const description = data.artistName ? `Artist Subscription: ${data.artistName}` : "Platform Premium Plan";
        this.generateTableRow(
          doc, 
          tableTop + 30, 
          description, 
          data.billingCycle.toUpperCase(), 
          `${data.currency} ${data.amount.toFixed(2)}`
        );
        this.generateHr(doc, tableTop + 56);

        // --- Summary ---
        const subtotalPosition = tableTop + 75;
        doc.font("Helvetica-Bold");
        this.generateTableRow(doc, subtotalPosition, "", "TOTAL PAID", `${data.currency} ${data.amount.toFixed(2)}`);

        // --- Footer ---
        doc
          .fontSize(9)
          .fillColor("#aaaaaa")
          .text(
            "This document confirms your premium access. Service is provided immediately upon payment confirmation. No physical signature is required.",
            50,
            700,
            { align: "center", width: 500 }
          )
          .moveDown(0.5)
          .text("Thank you for choosing Music Platform!", { align: "center" });

        doc.end();
      } catch (error) {
        logger.error(error, "[InvoiceService] PDF generation failed");
        reject(error);
      }
    });
  }

  private static generateHr(doc: PDFKit.PDFDocument, y: number) {
    doc
      .strokeColor("#eeeeee")
      .lineWidth(1)
      .moveTo(50, y)
      .lineTo(550, y)
      .stroke();
  }

  private static generateTableRow(
    doc: PDFKit.PDFDocument,
    y: number,
    item: string,
    quantity: string,
    lineTotal: string
  ) {
    doc
      .fontSize(10)
      .text(item, 50, y)
      .text(quantity, 300, y, { width: 90, align: "right" })
      .text(lineTotal, 450, y, { width: 100, align: "right" });
  }
}
