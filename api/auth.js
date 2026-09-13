import { db, initDB } from './_lib/turso.js';
import { generateToken } from './_lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    await initDB();
    const urlPath = req.url || '';

    // Route: Google Auth
    if (urlPath.includes('/google')) {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
        try {
            const { credential, email: bodyEmail, name: bodyName } = req.body || {};
            let email = bodyEmail;
            let name = bodyName;

            // If Google ID Token JWT is passed, decode payload
            if (credential) {
                try {
                    const base64Url = credential.split('.')[1];
                    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join(''));
                    const payload = JSON.parse(jsonPayload);
                    if (payload && payload.email) {
                        email = payload.email;
                        name = payload.name || payload.given_name || email.split('@')[0];
                    }
                } catch (e) {
                    console.error('Error decoding Google JWT credential:', e);
                }
            }

            if (!email) {
                return res.status(400).json({ error: 'No se pudo obtener la información de la cuenta de Google.' });
            }

            // Find existing user or auto-register
            const userRes = await db.execute({
                sql: 'SELECT * FROM users WHERE email = ?',
                args: [email]
            });

            let user;
            if (userRes.rows.length > 0) {
                user = userRes.rows[0];
            } else {
                // Auto-register new user via Google
                const userId = 'usr_g_' + Date.now();
                const hotelId = 'htl_g_' + Date.now();
                const displayName = name || email.split('@')[0];
                const randomPass = 'GoogleAuth_' + Math.random().toString(36).substring(2, 10);
                const passwordHash = await bcrypt.hash(randomPass, 10);
                const hotelName = `Hotel ${displayName}`;
                const rif = 'J-' + Math.floor(10000000 + Math.random() * 90000000) + '-0';

                await db.execute({
                    sql: 'INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
                    args: [userId, displayName, email, passwordHash, 'HOTEL_ADMIN', '']
                });

                const trialEnds = new Date();
                trialEnds.setDate(trialEnds.getDate() + 30);

                await db.execute({
                    sql: `INSERT INTO hotels 
                    (id, owner_id, name, rif, phone, address, status, trial_ends_at) 
                    VALUES (?, ?, ?, ?, ?, ?, 'TRIAL', ?)`,
                    args: [hotelId, userId, hotelName, rif, '', '', trialEnds.toISOString()]
                });

                await db.execute({
                    sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                    args: ['dept_hk_' + Date.now(), hotelId, 'Servicio de Limpieza (Housekeeping)', 'HOUSEKEEPING']
                });
                await db.execute({
                    sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                    args: ['dept_rest_' + Date.now(), hotelId, 'Restaurante', 'RESTAURANT']
                });

                const rtMat = 'rt_mat_' + Date.now();
                await db.execute({
                    sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                    args: [rtMat, hotelId, 'Habitación Matrimonial', 40.00, 2]
                });

                await db.execute({
                    sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status) VALUES (?, ?, ?, ?, ?)',
                    args: ['rm_101_' + Date.now(), hotelId, rtMat, '101', 'AVAILABLE']
                });

                const newUserRes = await db.execute({
                    sql: 'SELECT * FROM users WHERE id = ?',
                    args: [userId]
                });
                user = newUserRes.rows[0];
            }

            let hotel = null;
            if (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF') {
                let hRes;
                if (user.role === 'HOTEL_ADMIN') {
                    hRes = await db.execute({
                        sql: 'SELECT * FROM hotels WHERE owner_id = ?',
                        args: [user.id]
                    });
                } else {
                    hRes = await db.execute({
                        sql: `SELECT h.* FROM hotels h 
                              JOIN hotel_departments d ON d.hotel_id = h.id 
                              WHERE d.id = ?`,
                        args: [user.department_id]
                    });
                    if (hRes.rows.length === 0) {
                        hRes = await db.execute('SELECT * FROM hotels LIMIT 1');
                    }
                }

                if (hRes.rows.length > 0) {
                    hotel = hRes.rows[0];
                }
            }

            let permissions = [];
            if (user.role === 'HOTEL_STAFF') {
                const pRes = await db.execute({
                    sql: 'SELECT department_type FROM staff_permissions WHERE user_id = ?',
                    args: [user.id]
                });
                permissions = pRes.rows.map(r => r.department_type);
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
                    departmentId: user.department_id,
                    permissions
                },
                hotel
            });
        } catch (err) {
            console.error('Google auth error:', err);
            return res.status(500).json({ error: 'Error al iniciar sesión con Google.' });
        }
    }

    // Route: Register
    if (urlPath.includes('/register')) {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
        try {
            const { name, email, password, phone, hotelName, rif, hotelAddress } = req.body || {};
            if (!name || !email || !password || !hotelName || !rif) {
                return res.status(400).json({ error: 'Todos los campos requeridos deben completarse.' });
            }

            const existingUser = await db.execute({
                sql: 'SELECT id FROM users WHERE email = ?',
                args: [email]
            });
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
            }

            const trialDaysRes = await db.execute({
                sql: 'SELECT value FROM saas_settings WHERE key = ?',
                args: ['trial_days']
            });
            const trialDays = trialDaysRes.rows.length > 0 ? parseInt(trialDaysRes.rows[0].value) : 30;

            const userId = 'usr_' + Date.now();
            const hotelId = 'htl_' + Date.now();
            const passwordHash = await bcrypt.hash(password, 10);

            await db.execute({
                sql: 'INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
                args: [userId, name, email, passwordHash, 'HOTEL_ADMIN', phone || '']
            });

            const trialEnds = new Date();
            trialEnds.setDate(trialEnds.getDate() + trialDays);

            await db.execute({
                sql: `INSERT INTO hotels 
                (id, owner_id, name, rif, phone, address, status, trial_ends_at) 
                VALUES (?, ?, ?, ?, ?, ?, 'TRIAL', ?)`,
                args: [hotelId, userId, hotelName, rif, phone || '', hotelAddress || '', trialEnds.toISOString()]
            });

            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: ['dept_hk_' + Date.now(), hotelId, 'Servicio de Limpieza (Housekeeping)', 'HOUSEKEEPING']
            });
            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: ['dept_rest_' + Date.now(), hotelId, 'Restaurante', 'RESTAURANT']
            });

            const rtMat = 'rt_mat_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                args: [rtMat, hotelId, 'Habitación Matrimonial', 40.00, 2]
            });

            await db.execute({
                sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status) VALUES (?, ?, ?, ?, ?)',
                args: ['rm_101_' + Date.now(), hotelId, rtMat, '101', 'AVAILABLE']
            });

            const tokenPayload = { userId, name, email, role: 'HOTEL_ADMIN', hotelId, departmentId: null };
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

    // Route: Login (Default)
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    try {
        const { username, email, password } = req.body || {};
        const loginIdentifier = email || username;

        if (!loginIdentifier || !password) {
            return res.status(400).json({ error: 'Debe ingresar correo/usuario y contraseña.' });
        }

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
            let hRes;
            if (user.role === 'HOTEL_ADMIN') {
                hRes = await db.execute({
                    sql: 'SELECT * FROM hotels WHERE owner_id = ?',
                    args: [user.id]
                });
            } else {
                hRes = await db.execute({
                    sql: `SELECT h.* FROM hotels h 
                          JOIN hotel_departments d ON d.hotel_id = h.id 
                          WHERE d.id = ?`,
                    args: [user.department_id]
                });
                if (hRes.rows.length === 0) {
                    hRes = await db.execute('SELECT * FROM hotels LIMIT 1');
                }
            }

            if (hRes.rows.length > 0) {
                hotel = hRes.rows[0];
            }
        }

        let permissions = [];
        if (user.role === 'HOTEL_STAFF') {
            const pRes = await db.execute({
                sql: 'SELECT department_type FROM staff_permissions WHERE user_id = ?',
                args: [user.id]
            });
            permissions = pRes.rows.map(r => r.department_type);
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
                departmentId: user.department_id,
                permissions
            },
            hotel
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Error interno en el servidor.' });
    }
}
