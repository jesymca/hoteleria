import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;

    if (!hotelId) {
        return res.status(400).json({ error: 'Hotel ID no proporcionado.' });
    }

    if (req.method === 'GET') {
        try {
            const invRes = await db.execute({
                sql: `SELECT i.*, b.check_in_date, b.check_out_date,
                             g.full_name as guest_name, g.document_type, g.document_id,
                             r.room_number
                      FROM invoices i
                      JOIN bookings b ON i.booking_id = b.id
                      JOIN guests g ON b.guest_id = g.id
                      JOIN rooms r ON b.room_id = r.id
                      WHERE i.hotel_id = ?
                      ORDER BY i.created_at DESC`,
                args: [hotelId]
            });

            return res.status(200).json(invRes.rows);
        } catch (err) {
            console.error('Fetch invoices error:', err);
            return res.status(500).json({ error: 'Error al consultar facturas.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
