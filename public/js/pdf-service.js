// PDF Generation Service using jsPDF and autoTable

async function fetchImageAsDataURL(url) {
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (err) {
                    resolve(null);
                }
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }
}

export const PDFService = {
    async generateInvoicePDF(hotel, booking, invoice, expenses = []) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const primaryColor = hotel.primary_color || '#0d6efd';

        // Header Background Bar
        doc.setFillColor(primaryColor);
        doc.rect(0, 0, 210, 28, 'F');

        // Hotel Logo rendering if enabled
        const showLogo = hotel.invoice_show_logo !== false && Number(hotel.invoice_show_logo) !== 0;
        let logoXShift = 0;

        if (showLogo && hotel.logo_url) {
            const logoDataUrl = await fetchImageAsDataURL(hotel.logo_url);
            if (logoDataUrl) {
                try {
                    const format = logoDataUrl.includes('image/jpeg') || logoDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG';
                    doc.addImage(logoDataUrl, format, 14, 3, 22, 22);
                    logoXShift = 26;
                } catch (e) {
                    console.warn('doc.addImage error:', e);
                }
            }
        }

        // Hotel Name / Title in Header
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(hotel.name || 'ESTABLECIMIENTO HOTELERO', 14 + logoXShift, 18);

        // Subtitle / Header Notes
        const headerSubtitle = hotel.invoice_header_notes || 'COMPROBANTE DE HOSPEDAJE Y FACTURA DE CONSUMOS';
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(headerSubtitle.toUpperCase(), 196, 18, { align: 'right' });

        // Hotel RIF & Contact Info
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        let currentY = 36;
        doc.setFont('helvetica', 'bold');
        doc.text(`RIF: ${hotel.rif || 'J-00000000-0'}`, 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(`Teléfono: ${hotel.phone || 'N/A'}`, 14, currentY + 5);
        doc.text(`Dirección: ${hotel.address || 'N/A'}`, 14, currentY + 10);

        // Invoice Serial & BCV Info Box
        const prefix = hotel.invoice_prefix || 'FAC-';
        const rawInvNum = invoice.invoice_number || invoice.invoiceNumber || '000001';
        const formattedNum = rawInvNum.startsWith(prefix) ? rawInvNum : `${prefix}${rawInvNum}`;

        doc.setFont('helvetica', 'bold');
        doc.text(`COMPROBANTE N°: ${formattedNum}`, 140, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha Emisión: ${new Date(invoice.created_at || Date.now()).toLocaleDateString('es-VE')}`, 140, currentY + 5);
        doc.text(`Tasa Oficial BCV: Bs. ${Number(invoice.bcv_rate || invoice.bcvRate || 40.0).toFixed(4)} / USD`, 140, currentY + 10);

        // Divider Line
        doc.setDrawColor(200, 200, 200);
        doc.line(14, currentY + 16, 196, currentY + 16);

        // Guest & Booking Details Box
        currentY += 24;
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(14, currentY, 182, 28, 3, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('DATOS DEL HUÉSPED Y ESTANCIA', 18, currentY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Huésped: ${booking.guest_name || booking.guestName}`, 18, currentY + 14);
        doc.text(`Documento: ${booking.document_type || 'V'}-${booking.document_id || booking.documentId}`, 18, currentY + 20);

        doc.text(`Habitación: N° ${booking.room_number || booking.roomNumber} (${booking.room_type_name || 'Estándar'})`, 110, currentY + 14);
        doc.text(`Período: ${booking.check_in_date} al ${booking.check_out_date}`, 110, currentY + 20);

        // Table Items
        currentY += 34;

        const tableBody = [
            [
                'Hospedaje - Tarifa Habitación',
                `Estancia del ${booking.check_in_date} al ${booking.check_out_date}`,
                `$${Number(invoice.subtotal_usd || invoice.subtotalUsd).toFixed(2)} USD`,
                `Bs. ${(Number(invoice.subtotal_usd || invoice.subtotalUsd) * Number(invoice.bcv_rate || invoice.bcvRate || 40.0)).toFixed(2)}`
            ]
        ];

        expenses.forEach(e => {
            tableBody.push([
                `Consumo Extra (${e.department_name || 'Servicio General'})`,
                e.description,
                `$${Number(e.amount_usd).toFixed(2)} USD`,
                `Bs. ${(Number(e.amount_usd) * Number(invoice.bcv_rate || invoice.bcvRate || 40.0)).toFixed(2)}`
            ]);
        });

        doc.autoTable({
            startY: currentY,
            head: [['Concepto / Servicio', 'Descripción', 'Monto USD', 'Monto VES (BCV)']],
            body: tableBody,
            headStyles: { fillColor: primaryColor, textColor: 255 },
            styles: { fontSize: 9 },
            theme: 'striped'
        });

        const finalY = doc.lastAutoTable.finalY + 10;

        // Totals Box (Right Aligned at 196mm margin)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text(`Subtotal Hospedaje: $${Number(invoice.subtotal_usd || invoice.subtotalUsd).toFixed(2)} USD`, 196, finalY, { align: 'right' });
        doc.text(`Total Consumos Extras: $${Number(invoice.total_expenses_usd || invoice.totalExpensesUsd || 0).toFixed(2)} USD`, 196, finalY + 5, { align: 'right' });
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(13, 110, 253);
        doc.text(`TOTAL GENERAL USD: $${Number(invoice.total_usd || invoice.totalUsd).toFixed(2)} USD`, 196, finalY + 12, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setTextColor(25, 135, 84);
        doc.text(`TOTAL EN BOLÍVARES: Bs. ${Number(invoice.total_ves || invoice.totalVes).toFixed(2)}`, 196, finalY + 18, { align: 'right' });

        // Payment Condition / Status Badge
        const rawStatus = invoice.payment_status || 'PAID';
        const pStatus = rawStatus === 'PAID' ? 'PAGADO' :
                        rawStatus === 'CREDIT' ? 'CRÉDITO / PENDIENTE' :
                        rawStatus === 'VOIDED' ? 'ANULADA / NULA' :
                        rawStatus === 'REFUNDED' ? 'DEVOLUCIÓN / NOTA DE CRÉDITO' : 'PAGADO';

        const pColor = rawStatus === 'PAID' ? [25, 135, 84] :
                       rawStatus === 'CREDIT' ? [255, 193, 7] :
                       rawStatus === 'VOIDED' ? [220, 53, 69] : [111, 66, 193];

        doc.setFillColor(...pColor);
        doc.roundedRect(14, finalY, 95, 16, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`CONDICIÓN: ${pStatus}`, 18, finalY + 10);

        // Footer Custom Notes or Legal Disclaimer
        const footerNote = hotel.invoice_footer_notes || 'Valores liquidados a la Tasa Oficial de Cambio emitida por el Banco Central de Venezuela (BCV). Gracias por su preferencia.';
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'italic');
        doc.text(footerNote, 14, 280, { maxWidth: 180 });

        // Save PDF file
        const safeHotelName = (hotel.name || 'Hotel').replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
        const fileName = `Factura_${safeHotelName}_${formattedNum}.pdf`;
        doc.save(fileName);
    }
};
