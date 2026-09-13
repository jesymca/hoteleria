import { db, initDB } from './_lib/turso.js';

export default async function handler(req, res) {
    await initDB();

    if (req.method === 'GET') {
        try {
            const hotelsRes = await db.execute(`
                SELECT h.id, h.name, h.address, h.logo_url, h.phone,
                       COALESCE(AVG(r.rating), 5.0) as avg_rating,
                       COUNT(r.id) as rating_count
                FROM hotels h
                LEFT JOIN hotel_ratings r ON r.hotel_id = h.id
                WHERE h.status IN ('ACTIVE', 'TRIAL')
                GROUP BY h.id
                ORDER BY avg_rating DESC
            `);
            return res.status(200).json(hotelsRes.rows);
        } catch (err) {
            console.error('Fetch ratings error:', err);
            return res.status(500).json({ error: 'Error al consultar valoraciones.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { hotelId, rating, comment, reviewerName } = req.body || {};
            if (!hotelId || !rating || rating < 1 || rating > 5) {
                return res.status(400).json({ error: 'Hotel y calificación válidos son requeridos.' });
            }

            const ratingId = 'rtg_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO hotel_ratings (id, hotel_id, rating, comment, reviewer_name) VALUES (?, ?, ?, ?, ?)',
                args: [ratingId, hotelId, parseInt(rating), comment || '', reviewerName || 'Huésped Anónimo']
            });

            return res.status(201).json({ message: '¡Gracias por valorar nuestro hotel!' });
        } catch (err) {
            console.error('Add rating error:', err);
            return res.status(500).json({ error: 'Error al registrar valoración.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
