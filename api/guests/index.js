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
            const query = req.query.q;
            let sql = 'SELECT * FROM guests WHERE hotel_id = ?';
            let args = [hotelId];

            if (query) {
                sql += ' AND (full_name LIKE ? OR document_id LIKE ? OR phone LIKE ?)';
                args.push(`%${query}%`, `%${query}%`, `%${query}%`);
            }

            sql += ' ORDER BY full_name ASC';
            const guestsRes = await db.execute({ sql, args });

            return res.status(200).json(guestsRes.rows);
        } catch (err) {
            console.error('Fetch guests error:', err);
            return res.status(500).json({ error: 'Error al consultar directorio de huéspedes.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { fullName, documentType, documentId, phone, email, originCity } = req.body || {};

            if (!fullName || !documentId) {
                return res.status(400).json({ error: 'Nombre completo y N° Documento son requeridos.' });
            }

            // Check if guest document already exists for this hotel
            const existing = await db.execute({
                sql: 'SELECT id FROM guests WHERE hotel_id = ? AND document_id = ?',
                args: [hotelId, documentId]
            });

            if (existing.rows.length > 0) {
                // Return existing guest
                return res.status(200).json({
                    message: 'Huésped ya registrado anteriormente.',
                    guest: existing.rows[0]
                });
            }

            const guestId = 'gst_' + Date.now();
            await db.execute({
                sql: `INSERT INTO guests (id, hotel_id, full_name, document_type, document_id, phone, email, origin_city)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [guestId, hotelId, fullName, documentType || 'V', documentId, phone || '', email || '', originCity || '']
            });

            const newGuest = await db.execute({
                sql: 'SELECT * FROM guests WHERE id = ?',
                args: [guestId]
            });

            return res.status(201).json({
                message: 'Huésped registrado exitosamente.',
                guest: newGuest.rows[0]
            });
        } catch (err) {
            console.error('Create guest error:', err);
            return res.status(500).json({ error: 'Error al registrar huésped.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
