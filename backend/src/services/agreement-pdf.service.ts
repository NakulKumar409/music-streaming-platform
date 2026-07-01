import PDFDocument from 'pdfkit';
import { logger } from '../common/logger';

interface AgreementData {
  artistName: string;
  email: string;
  phone: string | null;
  agreementVersion: string;
  artistRevenueShare: number;
  platformRevenueShare: number;
  agreementAcceptedAt: Date;
  signatureSignedAt: Date;
  agreementId: string;
  digitalSignature: string;
  termsVersion: string;
  termsContent: string;
  agreementStartDate: Date;
}

export class AgreementPdfService {
  static async generateAgreementPdf(data: AgreementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add platform logo placeholder (using text for now)
        doc.fontSize(24).font('Helvetica-Bold').fill('#e85d2c').text('Music Platform', { align: 'center' });
        doc.moveDown(0.5);

        // Title
        doc.fontSize(18).font('Helvetica-Bold').fill('#333').text('Artist Onboarding Agreement', { align: 'center' });
        doc.moveDown(1);

        // Agreement ID
        doc.fontSize(10).font('Helvetica').fill('#666').text(`Agreement ID: ${data.agreementId}`, { align: 'center' });
        doc.moveDown(1);

        // Horizontal line
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Artist Information Section
        doc.fontSize(14).font('Helvetica-Bold').fill('#333').text('Artist Information');
        doc.moveDown(0.5);
        
        doc.fontSize(11).font('Helvetica').fill('#444');
        doc.text(`Artist Name: ${data.artistName}`);
        doc.text(`Email: ${data.email}`);
        if (data.phone) {
          doc.text(`Phone: ${data.phone}`);
        }
        doc.moveDown(1);

        // Agreement Version
        doc.fontSize(14).font('Helvetica-Bold').fill('#333').text('Agreement Details');
        doc.moveDown(0.5);

        doc.fontSize(11).font('Helvetica').fill('#444');
        doc.text(`Agreement ID: ${data.agreementId}`);
        doc.text(`Agreement Version: ${data.agreementVersion}`);
        doc.text(`Terms Version: ${data.termsVersion}`);
        doc.text(`Agreement Start Date: ${data.agreementStartDate.toLocaleDateString()}`);
        doc.text(`Accepted On: ${data.agreementAcceptedAt.toLocaleDateString()}`);
        doc.moveDown(1);

        // Revenue Sharing Section
        doc.fontSize(14).font('Helvetica-Bold').fill('#333').text('Revenue Sharing');
        doc.moveDown(0.5);
        
        doc.fontSize(11).font('Helvetica').fill('#444');
        doc.text(`Artist Share: ${data.artistRevenueShare}%`);
        doc.text(`Platform Share: ${data.platformRevenueShare}%`);
        doc.moveDown(1);

        // Terms & Conditions Section
        doc.fontSize(14).font('Helvetica-Bold').fill('#333').text('Terms & Conditions');
        doc.moveDown(0.5);

        doc.fontSize(10).font('Helvetica').fill('#444');
        doc.text(data.termsContent, { align: 'justify' });
        doc.moveDown(1);

        // Signature Section
        doc.fontSize(14).font('Helvetica-Bold').fill('#333').text('Digital Signature');
        doc.moveDown(0.5);
        
        doc.fontSize(11).font('Helvetica').fill('#444');
        doc.text(`Signed On: ${data.signatureSignedAt.toLocaleDateString()}`);
        doc.moveDown(0.5);

        // Signature placeholder
        if (data.digitalSignature) {
          doc.rect(50, doc.y, 200, 80).stroke();
          doc.fontSize(9).font('Helvetica').fill('#999').text('Artist Digital Signature', 50, doc.y + 65);
          doc.moveDown(3);
        }

        // Footer
        doc.fontSize(8).font('Helvetica').fill('#999').text(
          'This document is electronically generated and signed.',
          { align: 'center' }
        );
        doc.text(
          `Generated on ${new Date().toLocaleDateString()}`,
          { align: 'center' }
        );

        doc.end();
      } catch (error) {
        logger.error({ msg: '[AgreementPdfService] Error generating PDF', error });
        reject(error);
      }
    });
  }
}
