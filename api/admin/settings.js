import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();

    if (req.method === 'GET') {
        try {
            const sRes = await db.execute('SELECT * FROM saas_settings');
            const settings = {};
            for (const row of sRes.rows) {
                settings[row.key] = row.value;
            }
            return res.status(200).json(settings);
        } catch (err) {
            console.error('Fetch settings error:', err);
            return res.status(500).json({ error: 'Error al obtener configuraciones.' });
        }
    }

    if (req.method === 'PUT') {
        if (auth.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Solo el SuperAdministrador puede modificar la configuración.' });
        }

        try {
            const { monthlyFeeUsd, trialDays } = req.body || {};

            if (monthlyFeeUsd !== undefined) {
                await db.execute({
                    sql: 'INSERT INTO saas_settings (key, value) VALUES ("monthly_fee_usd", ?) ON CONFLICT(key) DO UPDATE SET value = ?',
                    args: [String(monthlyFeeUsd), String(monthlyFeeUsd)]
                });
            }

            if (trialDays !== undefined) {
                await db.execute({
                    sql: 'INSERT INTO saas_settings (key, value) VALUES ("trial_days", ?) ON CONFLICT(key) DO UPDATE SET value = ?',
                    args: [String(trialDays), String(trialDays)]
                });
            }

            return res.status(200).json({ message: 'Configuración SaaS actualizada exitosamente.' });
        } catch (err) {
            console.error('Update settings error:', err);
            return res.status(500).json({ error: 'Error al actualizar configuraciones.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
