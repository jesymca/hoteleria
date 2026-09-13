import { db, initDB } from './_lib/turso.js';
import { requireAuth } from './_lib/auth.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;
    const urlPath = req.url || '';

    // Route: Room Status Update (Housekeeping / Mucamas 1-click clean)
    if (urlPath.includes('/rooms/status')) {
        if (req.method !== 'PUT' && req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
        try {
            const { roomId, status, notes } = req.body || {};
            if (!roomId || !status) return res.status(400).json({ error: 'roomId y status son requeridos.' });

            let cleanedBy = null;
            let cleanedAt = null;
            if (status === 'AVAILABLE') {
                cleanedBy = auth.name || 'Personal de Limpieza';
                cleanedAt = new Date().toISOString();
            }

            await db.execute({
                sql: `UPDATE rooms 
                      SET status = ?,
                          notes = COALESCE(?, notes),
                          cleaned_by = COALESCE(?, cleaned_by),
                          cleaned_at = COALESCE(?, cleaned_at)
                      WHERE id = ? AND hotel_id = ?`,
                args: [status, notes || null, cleanedBy, cleanedAt, roomId, hotelId]
            });

            return res.status(200).json({ message: `Estado actualizado a ${status}.`, status, cleanedBy, cleanedAt });
        } catch (err) {
            console.error('Update room status error:', err);
            return res.status(500).json({ error: 'Error al cambiar estado de la habitación.' });
        }
    }

    // Route: Checkout
    if (urlPath.includes('/bookings/checkout')) {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
        try {
            const { bookingId } = req.body || {};
            if (!bookingId) return res.status(400).json({ error: 'bookingId es requerido.' });

            const bRes = await db.execute({
                sql: `SELECT b.*, r.room_number, r.id as room_id, rt.base_price_usd, g.full_name as guest_name, g.document_id
                      FROM bookings b
                      JOIN rooms r ON b.room_id = r.id
                      JOIN room_types rt ON r.room_type_id = rt.id
                      JOIN guests g ON b.guest_id = g.id
                      WHERE b.id = ? AND b.hotel_id = ?`,
                args: [bookingId, hotelId]
            });

            if (bRes.rows.length === 0) return res.status(404).json({ error: 'Reserva no encontrada.' });

            const booking = bRes.rows[0];
            const expRes = await db.execute({
                sql: 'SELECT SUM(amount_usd) as total_expenses FROM guest_expenses WHERE booking_id = ? AND hotel_id = ?',
                args: [bookingId, hotelId]
            });
            const totalExpensesUsd = Number(expRes.rows[0].total_expenses || 0);

            let bcvRate = 40.0;
            try {
                const bcvRes = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
                if (bcvRes.ok) {
                    const data = await bcvRes.json();
                    if (data.promedio) bcvRate = parseFloat(data.promedio);
                }
            } catch (e) {
                console.warn('Fallback BCV used:', e);
            }

            const subtotalUsd = Number(booking.total_amount_usd);
            const totalUsd = subtotalUsd + totalExpensesUsd;
            const totalVes = totalUsd * bcvRate;
            const nowIso = new Date().toISOString();

            await db.execute({
                sql: "UPDATE bookings SET status = 'CHECKED_OUT', actual_check_out = ? WHERE id = ? AND hotel_id = ?",
                args: [nowIso, bookingId, hotelId]
            });

            await db.execute({
                sql: "UPDATE rooms SET status = 'CLEANING', notes = 'Habitación en limpieza tras Check-out de ' || ? WHERE id = ? AND hotel_id = ?",
                args: [booking.guest_name, booking.room_id, hotelId]
            });

            const invoiceNumber = 'FAC-' + Date.now().toString().slice(-6);
            const invoiceId = 'inv_' + Date.now();

            await db.execute({
                sql: `INSERT INTO invoices 
                (id, hotel_id, booking_id, invoice_number, subtotal_usd, total_expenses_usd, total_usd, bcv_rate, total_ves)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [invoiceId, hotelId, bookingId, invoiceNumber, subtotalUsd, totalExpensesUsd, totalUsd, bcvRate, totalVes]
            });

            return res.status(200).json({
                message: 'Check-out procesado exitosamente. Habitación marcada EN LIMPIEZA para el personal de aseo.',
                invoice: {
                    id: invoiceId,
                    invoiceNumber,
                    subtotalUsd,
                    totalExpensesUsd,
                    totalUsd,
                    bcvRate,
                    totalVes,
                    guestName: booking.guest_name,
                    roomNumber: booking.room_number
                }
            });
        } catch (err) {
            console.error('Checkout error:', err);
            return res.status(500).json({ error: 'Error al procesar el Check-out.' });
        }
    }

    // Route: Guests
    if (urlPath.includes('/guests')) {
        if (req.method === 'GET') {
            const query = req.query.q;
            let sql = 'SELECT * FROM guests WHERE hotel_id = ?';
            let args = [hotelId];
            if (query) {
                sql += ' AND (full_name LIKE ? OR document_id LIKE ? OR phone LIKE ?)';
                args.push(`%${query}%`, `%${query}%`, `%${query}%`);
            }
            sql += ' ORDER BY full_name ASC';
            const guestsRes = await db.execute({ sql, args });
            return res.status(200).json(guestsRes.rows);
        }
        if (req.method === 'POST') {
            const { fullName, documentType, documentId, phone, email, originCity } = req.body || {};
            if (!fullName || !documentId) return res.status(400).json({ error: 'Nombre completo y N° Documento son requeridos.' });

            const existing = await db.execute({
                sql: 'SELECT id FROM guests WHERE hotel_id = ? AND document_id = ?',
                args: [hotelId, documentId]
            });
            if (existing.rows.length > 0) {
                return res.status(200).json({ message: 'Huésped ya registrado.', guest: existing.rows[0] });
            }

            const guestId = 'gst_' + Date.now();
            await db.execute({
                sql: `INSERT INTO guests (id, hotel_id, full_name, document_type, document_id, phone, email, origin_city)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [guestId, hotelId, fullName, documentType || 'V', documentId, phone || '', email || '', originCity || '']
            });

            const newGuest = await db.execute({ sql: 'SELECT * FROM guests WHERE id = ?', args: [guestId] });
            return res.status(201).json({ message: 'Huésped registrado.', guest: newGuest.rows[0] });
        }
    }

    // Route: Expenses
    if (urlPath.includes('/expenses')) {
        if (req.method === 'GET') {
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
        }

        if (req.method === 'POST') {
            const { bookingId, description, amountUsd, departmentId } = req.body || {};
            if (!bookingId || !description || !amountUsd) return res.status(400).json({ error: 'Reserva, descripción y monto son requeridos.' });

            const expenseId = 'exp_' + Date.now();
            await db.execute({
                sql: `INSERT INTO guest_expenses 
                (id, hotel_id, booking_id, department_id, staff_user_id, description, amount_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [expenseId, hotelId, bookingId, departmentId || auth.departmentId || null, auth.userId, description, parseFloat(amountUsd)]
            });

            return res.status(201).json({ message: 'Consumo cargado a la habitación exitosamente.', expenseId });
        }
    }

    // Route: Departments & Staff Management
    if (urlPath.includes('/departments')) {
        if (req.method === 'GET') {
            const deptsRes = await db.execute({ sql: 'SELECT * FROM hotel_departments WHERE hotel_id = ? ORDER BY name ASC', args: [hotelId] });
            const staffRes = await db.execute({
                sql: `SELECT u.id, u.name, u.email, u.role, u.phone, u.department_id, d.name as department_name
                      FROM users u
                      LEFT JOIN hotel_departments d ON u.department_id = d.id
                      WHERE u.role = 'HOTEL_STAFF' AND (d.hotel_id = ? OR u.department_id IS NULL)
                      ORDER BY u.name ASC`,
                args: [hotelId]
            });

            const permsRes = await db.execute({
                sql: 'SELECT user_id, department_type FROM staff_permissions WHERE hotel_id = ?',
                args: [hotelId]
            });

            const permsMap = {};
            for (const r of permsRes.rows) {
                if (!permsMap[r.user_id]) permsMap[r.user_id] = [];
                permsMap[r.user_id].push(r.department_type);
            }

            const staffWithPerms = staffRes.rows.map(s => ({
                ...s,
                permissions: permsMap[s.id] || []
            }));

            return res.status(200).json({ departments: deptsRes.rows, staff: staffWithPerms });
        }

        if (req.method === 'POST') {
            const { action, name, type, staffName, staffEmail, staffPassword, staffPhone, departmentId, permissions } = req.body || {};
            if (action === 'create_staff') {
                if (!staffName || !staffEmail || !staffPassword) return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos.' });

                const staffId = 'usr_staff_' + Date.now();
                const pwdHash = await bcrypt.hash(staffPassword, 10);
                await db.execute({
                    sql: 'INSERT INTO users (id, name, email, password_hash, role, phone, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    args: [staffId, staffName, staffEmail, pwdHash, 'HOTEL_STAFF', staffPhone || '', departmentId || null]
                });

                if (Array.isArray(permissions)) {
                    for (const pType of permissions) {
                        if (pType) {
                            const pId = 'perm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                            await db.execute({
                                sql: 'INSERT INTO staff_permissions (id, user_id, hotel_id, department_type) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, department_type) DO NOTHING',
                                args: [pId, staffId, hotelId, pType]
                            });
                        }
                    }
                }

                return res.status(201).json({ message: 'Usuario de personal creado.', id: staffId });
            }

            if (!name) return res.status(400).json({ error: 'El nombre del departamento es requerido.' });
            const deptId = 'dept_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: [deptId, hotelId, name, type || 'OTHER']
            });
            return res.status(201).json({ message: 'Área activada exitosamente.', id: deptId });
        }

        if (req.method === 'PUT') {
            const { action, deptId, name, type, is_active, staffId, staffName, staffEmail, staffPhone, departmentId, newPassword, permissions } = req.body || {};

            if (action === 'update_staff') {
                if (!staffId || !staffName || !staffEmail) return res.status(400).json({ error: 'staffId, nombre y correo son requeridos.' });

                if (newPassword && newPassword.trim().length > 0) {
                    const pwdHash = await bcrypt.hash(newPassword, 10);
                    await db.execute({
                        sql: 'UPDATE users SET name = ?, email = ?, phone = ?, department_id = ?, password_hash = ? WHERE id = ?',
                        args: [staffName, staffEmail, staffPhone || '', departmentId || null, pwdHash, staffId]
                    });
                } else {
                    await db.execute({
                        sql: 'UPDATE users SET name = ?, email = ?, phone = ?, department_id = ? WHERE id = ?',
                        args: [staffName, staffEmail, staffPhone || '', departmentId || null, staffId]
                    });
                }

                if (Array.isArray(permissions)) {
                    await db.execute({ sql: 'DELETE FROM staff_permissions WHERE user_id = ? AND hotel_id = ?', args: [staffId, hotelId] });
                    for (const pType of permissions) {
                        if (pType) {
                            const pId = 'perm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                            await db.execute({
                                sql: 'INSERT INTO staff_permissions (id, user_id, hotel_id, department_type) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, department_type) DO NOTHING',
                                args: [pId, staffId, hotelId, pType]
                            });
                        }
                    }
                }

                return res.status(200).json({ message: 'Usuario de personal actualizado exitosamente.' });
            }

            // Edit Department
            if (!deptId || !name) return res.status(400).json({ error: 'deptId y nombre son requeridos.' });
            await db.execute({
                sql: 'UPDATE hotel_departments SET name = ?, type = ?, is_active = ? WHERE id = ? AND hotel_id = ?',
                args: [name, type || 'OTHER', is_active !== undefined ? (is_active ? 1 : 0) : 1, deptId, hotelId]
            });
            return res.status(200).json({ message: 'Área/departamento actualizada exitosamente.' });
        }
    }

    // Route: Catalog & POS Charge
    if (urlPath.includes('/catalog')) {
        if (urlPath.includes('/catalog/charge') && req.method === 'POST') {
            const { bookingId, itemId, quantity, notes } = req.body || {};
            if (!bookingId || !itemId) return res.status(400).json({ error: 'Reserva e Ítem son requeridos.' });

            const itemRes = await db.execute({
                sql: 'SELECT * FROM hotel_catalog_items WHERE id = ? AND hotel_id = ?',
                args: [itemId, hotelId]
            });
            if (itemRes.rows.length === 0) return res.status(404).json({ error: 'Ítem no encontrado en el catálogo.' });

            const item = itemRes.rows[0];
            const qty = Math.max(1, parseInt(quantity) || 1);
            const totalAmount = item.price_usd * qty;
            const desc = `[${item.department_type}] ${qty}x ${item.name} ($${Number(item.price_usd).toFixed(2)} c/u)${notes ? ` - ${notes}` : ''}`;
            const expenseId = 'exp_' + Date.now();

            await db.execute({
                sql: `INSERT INTO guest_expenses 
                (id, hotel_id, booking_id, department_id, staff_user_id, description, amount_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [expenseId, hotelId, bookingId, item.department_id || null, auth.userId, desc, totalAmount]
            });

            return res.status(201).json({ message: `Cargado a habitación: ${desc}`, expenseId });
        }

        if (urlPath.includes('/catalog/bulk') && req.method === 'POST') {
            const { items } = req.body || {};
            if (!Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ error: 'Se requiere una lista de ítems para la carga masiva.' });
            }

            let insertedCount = 0;
            for (const item of items) {
                if (!item.name || !item.departmentType || item.priceUsd === undefined) continue;
                const itemId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                await db.execute({
                    sql: `INSERT INTO hotel_catalog_items (id, hotel_id, department_type, department_id, name, description, price_usd)
                          VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    args: [itemId, hotelId, String(item.departmentType).toUpperCase(), item.departmentId || null, String(item.name).trim(), String(item.description || '').trim(), parseFloat(item.priceUsd) || 0]
                });
                insertedCount++;
            }

            return res.status(201).json({ message: `${insertedCount} ítems cargados exitosamente al catálogo POS.`, count: insertedCount });
        }

        if (req.method === 'GET') {
            const typeFilter = req.query.type;
            let sql = 'SELECT * FROM hotel_catalog_items WHERE hotel_id = ?';
            let args = [hotelId];
            if (typeFilter) {
                sql += ' AND department_type = ?';
                args.push(typeFilter);
            }
            sql += ' ORDER BY name ASC';
            let catRes = await db.execute({ sql, args });

            // Auto-seed default catalog items if empty for this service type
            if (catRes.rows.length === 0 && typeFilter) {
                const DEFAULT_ITEMS = {
                    RESTAURANT: [
                        { name: 'Desayuno Criollo Venezolano', description: 'Arepas, carne mechada, queso paisa y caraotas', price_usd: 8.00 },
                        { name: 'Pabellón Criollo Especial', description: 'Arroz, carne mechada, tajadas fribles y caraotas negras', price_usd: 12.00 },
                        { name: 'Pargo Rojo Frito con Tostones', description: 'Pargo fresco con ensalada mixta y tostones de plátano', price_usd: 16.00 },
                        { name: 'Jarra de Jugo Natural de Parchita', description: 'Fruta fresca de temporada 1 Litro', price_usd: 4.00 }
                    ],
                    BAR: [
                        { name: 'Mojito Cubano Tradicional', description: 'Ron blanco, menta fresca, limón y soda', price_usd: 6.00 },
                        { name: 'Piña Colada Tropical', description: 'Ron, crema de coco y jugo de piña natural', price_usd: 7.00 },
                        { name: 'Cerveza Nacional Bien Fría', description: 'Polar Pilsen / Zulia 330ml', price_usd: 2.50 },
                        { name: 'Servicio de Ron Añejo + Hielo', description: 'Botella de Ron Añejo Venezolano 0.75L con refrescos', price_usd: 35.00 }
                    ],
                    SPA: [
                        { name: 'Masaje Relajante Corporal (45 min)', description: 'Terapia corporal completa con aceites esenciales', price_usd: 35.00 },
                        { name: 'Exfoliación Corporal con Sales Marinas', description: 'Limpieza profunda y aromaterapia', price_usd: 45.00 },
                        { name: 'Sesión de Jacuzzi Térmico & Hidromasaje', description: 'Uso de jacuzzi privado por 30 minutos', price_usd: 25.00 }
                    ],
                    PELUQUERIA: [
                        { name: 'Corte de Cabello Caballero / Dama', description: 'Corte personalizado con lavado y secado básico', price_usd: 12.00 },
                        { name: 'Secado y Peinado Profesional', description: 'Modelado con cepillo y planchado', price_usd: 15.00 },
                        { name: 'Perfilado de Barba & Toalla Caliente', description: 'Arreglo de barba con aceites hidratantes', price_usd: 8.00 }
                    ],
                    GALERIA: [
                        { name: 'Pintura al Óleo Paisaje Marítimo', description: 'Obra de arte original firmada por artista local', price_usd: 45.00 },
                        { name: 'Artesanía en Cerámica y Madera', description: 'Escultura artesanal venezolana', price_usd: 20.00 },
                        { name: 'Souvenir Sombrero Playero & Bolso', description: 'Artesanía de palma tejida a mano', price_usd: 15.00 }
                    ],
                    GUIA_TURISTICA: [
                        { name: 'Tour Guiado Parque Nacional', description: 'Excursión de día completo con guía bilingüe', price_usd: 30.00 },
                        { name: 'Caminata Ecológica & Avistamiento de Aves', description: 'Recorrido por senderos naturales (3 horas)', price_usd: 20.00 },
                        { name: 'Paseo Nocturno Histórico & Gastronómico', description: 'Recorrido por el casco colonial y degustación', price_usd: 25.00 }
                    ],
                    TAXIS: [
                        { name: 'Traslado Aeropuerto -> Hotel / Posada', description: 'Vehículo con aire acondicionado y equipaje', price_usd: 25.00 },
                        { name: 'Traslado Posada -> Centro Ciudad', description: 'Viaje directo de ida o vuelta', price_usd: 10.00 },
                        { name: 'Servicio de Taxi Privado por Hora', description: 'Chofer privado a disposición', price_usd: 15.00 }
                    ],
                    LANCHAS: [
                        { name: 'Paseo en Lancha a Cayos (Ida y Vuelta)', description: 'Traslado marino a islas cercanas con chalecos', price_usd: 25.00 },
                        { name: 'Alquiler de Peñero Privado por Día', description: 'Lancha exclusiva con marinero a disposición', price_usd: 120.00 },
                        { name: 'Tour de Snorkeling & Delfines', description: 'Incluye equipos de máscara y tubo', price_usd: 40.00 }
                    ],
                    TINTORERIA: [
                        { name: 'Lavado y Planchado de Traje / Vestido', description: 'Tratamiento delicado y empaque protector', price_usd: 10.00 },
                        { name: 'Servicio Express Lavandería por Kilo', description: 'Lavado, secado y doblado', price_usd: 5.00 },
                        { name: 'Planchado de Camisa / Pantalón', description: 'Planchado al vapor profesional', price_usd: 3.00 }
                    ],
                    ZAPATERIA: [
                        { name: 'Lustrado y Pulido de Calzado', description: 'Limpieza y brillo con crema nutritiva', price_usd: 4.00 },
                        { name: 'Reparación de Suela & Costura Express', description: 'Reparación y pega especializada', price_usd: 8.00 }
                    ],
                    MANICURISTA: [
                        { name: 'Manicura Rusa & Esmaltado Semi-Permanente', description: 'Limpieza de cutículas y color duradero', price_usd: 15.00 },
                        { name: 'Diseño y Decoración de Uñas', description: 'Arte en uñas y pedrería', price_usd: 18.00 }
                    ],
                    PEDICURISTA: [
                        { name: 'Pedicura Spa Profunda & Exfoliación', description: 'Baño de sales, exfoliación y masaje', price_usd: 18.00 },
                        { name: 'Tratamiento Hidratante de Parafina', description: 'Hidratación profunda para pies', price_usd: 22.00 }
                    ],
                    TECNOLOGIA: [
                        { name: 'Impresión / Escaneo de Documentos', description: 'Impresión blanco y negro o color por página', price_usd: 0.50 },
                        { name: 'Acceso WiFi Dedicado de Alta Velocidad', description: 'Pase premium por día para streaming / trabajo', price_usd: 5.00 },
                        { name: 'Asistencia Técnica & Configuración', description: 'Soporte informático básico', price_usd: 10.00 }
                    ],
                    ALQUILER_ESPACIOS: [
                        { name: 'Alquiler Salón de Eventos (Medio Día)', description: 'Uso de salón climatizado con sillas y mesas', price_usd: 100.00 },
                        { name: 'Reserva de Terrazas o Áreas del Caney', description: 'Espacio al aire libre para reuniones', price_usd: 150.00 }
                    ],
                    ALQUILER_EQUIPOS: [
                        { name: 'Alquiler de Proyector HD & Pantalla', description: 'Incluye cables HDMI y soporte', price_usd: 40.00 },
                        { name: 'Alquiler de Sistema de Sonido & Micrófono', description: 'Corneta amplificada con bluetooth', price_usd: 50.00 }
                    ],
                    HOUSEKEEPING: [
                        { name: 'Servicio de Limpieza Extra a Solicitud', description: 'Aseo completo de habitación fuera de horario', price_usd: 10.00 },
                        { name: 'Cambio Adicional de Lencería y Toallas', description: 'Juego completo de sabanas y toallas limpias', price_usd: 5.00 }
                    ]
                };

                const defaultsToSeed = DEFAULT_ITEMS[typeFilter];
                if (defaultsToSeed) {
                    for (const item of defaultsToSeed) {
                        const itemId = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                        await db.execute({
                            sql: `INSERT INTO hotel_catalog_items (id, hotel_id, department_type, name, description, price_usd)
                                  VALUES (?, ?, ?, ?, ?, ?)`,
                            args: [itemId, hotelId, typeFilter, item.name, item.description, item.price_usd]
                        });
                    }
                    catRes = await db.execute({ sql, args });
                }
            }

            return res.status(200).json(catRes.rows);
        }

        if (req.method === 'POST') {
            const { name, description, priceUsd, departmentType, departmentId } = req.body || {};
            if (!name || priceUsd === undefined || !departmentType) return res.status(400).json({ error: 'Nombre, precio y departamento son requeridos.' });

            const itemId = 'cat_' + Date.now();
            await db.execute({
                sql: `INSERT INTO hotel_catalog_items (id, hotel_id, department_type, department_id, name, description, price_usd)
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [itemId, hotelId, departmentType, departmentId || null, name, description || '', parseFloat(priceUsd)]
            });
            return res.status(201).json({ message: 'Ítem de catálogo agregado exitosamente.', id: itemId });
        }

        if (req.method === 'PUT') {
            const { itemId, name, description, priceUsd, isAvailable } = req.body || {};
            if (!itemId || !name || priceUsd === undefined) return res.status(400).json({ error: 'itemId, nombre y precio son requeridos.' });

            await db.execute({
                sql: 'UPDATE hotel_catalog_items SET name = ?, description = ?, price_usd = ?, is_available = ? WHERE id = ? AND hotel_id = ?',
                args: [name, description || '', parseFloat(priceUsd), isAvailable !== undefined ? (isAvailable ? 1 : 0) : 1, itemId, hotelId]
            });
            return res.status(200).json({ message: 'Ítem del catálogo actualizado.' });
        }

        if (req.method === 'DELETE') {
            const itemId = req.query.id;
            if (!itemId) return res.status(400).json({ error: 'itemId es requerido.' });
            await db.execute({ sql: 'DELETE FROM hotel_catalog_items WHERE id = ? AND hotel_id = ?', args: [itemId, hotelId] });
            return res.status(200).json({ message: 'Ítem eliminado.' });
        }
    }

    // Route: Bookings
    if (urlPath.includes('/bookings')) {
        if (req.method === 'GET') {
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
        }

        if (req.method === 'POST') {
            const { roomId, guestId, checkInDate, checkOutDate, depositUsd, totalAmountUsd, notes, isCheckInImmediate } = req.body || {};
            if (!roomId || !guestId || !checkInDate || !checkOutDate) {
                return res.status(400).json({ error: 'Habitación, Huésped y Fechas son requeridos.' });
            }

            const overlapCheck = await db.execute({
                sql: `SELECT id FROM bookings
                      WHERE hotel_id = ? AND room_id = ? AND status IN ('RESERVED', 'CHECKED_IN')
                        AND (check_in_date < ? AND check_out_date > ?)`,
                args: [hotelId, roomId, checkOutDate, checkInDate]
            });

            if (overlapCheck.rows.length > 0) {
                return res.status(400).json({ error: 'La habitación ya posee una reserva confirmada en las fechas seleccionadas (Prevención de sobreventa).' });
            }

            const bookingId = 'bk_' + Date.now();
            const initialStatus = isCheckInImmediate ? 'CHECKED_IN' : 'RESERVED';
            const actualCheckIn = isCheckInImmediate ? new Date().toISOString() : null;

            await db.execute({
                sql: `INSERT INTO bookings 
                (id, hotel_id, room_id, guest_id, check_in_date, check_out_date, actual_check_in, status, total_amount_usd, deposit_usd, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [bookingId, hotelId, roomId, guestId, checkInDate, checkOutDate, actualCheckIn, initialStatus, parseFloat(totalAmountUsd || 0), parseFloat(depositUsd || 0), notes || '']
            });

            if (isCheckInImmediate) {
                await db.execute({ sql: 'UPDATE rooms SET status = "OCCUPIED" WHERE id = ? AND hotel_id = ?', args: [roomId, hotelId] });
            }

            return res.status(201).json({ message: isCheckInImmediate ? 'Check-in realizado exitosamente.' : 'Reserva creada.', bookingId });
        }
    }

    // Default Route: Rooms CRUD
    if (req.method === 'GET') {
        const roomsRes = await db.execute({
            sql: `SELECT r.*, rt.name as room_type_name, rt.base_price_usd, rt.capacity
                  FROM rooms r
                  JOIN room_types rt ON r.room_type_id = rt.id
                  WHERE r.hotel_id = ?
                  ORDER BY r.room_number ASC`,
            args: [hotelId]
        });
        const typesRes = await db.execute({ sql: 'SELECT * FROM room_types WHERE hotel_id = ? ORDER BY name ASC', args: [hotelId] });
        return res.status(200).json({ rooms: roomsRes.rows, roomTypes: typesRes.rows });
    }

    if (req.method === 'POST') {
        const { action, roomNumber, roomTypeId, notes, typeName, basePriceUsd, capacity } = req.body || {};
        if (action === 'create_type') {
            if (!typeName || !basePriceUsd) return res.status(400).json({ error: 'Nombre y precio base son requeridos.' });
            const typeId = 'rt_' + Date.now();
            await db.execute({
                sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                args: [typeId, hotelId, typeName, parseFloat(basePriceUsd), parseInt(capacity || 2)]
            });
            return res.status(201).json({ message: 'Tipo de habitación creado.', id: typeId });
        }

        if (!roomNumber || !roomTypeId) return res.status(400).json({ error: 'Número de habitación y tipo son requeridos.' });
        const existingRoom = await db.execute({
            sql: 'SELECT id FROM rooms WHERE hotel_id = ? AND room_number = ?',
            args: [hotelId, roomNumber]
        });
        if (existingRoom.rows.length > 0) return res.status(400).json({ error: `La habitación N° ${roomNumber} ya existe.` });

        const roomId = 'rm_' + Date.now();
        await db.execute({
            sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
            args: [roomId, hotelId, roomTypeId, roomNumber, 'AVAILABLE', notes || '']
        });
        return res.status(201).json({ message: 'Habitación creada.', id: roomId });
    }

    if (req.method === 'PUT') {
        const { roomId, roomNumber, roomTypeId, notes, status } = req.body || {};
        if (!roomId) return res.status(400).json({ error: 'ID de habitación requerido.' });

        await db.execute({
            sql: `UPDATE rooms 
                  SET room_number = COALESCE(?, room_number),
                      room_type_id = COALESCE(?, room_type_id),
                      notes = COALESCE(?, notes),
                      status = COALESCE(?, status)
                  WHERE id = ? AND hotel_id = ?`,
            args: [roomNumber, roomTypeId, notes, status, roomId, hotelId]
        });
        return res.status(200).json({ message: 'Habitación actualizada.' });
    }

    if (req.method === 'DELETE') {
        const roomId = req.query.id;
        if (!roomId) return res.status(400).json({ error: 'ID de habitación requerido.' });
        await db.execute({ sql: 'DELETE FROM rooms WHERE id = ? AND hotel_id = ?', args: [roomId, hotelId] });
        return res.status(200).json({ message: 'Habitación eliminada.' });
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
