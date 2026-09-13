import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res, ['SUPERADMIN']);
    if (!auth) return;

    await initDB();

    if (req.method === 'GET') {
        try {
            const hRes = await db.execute(`
                SELECT h.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone,
                       (SELECT COUNT(*) FROM rooms r WHERE r.hotel_id = h.id) as room_count,
                       (SELECT COUNT(*) FROM bookings b WHERE b.hotel_id = h.id) as booking_count
                FROM hotels h
                JOIN users u ON h.owner_id = u.id
                ORDER BY h.created_at DESC
            `);

            return res.status(200).json(hRes.rows);
        } catch (err) {
            console.error('Admin fetch hotels error:', err);
            return res.status(500).json({ error: 'Error al listar comercios.' });
        }
    }

    if (req.method === 'PUT') {
        try {
            const { hotelId, status, extendDays } = req.body || {};

            if (!hotelId || !status) {
                return res.status(400).json({ error: 'hotelId y status son requeridos.' });
            }

            const validStatuses = ['TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Estatus de licencia inválido.' });
            }

            if (extendDays && parseInt(extendDays) > 0) {
                const days = parseInt(extendDays);
                await db.execute({
                    sql: `UPDATE hotels 
                          SET status = ?,
                              subscription_due_date = DATETIME(COALESCE(subscription_due_date, CURRENT_TIMESTAMP), '+' || ? || ' days')
                          WHERE id = ?`,
                    args: [status, days, hotelId]
                });
            } else {
                await db.execute({
                    sql: 'UPDATE hotels SET status = ? WHERE id = ?',
                    args: [status, hotelId]
                });
            }

            return res.status(200).json({ message: `Licencia del hotel actualizada a ${status}.` });
        } catch (err) {
            console.error('Admin update hotel status error:', err);
            return res.status(500).json({ error: 'Error al actualizar estatus de la licencia.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
