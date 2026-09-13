import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;

    if (!hotelId) {
        return res.status(400).json({ error: 'Hotel ID no disponible.' });
    }

    if (req.method === 'GET') {
        try {
            const deptsRes = await db.execute({
                sql: 'SELECT * FROM hotel_departments WHERE hotel_id = ? ORDER BY name ASC',
                args: [hotelId]
            });

            const staffRes = await db.execute({
                sql: `SELECT u.id, u.name, u.email, u.role, u.phone, u.department_id, d.name as department_name
                      FROM users u
                      LEFT JOIN hotel_departments d ON u.department_id = d.id
                      WHERE u.role = 'HOTEL_STAFF' AND (d.hotel_id = ? OR u.department_id IS NULL)`,
                args: [hotelId]
            });

            return res.status(200).json({
                departments: deptsRes.rows,
                staff: staffRes.rows
            });
        } catch (err) {
            console.error('Fetch departments error:', err);
            return res.status(500).json({ error: 'Error al obtener áreas internas y personal.' });
        }
    }

    if (req.method === 'POST') {
        try {
            const { action, name, type, staffName, staffEmail, staffPassword, staffPhone, departmentId } = req.body || {};

            if (action === 'create_staff') {
                if (!staffName || !staffEmail || !staffPassword) {
                    return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos para el personal.' });
                }

                // Check existing email
                const existing = await db.execute({
                    sql: 'SELECT id FROM users WHERE email = ?',
                    args: [staffEmail]
                });
                if (existing.rows.length > 0) {
                    return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
                }

                const staffId = 'usr_staff_' + Date.now();
                const pwdHash = await bcrypt.hash(staffPassword, 10);

                await db.execute({
                    sql: 'INSERT INTO users (id, name, email, password_hash, role, phone, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    args: [staffId, staffName, staffEmail, pwdHash, 'HOTEL_STAFF', staffPhone || '', departmentId || null]
                });

                return res.status(201).json({ message: 'Usuario de personal creado exitosamente.', id: staffId });
            }

            // Create Department
            if (!name) {
                return res.status(400).json({ error: 'El nombre del área/departamento es requerido.' });
            }

            const deptId = 'dept_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: [deptId, hotelId, name, type || 'OTHER']
            });

            return res.status(201).json({ message: 'Área/departamento activado exitosamente.', id: deptId });
        } catch (err) {
            console.error('Create department error:', err);
            return res.status(500).json({ error: 'Error al crear departamento o personal.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
