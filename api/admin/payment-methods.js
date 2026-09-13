import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    await initDB();

    if (req.method === 'GET') {
        try {
            const pmRes = await db.execute('SELECT * FROM saas_payment_methods WHERE is_active = 1 ORDER BY name ASC');
            return res.status(200).json(pmRes.rows);
        } catch (err) {
            console.error('Fetch payment methods error:', err);
            return res.status(500).json({ error: 'Error al consultar métodos de pago SaaS.' });
        }
    }

    const auth = requireAuth(req, res, ['SUPERADMIN']);
    if (!auth) return;

    if (req.method === 'POST') {
        try {
            const { name, currency, details } = req.body || {};

            if (!name || !currency || !details) {
                return res.status(400).json({ error: 'Nombre, moneda (USD/VES) y detalles son requeridos.' });
            }

            const pmId = 'pm_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO saas_payment_methods (id, name, currency, details) VALUES (?, ?, ?, ?)',
                args: [pmId, name, currency, details]
            });

            return res.status(201).json({ message: 'Método de pago agregado exitosamente.', id: pmId });
        } catch (err) {
            console.error('Create payment method error:', err);
            return res.status(500).json({ error: 'Error al registrar método de pago.' });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const pmId = req.query.id;
            if (!pmId) {
                return res.status(400).json({ error: 'ID de método de pago requerido.' });
            }

            await db.execute({
                sql: 'UPDATE saas_payment_methods SET is_active = 0 WHERE id = ?',
                args: [pmId]
            });

            return res.status(200).json({ message: 'Método de pago desactivado exitosamente.' });
        } catch (err) {
            console.error('Delete payment method error:', err);
            return res.status(500).json({ error: 'Error al eliminar método de pago.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
