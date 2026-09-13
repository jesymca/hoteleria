// PDF Generation Service using jsPDF and autoTable
export const PDFService = {
    async generateInvoicePDF(hotel, booking, invoice, expenses = []) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const primaryColor = hotel.primary_color || '#0d6efd';

        // Header Background Bar
        doc.setFillColor(primaryColor);
        doc.rect(0, 0, 210, 28, 'F');

        // Hotel Name in Header
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(hotel.name || 'ESTABLECIMIENTO HOTELERO', 14, 18);

        // Subtitle
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('COMPROBANTE DE HOSPEDAJE Y FACTURA DE CONSUMOS', 140, 18);

        // Hotel RIF & Contact Info
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        let currentY = 36;
        doc.setFont('helvetica', 'bold');
        doc.text(`RIF: ${hotel.rif || 'J-00000000-0'}`, 14, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(`Teléfono: ${hotel.phone || 'N/A'}`, 14, currentY + 5);
        doc.text(`Dirección: ${hotel.address || 'N/A'}`, 14, currentY + 10);

        // Invoice Number & BCV Info Box
        doc.setFont('helvetica', 'bold');
        doc.text(`FACTURA N°: ${invoice.invoice_number || invoice.invoiceNumber}`, 140, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}`, 140, currentY + 5);
        doc.text(`Tasa Oficial BCV: Bs. ${Number(invoice.bcv_rate || invoice.bcvRate).toFixed(4)} / USD`, 140, currentY + 10);

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
                `Bs. ${(Number(invoice.subtotal_usd || invoice.subtotalUsd) * Number(invoice.bcv_rate || invoice.bcvRate)).toFixed(2)}`
            ]
        ];

        expenses.forEach(e => {
            tableBody.push([
                `Consumo Extra (${e.department_name || 'Servicio General'})`,
                e.description,
                `$${Number(e.amount_usd).toFixed(2)} USD`,
                `Bs. ${(Number(e.amount_usd) * Number(invoice.bcv_rate || invoice.bcvRate)).toFixed(2)}`
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

        // Totals Box
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`Subtotal Hospedaje: $${Number(invoice.subtotal_usd || invoice.subtotalUsd).toFixed(2)} USD`, 130, finalY);
        doc.text(`Total Consumos Extras: $${Number(invoice.total_expenses_usd || invoice.totalExpensesUsd || 0).toFixed(2)} USD`, 130, finalY + 6);
        
        doc.setFontSize(12);
        doc.setTextColor(13, 110, 253);
        doc.text(`TOTAL GENERAL USD: $${Number(invoice.total_usd || invoice.totalUsd).toFixed(2)} USD`, 130, finalY + 14);
        
        doc.setTextColor(25, 135, 84);
        doc.text(`TOTAL EN BOLÍVARES: Bs. ${Number(invoice.total_ves || invoice.totalVes).toFixed(2)}`, 130, finalY + 22);

        // Footer Note
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'italic');
        doc.text('Valores liquidados a la Tasa Oficial de Cambio emitida por el Banco Central de Venezuela (BCV). Gracias por su preferencia.', 14, 280);

        // Save PDF file
        const fileName = `Factura_${hotel.name.replace(/\s+/g, '_')}_${invoice.invoice_number || invoice.invoiceNumber}.pdf`;
        doc.save(fileName);
    }
};
