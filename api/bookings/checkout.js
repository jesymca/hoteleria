import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;

    try {
        const { bookingId } = req.body || {};

        if (!bookingId) {
            return res.status(400).json({ error: 'bookingId es requerido.' });
        }

        // Fetch booking with room & guest details
        const bRes = await db.execute({
            sql: `SELECT b.*, r.room_number, r.id as room_id, rt.base_price_usd, g.full_name as guest_name, g.document_id
                  FROM bookings b
                  JOIN rooms r ON b.room_id = r.id
                  JOIN room_types rt ON r.room_type_id = rt.id
                  JOIN guests g ON b.guest_id = g.id
                  WHERE b.id = ? AND b.hotel_id = ?`,
            args: [bookingId, hotelId]
        });

        if (bRes.rows.length === 0) {
            return res.status(404).json({ error: 'Reserva no encontrada.' });
        }

        const booking = bRes.rows[0];

        // Fetch total extra expenses for this booking
        const expRes = await db.execute({
            sql: 'SELECT SUM(amount_usd) as total_expenses FROM guest_expenses WHERE booking_id = ? AND hotel_id = ?',
            args: [bookingId, hotelId]
        });

        const totalExpensesUsd = Number(expRes.rows[0].total_expenses || 0);

        // Fetch current BCV Rate
        let bcvRate = 40.0;
        try {
            const bcvRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            if (bcvRes.ok) {
                const data = await bcvRes.json();
                if (data.promedio) bcvRate = parseFloat(data.promedio);
            }
        } catch (e) {
            console.warn('Fallback BCV rate used in checkout:', e);
        }

        const subtotalUsd = Number(booking.total_amount_usd);
        const totalUsd = subtotalUsd + totalExpensesUsd;
        const totalVes = totalUsd * bcvRate;

        const nowIso = new Date().toISOString();

        // 1. Update Booking
        await db.execute({
            sql: 'UPDATE bookings SET status = "CHECKED_OUT", actual_check_out = ? WHERE id = ? AND hotel_id = ?',
            args: [nowIso, bookingId, hotelId]
        });

        // 2. Set Room Status to CLEANING for Housekeeping / Mucamas
        await db.execute({
            sql: 'UPDATE rooms SET status = "CLEANING", notes = "Habitación en limpieza tras Check-out de " || ? WHERE id = ? AND hotel_id = ?',
            args: [booking.guest_name, booking.room_id, hotelId]
        });

        // 3. Create Invoice Record
        const invoiceNumber = 'FAC-' + Date.now().toString().slice(-6);
        const invoiceId = 'inv_' + Date.now();

        await db.execute({
            sql: `INSERT INTO invoices 
            (id, hotel_id, booking_id, invoice_number, subtotal_usd, total_expenses_usd, total_usd, bcv_rate, total_ves)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [invoiceId, hotelId, bookingId, invoiceNumber, subtotalUsd, totalExpensesUsd, totalUsd, bcvRate, totalVes]
        });

        return res.status(200).json({
            message: 'Check-out procesado exitosamente. Habitación marcada EN LIMPIEZA para el personal de aseo.',
            invoice: {
                id: invoiceId,
                invoiceNumber,
                subtotalUsd,
                totalExpensesUsd,
                totalUsd,
                bcvRate,
                totalVes,
                guestName: booking.guest_name,
                roomNumber: booking.room_number
            }
        });
    } catch (err) {
        console.error('Checkout error:', err);
        return res.status(500).json({ error: 'Error al procesar el Check-out.' });
    }
}
