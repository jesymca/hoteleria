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
            const bookingId = req.query.bookingId;
            let sql = `
                SELECT e.*, d.name as department_name, u.name as staff_name,
                       b.room_id, r.room_number, g.full_name as guest_name
                FROM guest_expenses e
                LEFT JOIN hotel_departments d ON e.department_id = d.id
                LEFT JOIN users u ON e.staff_user_id = u.id
                JOIN bookings b ON e.booking_id = b.id
                JOIN rooms r ON b.room_id = r.id
                JOIN guests g ON b.guest_id = g.id
                WHERE e.hotel_id = ?
            `;
            let args = [hotelId];

            if (bookingId) {
                sql += ' AND e.booking_id = ?';
                args.push(bookingId);
            }

            sql += ' ORDER BY e.created_at DESC';
            const expensesRes = await db.execute({ sql, args });

            return res.status(200).json(expensesRes.rows);
        } catch (err) {
            console.error('Fetch expenses error:', err);
            return res.status(500).json({ error: 'Error al obtener consumos.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { bookingId, description, amountUsd, departmentId } = req.body || {};

            if (!bookingId || !description || !amountUsd) {
                return res.status(400).json({ error: 'Reserva, descripción y monto en $USD son requeridos.' });
            }

            // Verify active booking
            const bCheck = await db.execute({
                sql: 'SELECT id, status FROM bookings WHERE id = ? AND hotel_id = ?',
                args: [bookingId, hotelId]
            });

            if (bCheck.rows.length === 0 || bCheck.rows[0].status !== 'CHECKED_IN') {
                return res.status(400).json({ error: 'Solo se pueden cargar consumos a reservaciones en estado CHECKED_IN (Ocupadas).' });
            }

            const expenseId = 'exp_' + Date.now();
            await db.execute({
                sql: `INSERT INTO guest_expenses 
                (id, hotel_id, booking_id, department_id, staff_user_id, description, amount_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    expenseId,
                    hotelId,
                    bookingId,
                    departmentId || auth.departmentId || null,
                    auth.userId,
                    description,
                    parseFloat(amountUsd)
                ]
            });

            return res.status(201).json({
                message: 'Consumo cargado a la habitación exitosamente.',
                expenseId
            });
        } catch (err) {
            console.error('Create expense error:', err);
            return res.status(500).json({ error: 'Error al registrar consumo.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
