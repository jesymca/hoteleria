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
            const statusFilter = req.query.status;
            let sql = `
                SELECT b.*, 
                       g.full_name as guest_name, g.document_type, g.document_id, g.phone as guest_phone,
                       r.room_number, rt.name as room_type_name
                FROM bookings b
                JOIN guests g ON b.guest_id = g.id
                JOIN rooms r ON b.room_id = r.id
                JOIN room_types rt ON r.room_type_id = rt.id
                WHERE b.hotel_id = ?
            `;
            let args = [hotelId];

            if (statusFilter) {
                sql += ' AND b.status = ?';
                args.push(statusFilter);
            }

            sql += ' ORDER BY b.created_at DESC';
            const bookingsRes = await db.execute({ sql, args });

            return res.status(200).json(bookingsRes.rows);
        } catch (err) {
            console.error('Fetch bookings error:', err);
            return res.status(500).json({ error: 'Error al listar reservaciones.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { roomId, guestId, checkInDate, checkOutDate, depositUsd, totalAmountUsd, notes, isCheckInImmediate } = req.body || {};

            if (!roomId || !guestId || !checkInDate || !checkOutDate) {
                return res.status(400).json({ error: 'Habitación, Huésped y Fechas son requeridos.' });
            }

            if (new Date(checkOutDate) <= new Date(checkInDate)) {
                return res.status(400).json({ error: 'La fecha de salida debe ser posterior a la fecha de entrada.' });
            }

            // ALGORITMO DE PREVENCIÓN DE SOBREVENTA (OVERBOOKING)
            // Solapamiento: (NUEVO_CHECKIN < EXISTENTE_CHECKOUT) AND (NUEVO_CHECKOUT > EXISTENTE_CHECKIN)
            const overlapCheck = await db.execute({
                sql: `SELECT id, check_in_date, check_out_date FROM bookings
                      WHERE hotel_id = ? AND room_id = ? AND status IN ('RESERVED', 'CHECKED_IN')
                        AND (check_in_date < ? AND check_out_date > ?)`,
                args: [hotelId, roomId, checkOutDate, checkInDate]
            });

            if (overlapCheck.rows.length > 0) {
                return res.status(400).json({
                    error: 'La habitación ya posee una reserva confirmada u ocupación en las fechas seleccionadas (Prevención de sobreventa).'
                });
            }

            const bookingId = 'bk_' + Date.now();
            const initialStatus = isCheckInImmediate ? 'CHECKED_IN' : 'RESERVED';
            const actualCheckIn = isCheckInImmediate ? new Date().toISOString() : null;

            await db.execute({
                sql: `INSERT INTO bookings 
                (id, hotel_id, room_id, guest_id, check_in_date, check_out_date, actual_check_in, status, total_amount_usd, deposit_usd, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    bookingId,
                    hotelId,
                    roomId,
                    guestId,
                    checkInDate,
                    checkOutDate,
                    actualCheckIn,
                    initialStatus,
                    parseFloat(totalAmountUsd || 0),
                    parseFloat(depositUsd || 0),
                    notes || ''
                ]
            });

            // Update room status if immediate Check-in
            if (isCheckInImmediate) {
                await db.execute({
                    sql: 'UPDATE rooms SET status = "OCCUPIED" WHERE id = ? AND hotel_id = ?',
                    args: [roomId, hotelId]
                });
            }

            return res.status(201).json({
                message: isCheckInImmediate ? 'Check-in realizado exitosamente.' : 'Reserva creada exitosamente.',
                bookingId
            });
        } catch (err) {
            console.error('Create booking error:', err);
            return res.status(500).json({ error: 'Error al registrar la reserva.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
