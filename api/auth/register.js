import { db, initDB } from '../_lib/turso.js';
import { generateToken } from '../_lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        await initDB();
        const { name, email, password, phone, hotelName, rif, hotelAddress } = req.body || {};

        if (!name || !email || !password || !hotelName || !rif) {
            return res.status(400).json({ error: 'Todos los campos requeridos deben completarse.' });
        }

        // Check if user email already exists
        const existingUser = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [email]
        });

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        }

        // Fetch trial days from settings
        const trialDaysRes = await db.execute({
            sql: 'SELECT value FROM saas_settings WHERE key = ?',
            args: ['trial_days']
        });
        const trialDays = trialDaysRes.rows.length > 0 ? parseInt(trialDaysRes.rows[0].value) : 30;

        const userId = 'usr_' + Date.now();
        const hotelId = 'htl_' + Date.now();
        const passwordHash = await bcrypt.hash(password, 10);

        // Create User
        await db.execute({
            sql: 'INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
            args: [userId, name, email, passwordHash, 'HOTEL_ADMIN', phone || '']
        });

        const trialEnds = new Date();
        trialEnds.setDate(trialEnds.getDate() + trialDays);

        // Create Hotel
        await db.execute({
            sql: `INSERT INTO hotels 
            (id, owner_id, name, rif, phone, address, status, trial_ends_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'TRIAL', ?)`,
            args: [hotelId, userId, hotelName, rif, phone || '', hotelAddress || '', trialEnds.toISOString()]
        });

        // Create Default Departments
        await db.execute({
            sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
            args: ['dept_hk_' + Date.now(), hotelId, 'Servicio de Limpieza (Housekeeping)', 'HOUSEKEEPING']
        });
        await db.execute({
            sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
            args: ['dept_rest_' + Date.now(), hotelId, 'Restaurante', 'RESTAURANT']
        });

        // Create Default Room Types
        const rtMat = 'rt_mat_' + Date.now();
        await db.execute({
            sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
            args: [rtMat, hotelId, 'Habitación Matrimonial', 40.00, 2]
        });

        // Create Initial Rooms
        await db.execute({
            sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status) VALUES (?, ?, ?, ?, ?)',
            args: ['rm_101_' + Date.now(), hotelId, rtMat, '101', 'AVAILABLE']
        });
        await db.execute({
            sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status) VALUES (?, ?, ?, ?, ?)',
            args: ['rm_102_' + Date.now(), hotelId, rtMat, '102', 'AVAILABLE']
        });

        const tokenPayload = {
            userId,
            name,
            email,
            role: 'HOTEL_ADMIN',
            hotelId,
            departmentId: null
        };
        const token = generateToken(tokenPayload);

        const hotelRes = await db.execute({
            sql: 'SELECT * FROM hotels WHERE id = ?',
            args: [hotelId]
        });

        return res.status(201).json({
            token,
            user: { id: userId, name, email, role: 'HOTEL_ADMIN', phone },
            hotel: hotelRes.rows[0]
        });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Error al registrar el hotel.' });
    }
}
