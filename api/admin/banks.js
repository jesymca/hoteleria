import { db, initDB } from '../_lib/turso.js';

export default async function handler(req, res) {
    await initDB();

    if (req.method === 'GET') {
        try {
            const bRes = await db.execute('SELECT * FROM banks ORDER BY name ASC');
            return res.status(200).json(bRes.rows);
        } catch (err) {
            console.error('Fetch banks error:', err);
            return res.status(500).json({ error: 'Error al consultar catálogo de bancos.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { code, name } = req.body || {};
            if (!code || !name) {
                return res.status(400).json({ error: 'Código y nombre de banco son requeridos.' });
            }

            await db.execute({
                sql: 'INSERT INTO banks (code, name) VALUES (?, ?)',
                args: [code, name]
            });

            return res.status(201).json({ message: 'Banco agregado al catálogo oficial.' });
        } catch (err) {
            console.error('Create bank error:', err);
            return res.status(500).json({ error: 'Error al registrar banco.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
