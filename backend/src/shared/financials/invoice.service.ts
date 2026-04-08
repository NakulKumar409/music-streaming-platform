import PDFDocument from "pdfkit";
import { logger } from "../../common/logger";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerEmail: string;
  artistName: string;
  amount: number;
  currency: string;
  status: string;
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

        // --- Header ---
        doc
          .fillColor("#444444")
          .fontSize(20)
          .text("PREMIUM PLAY", 110, 50)
          .fontSize(10)
          .text("Music Streaming Platform", 110, 75)
          .text("Secure Payment Verified", 110, 90)
          .moveDown();

        // --- Invoice Info ---
        doc
          .fillColor("#444444")
          .fontSize(20)
          .text("Invoice", 50, 160);

        this.generateHr(doc, 185);

        const customerInfoTop = 200;

        doc
          .fontSize(10)
          .text("Invoice Number:", 50, customerInfoTop)
          .font("Helvetica-Bold")
          .text(data.invoiceNumber, 150, customerInfoTop)
          .font("Helvetica")
          .text("Invoice Date:", 50, customerInfoTop + 15)
          .text(data.date, 150, customerInfoTop + 15)
          .text("Payment Status:", 50, customerInfoTop + 30)
          .font("Helvetica-Bold")
          .text(data.status.toUpperCase(), 150, customerInfoTop + 30)

          .font("Helvetica-Bold")
          .text(data.customerName, 300, customerInfoTop)
          .font("Helvetica")
          .text(data.customerEmail, 300, customerInfoTop + 15)
          .moveDown();

        this.generateHr(doc, 252);

        // --- Table ---
        let i;
        const invoiceTableTop = 330;

        doc.font("Helvetica-Bold");
        this.generateTableRow(
          doc,
          invoiceTableTop,
          "Description",
          "Units",
          "Line Total"
        );
        this.generateHr(doc, invoiceTableTop + 20);
        doc.font("Helvetica");

        const description = `Subscription to ${data.artistName}`;
        this.generateTableRow(
          doc,
          invoiceTableTop + 30,
          description,
          "1",
          `${data.currency} ${data.amount.toFixed(2)}`
        );

        this.generateHr(doc, invoiceTableTop + 56);

        const subtotalPosition = invoiceTableTop + 70;
        this.generateTableRow(
          doc,
          subtotalPosition,
          "",
          "Total Amount",
          `${data.currency} ${data.amount.toFixed(2)}`
        );

        // --- Footer ---
        doc
          .fontSize(10)
          .text(
            "Thank you for supporting your favorite artists on Premium Play.",
            50,
            700,
            { align: "center", width: 500 }
          );

        doc.end();
      } catch (error) {
        logger.error(error, "[InvoiceService] PDF generation failed");
        reject(error);
      }
    });
  }

  private static generateHr(doc: PDFKit.PDFDocument, y: number) {
    doc
      .strokeColor("#aaaaaa")
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
      .text(quantity, 280, y, { width: 90, align: "right" })
      .text(lineTotal, 400, y, { width: 90, align: "right" });
  }
}
