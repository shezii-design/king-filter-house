import { jsPDF } from 'jspdf';
import { Invoice, Quotation } from '../types';

// Local storage reader for customized shop info configuration
export const getShopInfoFromStorage = () => {
  const stored = localStorage.getItem('kfh_shop_info');
  const parsed = stored ? JSON.parse(stored) : null;
  return {
    name: (parsed?.name || 'King Filter House FSD').trim(),
    address: (parsed?.address || 'Auto Plaza, Jail Road, Faisalabad, Punjab, Pakistan').trim(),
    phone: (parsed?.phone || '').trim(),
    invoicePrefix: (parsed?.invoicePrefix || 'INV').trim(),
    poPrefix: (parsed?.poPrefix || 'PO').trim(),
    quotePrefix: (parsed?.quotePrefix || 'QT').trim(),
    returnPrefix: (parsed?.returnPrefix || 'RET').trim(),
    currencySymbol: (parsed?.currencySymbol || 'Rs.').trim(),
    mapsLink: (parsed?.mapsLink || 'https://maps.google.com').trim(),
    ownerPhones: Array.isArray(parsed?.ownerPhones) ? parsed.ownerPhones : ['+92-300-6644634'],
    managerPhones: Array.isArray(parsed?.managerPhones) ? parsed.managerPhones : ['+92-300-1234567'],
    ownerName: localStorage.getItem('kfh_owner_name') || 'Shahzar',
    managerName: localStorage.getItem('kfh_manager_name') || 'Shop Manager'
  };
};

const formatCurrency = (amt: number, currencySymbol: string = 'Rs.') => {
  return currencySymbol + ' ' + amt.toLocaleString('en-US');
};

const limitString = (str: string, maxChar: number) => {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.length > maxChar ? trimmed.substring(0, maxChar - 3) + '...' : trimmed;
};

// Generates a beautiful vector location pin next to the Maps Link
const drawLocationPinIcon = (doc: jsPDF, x: number, y: number) => {
  // Set fill color to nice Google Maps Crimson Red
  doc.setFillColor(239, 68, 68); 
  // Draw the circular pin head
  doc.ellipse(x, y - 1.2, 1.1, 1.1, 'F');
  // Draw down triangle for the pinpoint
  doc.triangle(x - 0.9, y - 1.0, x + 0.9, y - 1.0, x, y + 1.2, 'F');
  // White hollow center dot
  doc.setFillColor(255, 255, 255);
  doc.ellipse(x, y - 1.2, 0.4, 0.4, 'F');
};

// Generates an elegant handwritten-style black gel pen ink signature for the manager
const drawManagerSignature = (doc: jsPDF, x: number, y: number) => {
  const customSig = localStorage.getItem('kfh_signature_pad_data');
  const sizeStr = localStorage.getItem('kfh_signature_width') || '50';
  const width = parseFloat(sizeStr);
  const height = width / 3; // Maintain 3:1 signature aspect ratio

  // Better centering offset based on custom width to keep signature aligned over lines
  const xOffset = -(width - 54) / 2 - 5;
  const yTop = y - height * 0.70;

  if (customSig && customSig.startsWith('data:image/')) {
    try {
      doc.addImage(customSig, 'PNG', x + xOffset, yTop, width, height);
      return;
    } catch (e) {
      console.error(`Failed to render manager signature image:`, e);
    }
  }

  // Fallback signature in pure professional black ink
  const userName = localStorage.getItem('kfh_manager_name') || 'Shop Manager';
  const typedStyle = localStorage.getItem('kfh_signature_style') || 'elegant';
  
  doc.setTextColor(17, 24, 39);
  let fontStyle = 'italic';
  if (typedStyle === 'bold') {
    fontStyle = 'bolditalic';
  }
  
  doc.setFont('Times', fontStyle);
  
  // Font scale adapts slightly with chosen width slider
  const baseFontSize = 18 * (width / 45);
  doc.setFontSize(Math.max(11, Math.min(28, baseFontSize)));
  doc.text(userName, x + 2, y - 0.5);
};

// Generates an official physical-look company circular stamp overlay
const drawOfficialStamp = (doc: jsPDF, x: number, y: number, text: string, type: 'paid' | 'due' | 'estimate', shopName: string) => {
  // Color presets
  let drawColor = [21, 128, 61]; // emerald green-ish
  let colorString = '#15803D'; // Emerald green for PAID
  if (type === 'due') {
    drawColor = [220, 38, 38];
    colorString = '#DC2626'; // Crimson red for Balance Due
  } else if (type === 'estimate') {
    drawColor = [59, 130, 246];
    colorString = '#3B82F6'; // Regal blue for Quotation estimates
  }
  
  // Create offscreen canvas for high-quality stamp generation
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Enable clean high-res rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    const cx = 180;
    const cy = 180;
    
    ctx.strokeStyle = colorString;
    ctx.fillStyle = colorString;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw outer circle rings (Concentric ring patterns matching IDEAS logo)
    // Outer bold ring
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 168, 0, Math.PI * 2);
    ctx.stroke();
    
    // Sub-outer thin ring
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 154, 0, Math.PI * 2);
    ctx.stroke();

    // Helper function for mathematically perfect text along a circular arc
    const drawPreciseTextOnArc = (
      txt: string,
      radius: number,
      centerAngleRad: number,
      fontSize: number,
      charSpacing: number
    ) => {
      ctx.font = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      const chars = txt.toUpperCase().split('');
      if (chars.length === 0) return;

      const widths = chars.map(c => ctx.measureText(c).width);
      const totalWidth = widths.reduce((s, w) => s + w, 0) + (chars.length - 1) * charSpacing;
      const totalAngle = totalWidth / radius;

      // Start angle centered relative to the centerAngleRad
      let currentAngleRad = centerAngleRad - totalAngle / 2;

      chars.forEach((char, idx) => {
        const charWidth = widths[idx];
        const angleRad = currentAngleRad + (charWidth / 2) / radius;

        const charX = cx + radius * Math.cos(angleRad);
        const charY = cy + radius * Math.sin(angleRad);

        ctx.save();
        ctx.translate(charX, charY);
        // Both top and bottom text share the exact same outward-facing orientation vector!
        ctx.rotate(angleRad + Math.PI / 2);
        ctx.fillText(char, 0, 0);
        ctx.restore();

        // Advance angle for next character
        currentAngleRad += (charWidth + charSpacing) / radius;
      });
    };

    // Draw Top Text (Shop Name)
    const upperText = limitString(shopName.toUpperCase(), 24);
    drawPreciseTextOnArc(upperText, 122, -Math.PI / 2, 22, 3.5);

    // Draw Bottom Text (GENERAL TRADING)
    const bottomText = '★ GENERAL TRADING ★';
    drawPreciseTextOnArc(bottomText, 122, Math.PI / 2, 19, 3.2);

    // Draw elegant stars flanking the center separator lines (similar to IDEAS stamp image)
    ctx.font = '900 18px Helvetica, Arial, sans-serif';
    ctx.fillText('★', cx, cy - 48);
    ctx.fillText('★', cx, cy + 44);

    // Draw horizontal solid borders around center text like the IDEAS reference
    ctx.lineWidth = 2.4;
    
    // Top separator bar
    ctx.beginPath();
    ctx.moveTo(cx - 95, cy - 32);
    ctx.lineTo(cx + 95, cy - 32);
    ctx.stroke();
    
    // Bottom separator bar
    ctx.beginPath();
    ctx.moveTo(cx - 95, cy + 32);
    ctx.lineTo(cx + 95, cy + 32);
    ctx.stroke();
    
    // Draw center stamp text (PAID, BAL DUE, ESTIMATE)
    ctx.font = '900 48px "Arial Black", Impact, Helvetica, sans-serif';
    ctx.fillText(text.toUpperCase(), cx, cy - 1);
    
    // Add subtle vintage stamp grunge texture overlays to make it authentic (rubber stamp style)
    ctx.strokeStyle = colorString;
    ctx.lineWidth = 1.0;
    
    ctx.beginPath();
    ctx.moveTo(cx - 150, cy - 30);
    ctx.lineTo(cx - 142, cy - 28);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(cx + 120, cy + 60);
    ctx.lineTo(cx + 128, cy + 63);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 40, cy + 140);
    ctx.lineTo(cx - 32, cy + 142);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', x - 15, y - 15, 30, 30);
  } else {
    // Fallback if canvas is not supported (unlikely)
    doc.setDrawColor(drawColor[0], drawColor[1], drawColor[2]);
    doc.setTextColor(drawColor[0], drawColor[1], drawColor[2]);
    doc.setLineWidth(0.4);
    doc.circle(x, y, 12, 'S');
    doc.setLineWidth(0.18);
    doc.circle(x, y, 11, 'S');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(text, x, y + 1.2, { align: 'center' });
  }
};

const drawPDFHeader = (doc: jsPDF, title: string, documentNum: string, yPos: number): number => {
  const shop = getShopInfoFromStorage();

  // Brand Header Primary Crimson Accent Line
  doc.setFillColor(230, 34, 44); // Crimson King Red
  doc.rect(15, yPos, 180, 8, 'F');
  
  // Type indicator label inside the header box
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), 20, yPos + 5.5);
  doc.text(documentNum, 190, yPos + 5.5, { align: 'right' });

  // Core brand title block
  let currY = yPos + 16;
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16.5);
  doc.setTextColor(17, 24, 39); // Gray 900 slate
  doc.text(shop.name.toUpperCase(), 15, currY);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(100, 116, 139); // Slate-gray
  doc.text('Importer & Specialist in All Automotive, Industrial & Earthmoving Filtration Systems', 15, currY + 4.2);

  // Corporate coordinate addresses (dynamically fetched)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text('OFFICE & TRADING OUTLET:', 15, currY + 10.5);
  doc.setFont('Helvetica', 'normal');
  
  // Wrap physical address to fit nicely
  const wrappedAddress = doc.splitTextToSize(shop.address, 130);
  doc.text(wrappedAddress, 15, currY + 14.5);
  
  const addressLinesHeight = wrappedAddress.length * 4;
  const ownerLabel = shop.ownerName || 'Owner';
  const managerLabel = shop.managerName || 'Manager';
  const ownerPhoneLines = shop.ownerPhones && shop.ownerPhones.length > 0 ? `${ownerLabel}: ${shop.ownerPhones.slice(0, 2).join(', ')}` : '';
  const managerPhoneLines = shop.managerPhones && shop.managerPhones.length > 0 ? `${managerLabel}: ${shop.managerPhones.slice(0, 2).join(', ')}` : '';
  
  let contactTexts = [];
  if (shop.phone && shop.phone.trim()) {
    contactTexts.push(`Landline: ${shop.phone}`);
  }
  if (ownerPhoneLines) {
    contactTexts.push(ownerPhoneLines);
  }
  if (managerPhoneLines) {
    contactTexts.push(managerPhoneLines);
  }
  
  const phoneMsg = contactTexts.length > 0 ? `Phone Contacts:  ${contactTexts.join('  |  ')}` : '';
  doc.text(phoneMsg, 15, currY + 14.5 + addressLinesHeight);

  // Thin double grey rule division bar
  doc.setDrawColor(218, 222, 229);
  doc.setLineWidth(0.35);
  const lineY = currY + 17.5 + addressLinesHeight;
  doc.line(15, lineY, 195, lineY);
  doc.setLineWidth(0.15);
  doc.line(15, lineY + 1.2, 195, lineY + 1.2);

  return lineY + 6;
};

export const generateInvoicePDF = (invoice: Invoice) => {
  const shop = getShopInfoFromStorage();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let curY = 15;
  curY = drawPDFHeader(doc, 'Commercial Sales Invoice', invoice.invoice_number, curY);

  // Stamp determination variables
  const balanceDue = Math.max(0, invoice.net_amount - invoice.received_amount);
  const isPaidFully = balanceDue <= 0;

  // Render top metadata columns aligned grid
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(230, 34, 44);
  doc.text('BILL TO CLIENT:', 15, curY);
  doc.text('INVOICE PARAMETERS:', 115, curY);

  curY += 5.2;
  doc.setFontSize(9);
  
  // Row 1
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('Customer Name:', 15, curY);
  doc.text('Invoice Ref ID:', 115, curY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(limitString(invoice.customer_name, 34), 45, curY);
  doc.text(invoice.invoice_number, 148, curY);

  // Row 2
  curY += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Client Account:', 15, curY);
  doc.text('Payment Method:', 115, curY);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const clientAccount = invoice.party_id ? invoice.party_id : 'Walk-In Cash Customer';
  doc.text(limitString(clientAccount, 34), 45, curY);
  doc.text((invoice.payment_method || 'cash').toUpperCase(), 148, curY);

  // Row 3
  curY += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Operator Log Key:', 15, curY);
  doc.text('Invoicing Date:', 115, curY);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Sales staff (${limitString(invoice.user, 15)})`, 45, curY);
  doc.text(new Date(invoice.timestamp).toLocaleDateString(), 148, curY);

  // Row 4
  curY += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Device Hub Sync:', 15, curY);
  doc.text('Account Status:', 115, curY);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Verified cloud transaction server', 45, curY);
  doc.text((invoice.payment_status || (isPaidFully ? 'paid' : 'partial')).toUpperCase(), 148, curY);

  curY += 7.5;

  // TABLE ITEMS RENDER SECTION
  doc.setFillColor(30, 41, 59); // Crisp deep-charcoal grey column header
  doc.rect(15, curY, 180, 7.5, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255); // White header text
  doc.text('PART NUMBER / SPECIFICATION', 17, curY + 5);
  doc.text('QTY', 135, curY + 5, { align: 'right' });
  doc.text('UNIT PRICE', 160, curY + 5, { align: 'right' });
  doc.text('LINE TOTAL', 193, curY + 5, { align: 'right' });

  curY += 7.5;

  // Render individual item entries with beautiful alternating zebra color
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  invoice.items.forEach((item, index) => {
    // Overflow redirection check
    if (curY > 248) {
      doc.addPage();
      curY = 15;
      curY = drawPDFHeader(doc, 'Sales Invoice Continuation', invoice.invoice_number, curY);
      
      // Secondary title header render
      doc.setFillColor(30, 41, 59);
      doc.rect(15, curY, 180, 7.5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text('PART NUMBER / SPECIFICATION', 17, curY + 5);
      doc.text('QTY', 135, curY + 5, { align: 'right' });
      doc.text('UNIT PRICE', 160, curY + 5, { align: 'right' });
      doc.text('LINE TOTAL', 193, curY + 5, { align: 'right' });
      
      curY += 7.5;
    }

    // Dynamic light blue-grey background rectangle for elegant zebra styling
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252); // Light grey stripe
      doc.rect(15, curY, 180, 8, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(15, curY, 180, 8, 'F');
    }

    // Write row columns text
    doc.setFont('Helvetica', 'bold'); // Helvetica Bold for specifications
    doc.setTextColor(15, 23, 42);
    doc.text(limitString(item.part_number, 50), 17, curY + 5.2);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${item.qty} pcs`, 135, curY + 5.2, { align: 'right' });
    doc.text(item.sale_price.toLocaleString(), 160, curY + 5.2, { align: 'right' });
    
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.line_total.toLocaleString(), 193, curY + 5.2, { align: 'right' });

    // Underline divider divider
    doc.setDrawColor(226, 232, 240); // Soft grey division line
    doc.setLineWidth(0.25);
    doc.line(15, curY + 8, 195, curY + 8);

    curY += 8;
  });

  // SUMMATION TOTALS SECTION
  curY += 4;
  if (curY > 190) {
    doc.addPage();
    curY = 20;
    curY = drawPDFHeader(doc, 'Sales Invoice Summary', invoice.invoice_number, curY);
  }

  // Draw totals calculation box
  const boxWidth = 85;
  const boxX = 110;
  const hasDiscount = invoice.discount > 0;
  const boxHeight = hasDiscount ? 30 : 23;
  
  doc.setFillColor(248, 250, 252);
  doc.rect(boxX, curY, boxWidth, boxHeight, 'F');
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.35);
  doc.rect(boxX, curY, boxWidth, boxHeight, 'S');

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(71, 85, 105);
  
  let labelY = curY + 5;
  doc.text('Subtotal Gross Amnt:', boxX + 4, labelY);
  doc.text(formatCurrency(invoice.total_amount, shop.currencySymbol), boxX + boxWidth - 4, labelY, { align: 'right' });

  if (hasDiscount) {
    labelY += 5.2;
    doc.text('Discount Deductions:', boxX + 4, labelY);
    doc.setTextColor(220, 38, 38);
    doc.text('- ' + formatCurrency(invoice.discount, shop.currencySymbol), boxX + boxWidth - 4, labelY, { align: 'right' });
    doc.setTextColor(71, 85, 105);
  }

  labelY += 5.8;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Grand Total Net Amnt:', boxX + 4, labelY);
  doc.text(formatCurrency(invoice.net_amount, shop.currencySymbol), boxX + boxWidth - 4, labelY, { align: 'right' });

  labelY += 5.8;
  doc.setTextColor(21, 128, 61); // Emerald Green
  doc.text('Amount Received:', boxX + 4, labelY);
  doc.text(formatCurrency(invoice.received_amount, shop.currencySymbol), boxX + boxWidth - 4, labelY, { align: 'right' });

  // Stamp is now drawn in the official Signature block at the bottom right for pristine authorized placement

  // Draw outstanding credit alarm if any
  if (balanceDue > 0) {
    curY += (hasDiscount ? 33 : 26);
    doc.setFillColor(254, 242, 242); // Soft red background alert
    doc.rect(boxX, curY, boxWidth, 8, 'F');
    doc.setDrawColor(248, 113, 113); // Red line border
    doc.rect(boxX, curY, boxWidth, 8, 'S');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);
    doc.text('DEFERRED INTEREST DUE:', boxX + 4, curY + 5.5);
    doc.text(formatCurrency(balanceDue, shop.currencySymbol), boxX + boxWidth - 4, curY + 5.5, { align: 'right' });
    curY += 12;
  } else {
    curY += (hasDiscount ? 33 : 26);
  }

  // Ensure safe spacing before guidelines
  if (curY > 210) {
    doc.addPage();
    curY = 20;
    curY = drawPDFHeader(doc, 'Sales Invoice Annexure', invoice.invoice_number, curY);
  }

  // Terms and details block
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('TERMS & SALE SYSTEM GUIDELINES:', 15, curY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('1. All filtration items must be verified against specification logs within 3 business days of delivery.', 15, curY + 4.2);
  doc.text('2. Sealed products returned within 7 calendar days support item trade replacements. Cash refunds are disallowed.', 15, curY + 8.2);
  doc.text('3. Physical modifications or filters with signs of installation usage are strictly ineligible for replacement.', 15, curY + 12.2);

  // Dynamic business footer block with maps link if provided (no unicode emojis for 100% correct text)
  let footerY = curY + 18;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Thank you for choosing ${shop.name}! We appreciate your continued business.`, 15, footerY);
  
  if (shop.mapsLink && shop.mapsLink.startsWith('http')) {
    // Draw beautiful vector red pin marker
    drawLocationPinIcon(doc, 16.5, footerY + 3.8);

    doc.setTextColor(24, 118, 211); // Professional blue link
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.textWithLink('Click Me for Location & Shop Route Directions', 19.5, footerY + 4.2, { url: shop.mapsLink });
    // Thin blue link underline decoration
    doc.setDrawColor(24, 118, 211);
    doc.setLineWidth(0.2);
    doc.line(19.5, footerY + 4.9, 87, footerY + 4.9);
  }

  // Symmetric Double Signature Blocks
  const sigY = curY + 36;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  
  // Left: Receiver Approval Sign Line
  doc.line(15, sigY, 70, sigY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('GOOD RECEIVED IN CONDITION SIGNATURE', 15, sigY + 3.8);
  
  // Right: Manager Authorized Sign Line
  doc.line(140, sigY, 195, sigY);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text(`FOR ${shop.name.toUpperCase()} MANAGER`, 140, sigY + 3.8);
  
  // Draw official paid/due stamp beautifully overlapping or adjacent to signature
  drawOfficialStamp(doc, 110, sigY - 14, isPaidFully ? 'PAID' : 'BAL DUE', isPaidFully ? 'paid' : 'due', shop.name);

  // Overlay single Manager custom signature or fallback
  drawManagerSignature(doc, 145, sigY);

  doc.save(`Invoice_${invoice.invoice_number}.pdf`);
};

export const generateQuotationPDF = (quote: Quotation) => {
  const shop = getShopInfoFromStorage();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let curY = 15;
  curY = drawPDFHeader(doc, 'Commercial Quotation Draft', quote.quote_number, curY);

  // Render top metadata columns aligned grid
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(230, 34, 44);
  doc.text('PROPOSAL PREPARED FOR:', 15, curY);
  doc.text('ESTIMATE PARAMETERS & DATE:', 115, curY);

  curY += 5.2;
  doc.setFontSize(9);
  
  // Row 1
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Proposed Buyer:', 15, curY);
  doc.text('Estimate Ref ID:', 115, curY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(limitString(quote.customer_name, 34), 45, curY);
  doc.text(quote.quote_number, 148, curY);

  // Row 2
  curY += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Account Tier:', 15, curY);
  doc.text('Proposal Date:', 115, curY);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const tierText = quote.customer_type === 'shopkeeper' ? 'Shopkeeper Ledger Account' : 'Retail Walk-In Rate Card';
  doc.text(tierText, 45, curY);
  doc.text(new Date(quote.timestamp).toLocaleDateString(), 148, curY);

  // Row 3
  curY += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Client ID Key:', 15, curY);
  doc.text('Validity Limit:', 115, curY);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const clientRef = quote.party_id ? quote.party_id : 'Walk-In Customer Draft Proposal';
  doc.text(limitString(clientRef, 34), 45, curY);
  
  const expiryStr = new Date(quote.expiry_date).toLocaleDateString();
  doc.text(`${quote.validity_days} Days (Exp: ${expiryStr})`, 148, curY);

  curY += 7.5;

  // TABLE ITEMS RENDER SECTION
  doc.setFillColor(30, 41, 59); // Charcoal Black
  doc.rect(15, curY, 180, 7.5, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('PART NUMBER / SPECIFICATION', 17, curY + 5);
  doc.text('PROPOSED QTY', 135, curY + 5, { align: 'right' });
  doc.text('PROPOSAL PRICE', 160, curY + 5, { align: 'right' });
  doc.text('EST. LINE TOTAL', 193, curY + 5, { align: 'right' });

  curY += 7.5;

  // Render individual item entries with zebra background highlight
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  quote.items.forEach((item, index) => {
    // Continuation support
    if (curY > 248) {
      doc.addPage();
      curY = 15;
      curY = drawPDFHeader(doc, 'Quotation Continuation', quote.quote_number, curY);
      
      doc.setFillColor(30, 41, 59);
      doc.rect(15, curY, 180, 7.5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text('PART NUMBER / SPECIFICATION', 17, curY + 5);
      doc.text('PROPOSED QTY', 135, curY + 5, { align: 'right' });
      doc.text('PROPOSAL PRICE', 160, curY + 5, { align: 'right' });
      doc.text('EST. LINE TOTAL', 193, curY + 5, { align: 'right' });
      
      curY += 7.5;
    }

    // Dynamic blue-grey zebra strips
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(15, curY, 180, 8, 'F');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(15, curY, 180, 8, 'F');
    }

    doc.setFont('Helvetica', 'bold'); // Helvetica Bold for specifications
    doc.setTextColor(15, 23, 42);
    doc.text(limitString(item.part_number, 50), 17, curY + 5.2);
    
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`${item.qty} pcs`, 135, curY + 5.2, { align: 'right' });
    doc.text(item.sale_price.toLocaleString(), 160, curY + 5.2, { align: 'right' });
    
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.line_total.toLocaleString(), 193, curY + 5.2, { align: 'right' });

    // Under-border line division
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(15, curY + 8, 195, curY + 8);

    curY += 8;
  });

  // SUMMATION TOTALS SECTION
  curY += 4;
  if (curY > 190) {
    doc.addPage();
    curY = 20;
    curY = drawPDFHeader(doc, 'Quotation Summary', quote.quote_number, curY);
  }

  // Draw totals grid box
  const boxWidth = 85;
  const boxX = 110;
  doc.setFillColor(248, 250, 252);
  doc.rect(boxX, curY, boxWidth, 13, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.rect(boxX, curY, boxWidth, 13, 'S');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  
  let labelY = curY + 8.2;
  doc.text('Total Estimate Valuation:', boxX + 4, labelY);
  doc.text(formatCurrency(quote.total_amount, shop.currencySymbol), boxX + boxWidth - 4, labelY, { align: 'right' });

  // Stamp is now drawn in the official Signature block at the bottom right for pristine authorized placement

  curY += 18;

  // Notes/Instructions box
  if (quote.notes) {
    if (curY > 215) {
      doc.addPage();
      curY = 20;
    }
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text('CUSTOMER MEMORANDUM & SPECIAL COMMUNIQUE:', 15, curY);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    
    // Auto lines split-wrap
    const textLines = doc.splitTextToSize(quote.notes, 180);
    doc.text(textLines, 15, curY + 4.5);
    curY += textLines.length * 4.5 + 6;
  }

  // Ensure safe spacing before terms layout
  if (curY > 218) {
    doc.addPage();
    curY = 20;
  }

  // Terms and details block
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('PROPOSAL PARAMETERS & SYSTEM DISCLAIMERS:', 15, curY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Quoted price indexes represent current baseline structures reflecting market streams. Valid during specified term days only.', 15, curY + 4.2);
  doc.text('2. Actual delivery supply commitments are conditional upon physical core inventory counts at the exact moment of formal sale transaction.', 15, curY + 8.2);
  doc.text('3. This is a pro-forma commercial quotation draft and does not constitute a sales demand, receipt, or current ledger debt obligations.', 15, curY + 12.2);

  // Dynamic business footer block with maps link if provided
  let footerY = curY + 18;
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Thank you for choosing ${shop.name}! We appreciate your continued business.`, 15, footerY);
  
  if (shop.mapsLink && shop.mapsLink.startsWith('http')) {
    // Draw beautiful vector red pin marker
    drawLocationPinIcon(doc, 16.5, footerY + 3.8);

    doc.setTextColor(24, 118, 211); // Blue link
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.textWithLink('Click Me for Location & Shop Route Directions', 19.5, footerY + 4.2, { url: shop.mapsLink });
    // Thin blue underline link decoration
    doc.setDrawColor(24, 118, 211);
    doc.setLineWidth(0.2);
    doc.line(19.5, footerY + 4.9, 87, footerY + 4.9);
  }

  // Symmetric Double Signature Blocks
  const sigY = curY + 36;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  
  // Left: Customer approval estimate draft lines
  doc.line(15, sigY, 70, sigY);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENT SIGNATURE OF ESTIMATE ACCEPTANCE', 15, sigY + 3.8);
  
  // Right: Manager Authorized Sign Line
  doc.line(140, sigY, 195, sigY);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text(`FOR ${shop.name.toUpperCase()} MANAGER`, 140, sigY + 3.8);
  
  // Draw official ESTIMATE stamp beautifully overlapping or adjacent to signature
  drawOfficialStamp(doc, 110, sigY - 14, 'ESTIMATE', 'estimate', shop.name);

  // Overlay single Manager custom signature or fallback
  drawManagerSignature(doc, 145, sigY);

  doc.save(`Quotation_${quote.quote_number}.pdf`);
};
