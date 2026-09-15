import { db, initDB } from './_lib/turso.js';
import { requireAuth } from './_lib/auth.js';

let cachedRate = null;
let lastFetched = 0;
const CACHE_TTL = 300000;

export default async function handler(req, res) {
    const urlPath = req.url || '';

    // Route: BCV Proxy
    if (urlPath.includes('/bcv')) {
        if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
        const now = Date.now();
        if (cachedRate && (now - lastFetched < CACHE_TTL)) {
            return res.status(200).json(cachedRate);
        }

        try {
            const apiRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
            if (apiRes.ok) {
                const data = await apiRes.json();
                cachedRate = {
                    promedio: data.promedio || 40.0,
                    fechaActualizacion: data.fechaActualizacion || new Date().toISOString(),
                    fuente: 've.dolarapi.com/v1/dolares/oficial',
                    status: 'ONLINE'
                };
                lastFetched = now;
                return res.status(200).json(cachedRate);
            }
        } catch (err) {
            console.warn('Error fetching DolarAPI BCV rate:', err);
        }

        const fallback = {
            promedio: cachedRate ? cachedRate.promedio : 40.0,
            fechaActualizacion: new Date().toISOString(),
            fuente: 'Caché local de respaldo',
            status: 'OFFLINE_FALLBACK'
        };
        return res.status(200).json(fallback);
    }

    // Route: Invoices List
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;
    if (!hotelId) return res.status(400).json({ error: 'Hotel ID no proporcionado.' });

    if (req.method === 'GET') {
        try {
            const invRes = await db.execute({
                sql: `SELECT i.*, b.check_in_date, b.check_out_date,
                             g.full_name as guest_name, g.document_type, g.document_id,
                             r.room_number, rt.name as room_type_name
                      FROM invoices i
                      JOIN bookings b ON i.booking_id = b.id
                      JOIN guests g ON b.guest_id = g.id
                      JOIN rooms r ON b.room_id = r.id
                      LEFT JOIN room_types rt ON r.room_type_id = rt.id
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

    if (req.method === 'PUT') {
        try {
            const { invoiceId, paymentStatus, notes } = req.body || {};
            if (!invoiceId || !paymentStatus) return res.status(400).json({ error: 'invoiceId y paymentStatus son requeridos.' });

            await db.execute({
                sql: 'UPDATE invoices SET payment_status = ?, notes = COALESCE(?, notes) WHERE id = ? AND hotel_id = ?',
                args: [paymentStatus, notes || null, invoiceId, hotelId]
            });

            const statusMsg = paymentStatus === 'VOIDED' ? 'Factura anulada exitosamente.' :
                              paymentStatus === 'REFUNDED' ? 'Devolución / Nota de Crédito procesada.' :
                              'Estado de factura actualizado correctamente.';

            return res.status(200).json({ message: statusMsg });
        } catch (err) {
            console.error('Update invoice error:', err);
            return res.status(500).json({ error: 'Error al actualizar factura.' });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const invoiceId = req.query.id;
            if (!invoiceId) return res.status(400).json({ error: 'ID de factura no proporcionado.' });

            await db.execute({
                sql: 'DELETE FROM invoices WHERE id = ? AND hotel_id = ?',
                args: [invoiceId, hotelId]
            });

            return res.status(200).json({ message: 'Factura eliminada del sistema.' });
        } catch (err) {
            console.error('Delete invoice error:', err);
            return res.status(500).json({ error: 'Error al eliminar la factura.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
