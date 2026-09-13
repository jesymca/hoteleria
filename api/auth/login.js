import { db, initDB } from '../_lib/turso.js';
import { generateToken } from '../_lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        await initDB();
        const { username, email, password } = req.body || {};
        const loginIdentifier = email || username;

        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'Debe ingresar correo/usuario y contraseña.' });
        }

        // Find user by email OR name (for hotel_prueba)
        const userRes = await db.execute({
            sql: 'SELECT * FROM users WHERE email = ? OR name = ?',
            args: [loginIdentifier, loginIdentifier]
        });

        if (userRes.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const user = userRes.rows[0];
        const match = await bcrypt.compare(password, String(user.password_hash));
        if (!match) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        let hotel = null;
        if (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF') {
            // Find hotel owned by or associated with user
            let hRes;
            if (user.role === 'HOTEL_ADMIN') {
                hRes = await db.execute({
                    sql: 'SELECT * FROM hotels WHERE owner_id = ?',
                    args: [user.id]
                });
            } else {
                // For staff, find hotel via department
                hRes = await db.execute({
                    sql: `SELECT h.* FROM hotels h 
                          JOIN hotel_departments d ON d.hotel_id = h.id 
                          WHERE d.id = ?`,
                    args: [user.department_id]
                });
                if (hRes.rows.length === 0) {
                    // Fallback to first active hotel if department unassigned
                    hRes = await db.execute('SELECT * FROM hotels LIMIT 1');
                }
            }

            if (hRes.rows.length > 0) {
                hotel = hRes.rows[0];
            }
        }

        const tokenPayload = {
            userId: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            hotelId: hotel ? hotel.id : null,
            departmentId: user.department_id || null
        };

        const token = generateToken(tokenPayload);

        return res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                departmentId: user.department_id
            },
            hotel
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
}
