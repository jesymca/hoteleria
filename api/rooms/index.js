import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;

    if (!hotelId) {
        return res.status(400).json({ error: 'Hotel ID no proporcionado en la sesión.' });
    }

    if (req.method === 'GET') {
        try {
            // Fetch rooms with room type details
            const roomsRes = await db.execute({
                sql: `SELECT r.*, rt.name as room_type_name, rt.base_price_usd, rt.capacity
                      FROM rooms r
                      JOIN room_types rt ON r.room_type_id = rt.id
                      WHERE r.hotel_id = ?
                      ORDER BY r.room_number ASC`,
                args: [hotelId]
            });

            // Fetch room types
            const typesRes = await db.execute({
                sql: 'SELECT * FROM room_types WHERE hotel_id = ? ORDER BY name ASC',
                args: [hotelId]
            });

            return res.status(200).json({
                rooms: roomsRes.rows,
                roomTypes: typesRes.rows
            });
        } catch (err) {
            console.error('Fetch rooms error:', err);
            return res.status(500).json({ error: 'Error al obtener habitaciones.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { action, roomNumber, roomTypeId, notes, typeName, basePriceUsd, capacity } = req.body || {};

            if (action === 'create_type') {
                if (!typeName || !basePriceUsd) {
                    return res.status(400).json({ error: 'Nombre y precio base son requeridos para el tipo de habitación.' });
                }
                const typeId = 'rt_' + Date.now();
                await db.execute({
                    sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                    args: [typeId, hotelId, typeName, parseFloat(basePriceUsd), parseInt(capacity || 2)]
                });
                return res.status(201).json({ message: 'Tipo de habitación creado exitosamente.', id: typeId });
            }

            // Create Room
            if (!roomNumber || !roomTypeId) {
                return res.status(400).json({ error: 'Número de habitación y tipo son requeridos.' });
            }

            // Check if room_number already exists for this hotel
            const existingRoom = await db.execute({
                sql: 'SELECT id FROM rooms WHERE hotel_id = ? AND room_number = ?',
                args: [hotelId, roomNumber]
            });
            if (existingRoom.rows.length > 0) {
                return res.status(400).json({ error: `La habitación N° ${roomNumber} ya existe.` });
            }

            const roomId = 'rm_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
                args: [roomId, hotelId, roomTypeId, roomNumber, 'AVAILABLE', notes || '']
            });

            return res.status(201).json({ message: 'Habitación creada exitosamente.', id: roomId });
        } catch (err) {
            console.error('Create room error:', err);
            return res.status(500).json({ error: 'Error al crear habitación.' });
        }
    }

    if (req.method === 'PUT') {
        try {
            const { roomId, roomNumber, roomTypeId, notes, status } = req.body || {};

            if (!roomId) {
                return res.status(400).json({ error: 'ID de habitación requerido.' });
            }

            await db.execute({
                sql: `UPDATE rooms 
                      SET room_number = COALESCE(?, room_number),
                          room_type_id = COALESCE(?, room_type_id),
                          notes = COALESCE(?, notes),
                          status = COALESCE(?, status)
                      WHERE id = ? AND hotel_id = ?`,
                args: [roomNumber, roomTypeId, notes, status, roomId, hotelId]
            });

            return res.status(200).json({ message: 'Habitación actualizada exitosamente.' });
        } catch (err) {
            console.error('Update room error:', err);
            return res.status(500).json({ error: 'Error al actualizar habitación.' });
        }
    }

    if (req.method === 'DELETE') {
        try {
            const roomId = req.query.id;
            if (!roomId) {
                return res.status(400).json({ error: 'ID de habitación requerido.' });
            }
            await db.execute({
                sql: 'DELETE FROM rooms WHERE id = ? AND hotel_id = ?',
                args: [roomId, hotelId]
            });
            return res.status(200).json({ message: 'Habitación eliminada exitosamente.' });
        } catch (err) {
            console.error('Delete room error:', err);
            return res.status(500).json({ error: 'Error al eliminar habitación.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
