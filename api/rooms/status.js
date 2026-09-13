import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'PUT' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;

    try {
        const { roomId, status, notes } = req.body || {};

        if (!roomId || !status) {
            return res.status(400).json({ error: 'roomId y status son requeridos.' });
        }

        const validStatuses = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Estado de habitación inválido.' });
        }

        let cleanedBy = null;
        let cleanedAt = null;

        if (status === 'AVAILABLE') {
            cleanedBy = auth.name || 'Personal de Limpieza';
            cleanedAt = new Date().toISOString();
        }

        await db.execute({
            sql: `UPDATE rooms 
                  SET status = ?,
                      notes = COALESCE(?, notes),
                      cleaned_by = COALESCE(?, cleaned_by),
                      cleaned_at = COALESCE(?, cleaned_at)
                  WHERE id = ? AND hotel_id = ?`,
            args: [status, notes || null, cleanedBy, cleanedAt, roomId, hotelId]
        });

        return res.status(200).json({
            message: `Estado de la habitación actualizado a ${status}.`,
            status,
            cleanedBy,
            cleanedAt
        });
    } catch (err) {
        console.error('Update room status error:', err);
        return res.status(500).json({ error: 'Error al cambiar estado de la habitación.' });
    }
}
