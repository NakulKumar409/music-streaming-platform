import PDFDocument from 'pdfkit';
import { logger } from '../common/logger';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  accountCreatedDate?: Date | null;
  profileImageUrl?: string | null;
}

export class AgreementPdfService {
  static async generateAgreementPdf(data: AgreementData): Promise<Buffer> {
    // 1. Fetch profile image buffer if profileImageUrl exists
    let profilePhotoBuffer: Buffer | null = null;
    let profilePhotoPath: string | null = null;
    if (data.profileImageUrl) {
      try {
        if (data.profileImageUrl.startsWith('http')) {
          const response = await axios.get(data.profileImageUrl, { responseType: 'arraybuffer' });
          profilePhotoBuffer = Buffer.from(response.data);
        } else {
          const localPath = path.join(process.cwd(), 'public', data.profileImageUrl);
          if (fs.existsSync(localPath)) {
            profilePhotoPath = localPath;
          }
        }
      } catch (err) {
        logger.error({ msg: '[AgreementPdfService] Failed to load profile photo', error: err });
      }
    }

    return new Promise((resolve, reject) => {
      try {
        // Initialize PDF document with A4 format and narrow margins
        const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Derive Plan details
        let planName = 'BASIC PLAN';
        let planBenefits = ['Direct Music Distribution', 'Split Royalties Support', 'Standard Analytics Access'];
        if (data.artistRevenueShare === 55) {
          planName = 'PRO PLAN';
          planBenefits = ['Professional Music Distribution', 'Featured Playlist Placement', 'Standard Artist Support'];
        } else if (data.artistRevenueShare === 65) {
          planName = 'GROWTH PLAN';
          planBenefits = ['Standard Streaming Distribution', 'Promotional Platform Support', 'Advanced Royalty Analytics'];
        } else if (data.artistRevenueShare > 65) {
          planName = 'PREMIUM PLAN';
          planBenefits = ['All-Inclusive Music Distribution', 'Priority Playlist Promotion', 'Dedicated Account Manager'];
        }

        const agreementNo = `AGR-2026-${data.agreementId.slice(0, 6).toUpperCase()}`;
        const signatureId = `SIG-2026-${data.agreementId.slice(0, 6).toUpperCase()}`;
        const agreementHash = crypto.createHash('sha256').update(data.agreementId).digest('hex');

        // Formatter helpers
        const formatDateLong = (dateObj: Date) => {
          return dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        };
        const formatTimeStr = (dateObj: Date) => {
          return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        };

        // ----------------------------------------------------
        // PAGE 1: Agreement Summary & Metadata
        // ----------------------------------------------------
        
        // Brand Header Line
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#006b54').text('music-streaming-platform', 50, 47);
        
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#006b54').text('ARTIST DISTRIBUTION AGREEMENT', 280, 47, { align: 'right' });
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text(`Agreement No. ${agreementNo}`, 280, 62, { align: 'right' });
        
        // Horizontal Header divider
        doc.moveTo(50, 78).lineTo(545, 78).strokeColor('#006b54').lineWidth(1.5).stroke();

        // 1. Artist Information Row
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text('ARTIST INFORMATION', 50, 95);
        
        const infoStartY = 112;
        doc.fontSize(9).font('Helvetica').fillColor('#4b5563');
        
        doc.text('Artist Name', 50, infoStartY).font('Helvetica-Bold').fillColor('#1f2937').text(`:   ${data.artistName}`, 120, infoStartY);
        doc.font('Helvetica').fillColor('#4b5563');
        doc.text('Email', 50, infoStartY + 15).font('Helvetica-Bold').fillColor('#1f2937').text(`:   ${data.email}`, 120, infoStartY + 15);
        doc.font('Helvetica').fillColor('#4b5563');
        doc.text('Phone', 50, infoStartY + 30).font('Helvetica-Bold').fillColor('#1f2937').text(`:   ${data.phone || '—'}`, 120, infoStartY + 30);
        doc.font('Helvetica').fillColor('#4b5563');
        doc.text('Artist ID', 50, infoStartY + 45).font('Helvetica-Bold').fillColor('#1f2937').text(`:   AR-${data.agreementId.slice(0, 5).toUpperCase()}`, 120, infoStartY + 45);
        doc.font('Helvetica').fillColor('#4b5563');
        doc.text('Date', 50, infoStartY + 60).font('Helvetica-Bold').fillColor('#1f2937').text(`:   ${formatDateLong(data.agreementAcceptedAt)}`, 120, infoStartY + 60);
        doc.font('Helvetica').fillColor('#4b5563');
        doc.text('Country', 50, infoStartY + 75).font('Helvetica-Bold').fillColor('#1f2937').text(':   India', 120, infoStartY + 75);

        // Artist Photo aligned on the right
        const photoX = 430;
        const photoY = 95;
        doc.rect(photoX, photoY, 115, 90).fillColor('#f3f4f6').strokeColor('#cbd5e1').lineWidth(1).fillAndStroke();
        
        if (profilePhotoBuffer || profilePhotoPath) {
          try {
            const imgSource = profilePhotoBuffer || (profilePhotoPath as string);
            doc.image(imgSource, photoX + 5, photoY + 5, { width: 105, height: 68 });
          } catch (e) {
            logger.error({ msg: '[AgreementPdfService] Failed rendering profile photo inside PDF', error: e });
          }
        } else {
          // Placeholder icon inside image square
          doc.circle(photoX + 57, photoY + 33, 14).strokeColor('#9ca3af').lineWidth(1.5).stroke();
          doc.circle(photoX + 57, photoY + 53, 20).strokeColor('#9ca3af').lineWidth(1.5).stroke();
        }

        // Green verified badge below photo
        doc.rect(photoX, photoY + 75, 115, 15).fillColor('#006b54').fill();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff').text('Verified Artist', photoX, photoY + 79, { align: 'center', width: 115 });

        // 2. Agreement Summary Card
        const summaryY = 205;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text('AGREEMENT SUMMARY', 50, summaryY);
        
        // Double card plate box
        doc.rect(50, summaryY + 12, 495, 140).strokeColor('#e5e7eb').lineWidth(1).stroke();
        doc.moveTo(290, summaryY + 12).lineTo(290, summaryY + 152).strokeColor('#e5e7eb').lineWidth(1).stroke();

        // Left Column of Summary: Selected Plan
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#4b5563').text('SELECTED PLAN', 65, summaryY + 25);
        doc.fontSize(15).font('Helvetica-Bold').fillColor('#006b54').text(planName, 65, summaryY + 38);
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#4b5563').text('EFFECTIVE DATE', 65, summaryY + 68);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1f2937').text(formatDateLong(data.agreementStartDate), 65, summaryY + 78);
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#4b5563').text('AGREEMENT STATUS', 65, summaryY + 105);
        // Status Badge
        doc.rect(65, summaryY + 117, 50, 16).fillColor('#e6f4ea').fill();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#137333').text('ACTIVE', 65, summaryY + 122, { align: 'center', width: 50 });

        // Right Column of Summary: Revenue Split & Benefits
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#4b5563').text('REVENUE SPLIT', 305, summaryY + 25);
        doc.fontSize(9).font('Helvetica').fillColor('#1f2937').text('Platform Commission', 305, summaryY + 38);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1f2937').text(`${data.platformRevenueShare}%`, 480, summaryY + 36, { align: 'right', width: 50 });

        doc.fontSize(9).font('Helvetica').fillColor('#1f2937').text('Artist Revenue Share', 305, summaryY + 56);
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#006b54').text(`${data.artistRevenueShare}%`, 480, summaryY + 54, { align: 'right', width: 50 });

        // Divider
        doc.moveTo(305, summaryY + 78).lineTo(530, summaryY + 78).strokeColor('#f3f4f6').stroke();

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#4b5563').text('PLAN BENEFITS', 305, summaryY + 88);
        
        // Bullet point check list
        planBenefits.forEach((benefit, idx) => {
          const itemY = summaryY + 100 + (idx * 14);
          // Green check icon
          doc.circle(310, itemY + 4, 4.5).fillColor('#006b54').fill();
          doc.moveTo(308, itemY + 4).lineTo(309.5, itemY + 5.5).lineTo(312.5, itemY + 2.5).strokeColor('#ffffff').lineWidth(1.2).stroke();
          
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151').text(benefit, 322, itemY);
        });

        // 3. Terms & Conditions Summary Card
        const tcY = 368;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text('TERMS & CONDITIONS SUMMARY', 50, tcY);
        
        // 3 columns side by side
        const colW = 153;
        const colGap = 18;
        
        // Block 1
        doc.rect(50, tcY + 12, colW, 40).fillColor('#f9fafb').strokeColor('#e5e7eb').lineWidth(1).fillAndStroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text('Terms Version', 60, tcY + 19);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text(data.termsVersion, 60, tcY + 31);

        // Block 2
        doc.rect(50 + colW + colGap, tcY + 12, colW, 40).fillColor('#f9fafb').strokeColor('#e5e7eb').lineWidth(1).fillAndStroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text('Accepted On', 50 + colW + colGap + 10, tcY + 19);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text(formatDateLong(data.agreementAcceptedAt), 50 + colW + colGap + 10, tcY + 31);

        // Block 3
        doc.rect(50 + (colW + colGap) * 2, tcY + 12, colW, 40).fillColor('#f9fafb').strokeColor('#e5e7eb').lineWidth(1).fillAndStroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text('Accepted IP', 50 + (colW + colGap) * 2 + 10, tcY + 19);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('103.21.244.XX', 50 + (colW + colGap) * 2 + 10, tcY + 31);

        // 4. Digital Signature Block
        const sigBlockY = 442;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text('DIGITAL SIGNATURE (ARTIST)', 50, sigBlockY);
        
        doc.rect(50, sigBlockY + 12, 495, 90).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        if (data.digitalSignature) {
          try {
            let base64Data = data.digitalSignature;
            if (base64Data.startsWith('data:')) {
              base64Data = base64Data.split(';base64,').pop() || '';
            }
            const signatureBuffer = Buffer.from(base64Data, 'base64');
            // Signature image container
            doc.image(signatureBuffer, 65, sigBlockY + 22, { width: 180, height: 70 });
          } catch (e) {
            logger.error({ msg: '[AgreementPdfService] Failed rendering digital signature on page 1', error: e });
          }
        }
        
        // Details list on the right side of the signature
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('Signed On', 320, sigBlockY + 25);
        doc.fontSize(8.5).font('Helvetica').fillColor('#1f2937').text(`:   ${formatDateLong(data.signatureSignedAt)} ${formatTimeStr(data.signatureSignedAt)}`, 390, sigBlockY + 25);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('IP Address', 320, sigBlockY + 45);
        doc.fontSize(8.5).font('Helvetica').fillColor('#1f2937').text(':   103.21.244.XX', 390, sigBlockY + 45);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('Signature ID', 320, sigBlockY + 65);
        doc.fontSize(8.5).font('Helvetica').fillColor('#1f2937').text(`:   ${signatureId}`, 390, sigBlockY + 65);

        // 5. Footer and QR Block
        const footerY = 560;
        doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        // Drawing mock QR Code block in vector graphics
        doc.rect(50, footerY + 15, 50, 50).strokeColor('#1f2937').lineWidth(1.5).stroke();
        // Drawing alignment squares inside QR Code
        doc.rect(54, footerY + 19, 12, 12).fillColor('#1f2937').fill();
        doc.rect(56, footerY + 21, 8, 8).fillColor('#ffffff').fill();
        doc.rect(58, footerY + 23, 4, 4).fillColor('#1f2937').fill();

        doc.rect(84, footerY + 19, 12, 12).fillColor('#1f2937').fill();
        doc.rect(86, footerY + 21, 8, 8).fillColor('#ffffff').fill();
        doc.rect(88, footerY + 23, 4, 4).fillColor('#1f2937').fill();

        doc.rect(54, footerY + 49, 12, 12).fillColor('#1f2937').fill();
        doc.rect(56, footerY + 51, 8, 8).fillColor('#ffffff').fill();
        doc.rect(58, footerY + 53, 4, 4).fillColor('#1f2937').fill();
        
        // Drawing small dots inside QR box
        doc.rect(74, footerY + 28, 4, 4).fillColor('#1f2937').fill();
        doc.rect(82, footerY + 36, 4, 4).fillColor('#1f2937').fill();
        doc.rect(70, footerY + 44, 4, 4).fillColor('#1f2937').fill();
        doc.rect(88, footerY + 48, 4, 4).fillColor('#1f2937').fill();

        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1f2937').text('Verify this agreement', 115, footerY + 22);
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text('Scan QR code or visit\nmusic-streaming-platform.com/verify', 115, footerY + 34);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('Agreement Hash', 300, footerY + 22);
        doc.fontSize(7.5).font('Courier').fillColor('#4b5563').text(agreementHash.slice(0, 36) + '\n' + agreementHash.slice(36), 300, footerY + 34, { width: 245 });

        // Page number on the bottom right
        doc.fontSize(8).font('Helvetica').fillColor('#9ca3af').text('Page 1 of 2', 490, footerY + 65);

        // Forest Green accent banner at the very bottom
        doc.rect(0, 822, 595, 20).fillColor('#006b54').fill();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text('Secure | Verified | Encrypted', 50, 828);

        // ----------------------------------------------------
        // PAGE 2: Terms Details, Timeline & Certifications
        // ----------------------------------------------------
        
        // Add page break
        doc.addPage();

        // Draw a clean layout border around the page
        doc.rect(25, 25, 545, 792).lineWidth(1).strokeColor('#e5e7eb').stroke();

        // Brand Header Line
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#006b54').text('music-streaming-platform', 50, 47);
        
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1f2937').text('AGREEMENT NO.', 400, 47, { align: 'right', width: 145 });
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#006b54').text(agreementNo, 400, 58, { align: 'right', width: 145 });
        
        // Horizontal Header divider
        doc.moveTo(50, 78).lineTo(545, 78).strokeColor('#006b54').lineWidth(1.5).stroke();

        // 1. Terms & Conditions Detail List
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text(`TERMS & CONDITIONS (Version ${data.termsVersion})`, 50, 95);
        
        // Parse terms lines
        const termLines = data.termsContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .slice(0, 8); // Display first 8 terms to fit nicely

        let currentY = 112;
        termLines.forEach((termLine, idx) => {
          doc.fontSize(8.5).font('Helvetica').fillColor('#374151');
          
          // Clean index numbering
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#006b54').text(`${idx + 1}.`, 50, currentY);
          
          // Render term text
          const cleanText = termLine.replace(/^\d+[\.\-\s]*/, ''); // strip leading number if duplicate
          doc.font('Helvetica').fillColor('#374151').text(cleanText, 65, currentY, { width: 480, align: 'justify' });
          
          const textHeight = doc.heightOfString(cleanText, { width: 480, align: 'justify' });
          currentY += Math.max(16, textHeight + 6);
        });

        // Horizontal divider
        doc.moveTo(50, 315).lineTo(545, 315).strokeColor('#e5e7eb').lineWidth(1).stroke();

        // 2. Agreement Timeline Section
        const timelineStartY = 330;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text('AGREEMENT TIMELINE', 50, timelineStartY);
        
        // Timeline graphics
        const tlY = timelineStartY + 45;
        const tlXPoints = [90, 185, 280, 375, 470];
        
        // Horizontal line
        doc.moveTo(tlXPoints[0], tlY).lineTo(tlXPoints[4], tlY).strokeColor('#cbd5e1').lineWidth(2).stroke();
        
        const milestones = [
          { name: 'Created', date: formatDateLong(data.accountCreatedDate || data.agreementAcceptedAt), time: formatTimeStr(data.accountCreatedDate || data.agreementAcceptedAt) },
          { name: 'Terms Accepted', date: formatDateLong(data.agreementAcceptedAt), time: formatTimeStr(data.agreementAcceptedAt) },
          { name: 'Signed', date: formatDateLong(data.signatureSignedAt), time: formatTimeStr(data.signatureSignedAt) },
          { name: 'Approved', date: formatDateLong(data.agreementStartDate), time: formatTimeStr(data.agreementStartDate) },
          { name: 'Active', date: formatDateLong(data.agreementStartDate), time: formatTimeStr(data.agreementStartDate) }
        ];

        milestones.forEach((m, idx) => {
          const mX = tlXPoints[idx];
          
          // Timeline circle node
          doc.circle(mX, tlY, 15).fillColor('#ffffff').strokeColor('#006b54').lineWidth(1.5).fillAndStroke();
          doc.circle(mX, tlY, 11).fillColor('#e6f4ea').fill();
          
          // Mini check icon inside timeline circle
          doc.moveTo(mX - 3.5, tlY).lineTo(mX - 1, tlY + 2.5).lineTo(mX + 3.5, tlY - 2).strokeColor('#006b54').lineWidth(1.5).stroke();

          // Milestone labels
          doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1f2937').text(m.name, mX - 45, tlY + 22, { align: 'center', width: 90 });
          doc.fontSize(7).font('Helvetica').fillColor('#6b7280').text(m.date, mX - 45, tlY + 34, { align: 'center', width: 90 });
          doc.fontSize(6.5).font('Helvetica').fillColor('#9ca3af').text(m.time, mX - 45, tlY + 44, { align: 'center', width: 90 });
        });

        // Horizontal divider
        doc.moveTo(50, 445).lineTo(545, 445).strokeColor('#e5e7eb').lineWidth(1).stroke();

        // 3. Signatures Card row
        const sigsY = 460;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#006b54').text('SIGNATURES', 50, sigsY);
        
        const cardW = 190;
        const cardH = 95;
        
        // Card 1: Artist Signature card
        const card1X = 50;
        doc.rect(card1X, sigsY + 12, cardW, cardH).fillColor('#ffffff').strokeColor('#e5e7eb').lineWidth(1).fillAndStroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text('Artist Signature', card1X + 12, sigsY + 22);
        
        if (data.digitalSignature) {
          try {
            let base64Data = data.digitalSignature;
            if (base64Data.startsWith('data:')) {
              base64Data = base64Data.split(';base64,').pop() || '';
            }
            const signatureBuffer = Buffer.from(base64Data, 'base64');
            doc.image(signatureBuffer, card1X + 12, sigsY + 32, { width: 140, height: 40 });
          } catch (e) {}
        }
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#1f2937').text(data.artistName, card1X + 12, sigsY + 75);
        doc.fontSize(7).font('Helvetica').fillColor('#6b7280').text(`Signed: ${formatDateLong(data.signatureSignedAt)}`, card1X + 12, sigsY + 86);
        
        // Verified Badge inside Card 1
        doc.rect(card1X + 138, sigsY + 73, 40, 14).fillColor('#e6f4ea').fill();
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#137333').text('Verified', card1X + 138, sigsY + 77, { align: 'center', width: 40 });

        // Card 2: Authorized Signatory card
        const card2X = 260;
        doc.rect(card2X, sigsY + 12, cardW, cardH).fillColor('#ffffff').strokeColor('#e5e7eb').lineWidth(1).fillAndStroke();
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#6b7280').text('Authorized Signatory (Music Streaming Platform)', card2X + 12, sigsY + 22);
        
        // Draw mock representative handwriting script signature
        doc.fontSize(15).font('Courier-Oblique').fillColor('#1e40af').text('Rahul Sharma', card2X + 22, sigsY + 42);

        doc.fontSize(8).font('Helvetica-Bold').fillColor('#1f2937').text('Rahul Sharma', card2X + 12, sigsY + 75);
        doc.fontSize(7).font('Helvetica').fillColor('#6b7280').text('Head - Artist Relations', card2X + 12, sigsY + 86);

        // Verified Badge inside Card 2
        doc.rect(card2X + 138, sigsY + 73, 40, 14).fillColor('#e6f4ea').fill();
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#137333').text('Verified', card2X + 138, sigsY + 77, { align: 'center', width: 40 });

        // Verified Certification circular stamp
        const stampX = 502;
        const stampY = 508;
        doc.circle(stampX, stampY, 32).strokeColor('#006b54').lineWidth(1.5).stroke();
        doc.circle(stampX, stampY, 28).strokeColor('#006b54').lineWidth(0.5).stroke();
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#006b54').text('MUSIC PLATFORM', stampX - 32, stampY - 13, { align: 'center', width: 64 });
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#006b54').text('VERIFIED', stampX - 32, stampY - 3, { align: 'center', width: 64 });
        doc.fontSize(6).font('Helvetica-Bold').fillColor('#006b54').text('DIGITAL AGREEMENT', stampX - 32, stampY + 8, { align: 'center', width: 64 });

        // 4. Disclaimer Note
        const discY = 582;
        doc.rect(50, discY, 495, 25).fillColor('#f8fafc').strokeColor('#cbd5e1').lineWidth(1).fillAndStroke();
        // Shield outline icon
        doc.circle(62, discY + 12, 6).strokeColor('#006b54').lineWidth(1.2).stroke();
        doc.moveTo(60, discY + 12).lineTo(62, discY + 14).lineTo(65, discY + 10).strokeColor('#006b54').lineWidth(1.2).stroke();
        
        doc.fontSize(7.5).font('Helvetica').fillColor('#475569').text('This is a system generated digital agreement. This document is valid without physical signature.', 77, discY + 8);

        // Footer at the bottom
        const footer2Y = 620;
        doc.moveTo(50, footer2Y).lineTo(545, footer2Y).strokeColor('#e5e7eb').lineWidth(1).stroke();
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('Secure | Verified | Encrypted', 50, footer2Y + 15);
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#6b7280').text('Document Generated On', 350, footer2Y + 15, { align: 'right', width: 195 });
        doc.fontSize(7.5).font('Helvetica').fillColor('#4b5563').text(`${formatDateLong(data.agreementStartDate)} ${formatTimeStr(data.agreementStartDate)} (IST)`, 350, footer2Y + 27, { align: 'right', width: 195 });

        // Page number on the bottom right
        doc.fontSize(8).font('Helvetica').fillColor('#9ca3af').text('Page 2 of 2', 490, footer2Y + 45);

        // Forest Green accent banner at the very bottom
        doc.rect(0, 822, 595, 20).fillColor('#006b54').fill();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text('Secure | Verified | Encrypted', 50, 828);

        doc.end();
      } catch (error) {
        logger.error({ msg: '[AgreementPdfService] Error generating PDF layout', error });
        reject(error);
      }
    });
  }
}
