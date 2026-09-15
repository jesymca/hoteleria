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
            const { bookingId, paymentStatus, paymentMethodId, referenceNumber, bankOrigin, notes } = req.body || {};
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

            const hInfo = await db.execute({ sql: 'SELECT invoice_prefix, invoice_next_number FROM hotels WHERE id = ?', args: [hotelId] });
            const prefix = (hInfo.rows[0] && hInfo.rows[0].invoice_prefix) ? hInfo.rows[0].invoice_prefix : 'FAC-';
            const nextNum = (hInfo.rows[0] && hInfo.rows[0].invoice_next_number) ? Number(hInfo.rows[0].invoice_next_number) : 1;
            const invoiceNumber = `${prefix}${String(nextNum).padStart(6, '0')}`;

            // Increment next_number for hotel
            await db.execute({ sql: 'UPDATE hotels SET invoice_next_number = COALESCE(invoice_next_number, 1) + 1 WHERE id = ?', args: [hotelId] });

            const invoiceId = 'inv_' + Date.now();
            const invStatus = paymentStatus || 'PAID';

            await db.execute({
                sql: `INSERT INTO invoices 
                (id, hotel_id, booking_id, invoice_number, subtotal_usd, total_expenses_usd, total_usd, bcv_rate, total_ves, payment_status, payment_method_id, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [invoiceId, hotelId, bookingId, invoiceNumber, subtotalUsd, totalExpensesUsd, totalUsd, bcvRate, totalVes, invStatus, paymentMethodId || null, notes || '']
            });

            // If a payment method was provided at checkout, register the payment
            if (paymentMethodId && invStatus === 'PAID') {
                const pmRes = await db.execute({ sql: 'SELECT * FROM hotel_payment_methods WHERE id = ? AND hotel_id = ?', args: [paymentMethodId, hotelId] });
                const pm = pmRes.rows[0];
                const methodName = pm ? pm.name : 'Pago en Recepción';
                const requiresValidation = pm ? (Number(pm.requires_admin_validation) === 1) : false;
                const pStatus = requiresValidation ? 'PENDING_VALIDATION' : 'VALIDATED';

                const paymentId = 'pay_' + Date.now();
                await db.execute({
                    sql: `INSERT INTO guest_payments 
                    (id, hotel_id, booking_id, invoice_id, payment_method_id, method_name, amount_usd, amount_ves, bcv_rate, reference_number, bank_origin, notes, status, registered_by_id, registered_by_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        paymentId, hotelId, bookingId, invoiceId, paymentMethodId, methodName,
                        totalUsd, totalVes, bcvRate, referenceNumber || '', bankOrigin || '', notes || '',
                        pStatus, auth.userId, auth.name
                    ]
                });
            }

            return res.status(200).json({
                message: 'Check-out procesado exitosamente. Habitación marcada EN LIMPIEZA para el personal de aseo.',
                invoice: {
                    id: invoiceId,
                    invoiceNumber,
                    totalUsd,
                    totalVes
                }
            });
        } catch (err) {
            console.error('Checkout error:', err);
            return res.status(500).json({ error: 'Error al procesar el Check-out.' });
        }
    }

    // Route: Payment Methods
    if (urlPath.includes('/payment-methods')) {
        if (req.method === 'GET') {
            let pmRes = await db.execute({ sql: 'SELECT * FROM hotel_payment_methods WHERE hotel_id = ? ORDER BY name ASC', args: [hotelId] });
            if (pmRes.rows.length === 0) {
                // Seed default hotel payment methods
                const defaultMethods = [
                    { id: 'pm_usd_' + Date.now(), name: 'Efectivo Dólares (USD)', type: 'CASH_USD', bank_name: '', account_details: 'Pago en caja receptora', requires_val: 0 },
                    { id: 'pm_ves_' + Date.now(), name: 'Efectivo Bolívares (VES)', type: 'CASH_VES', bank_name: '', account_details: 'Tasa Oficial BCV del día', requires_val: 0 },
                    { id: 'pm_trans_' + Date.now(), name: 'Transferencia Bancaria (BNC / BDV)', type: 'TRANSFER', bank_name: 'Banco de Venezuela / BNC', account_details: 'RIF J-00000000-0 Cuenta Corriente', requires_val: 1 },
                    { id: 'pm_pmov_' + Date.now(), name: 'Pago Móvil Interbancario', type: 'PAGO_MOVIL', bank_name: 'Banco de Venezuela (0102)', account_details: 'CI/RIF: 00000000 Tel: 0414-0000000', requires_val: 1 },
                    { id: 'pm_pos_' + Date.now(), name: 'Punto de Venta / Tarjeta', type: 'POS', bank_name: 'Punto de Venta Recepción', account_details: 'Tarjetas Débito / Crédito', requires_val: 0 },
                    { id: 'pm_zelle_' + Date.now(), name: 'Zelle / Transferencia USD', type: 'ZELLE', bank_name: 'Zelle USA', account_details: 'pagos@posada.com', requires_val: 1 }
                ];
                for (const m of defaultMethods) {
                    await db.execute({
                        sql: `INSERT INTO hotel_payment_methods (id, hotel_id, name, type, bank_name, account_details, requires_admin_validation, is_active)
                              VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                        args: [m.id, hotelId, m.name, m.type, m.bank_name, m.account_details, m.requires_val]
                    });
                }
                pmRes = await db.execute({ sql: 'SELECT * FROM hotel_payment_methods WHERE hotel_id = ? ORDER BY name ASC', args: [hotelId] });
            }
            return res.status(200).json(pmRes.rows);
        }

        if (req.method === 'POST') {
            const { name, type, bankName, accountDetails, requiresAdminValidation } = req.body || {};
            if (!name || !type) return res.status(400).json({ error: 'Nombre y tipo son requeridos.' });
            const pmId = 'pm_' + Date.now();
            await db.execute({
                sql: `INSERT INTO hotel_payment_methods (id, hotel_id, name, type, bank_name, account_details, requires_admin_validation, is_active)
                      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
                args: [pmId, hotelId, name, type, bankName || '', accountDetails || '', requiresAdminValidation ? 1 : 0]
            });
            return res.status(201).json({ message: 'Forma de pago registrada exitosamente.', id: pmId });
        }

        if (req.method === 'PUT') {
            const { id, name, bankName, accountDetails, requiresAdminValidation, isActive } = req.body || {};
            if (!id) return res.status(400).json({ error: 'ID es requerido.' });
            await db.execute({
                sql: `UPDATE hotel_payment_methods 
                      SET name = COALESCE(?, name),
                          bank_name = COALESCE(?, bank_name),
                          account_details = COALESCE(?, account_details),
                          requires_admin_validation = COALESCE(?, requires_admin_validation),
                          is_active = COALESCE(?, is_active)
                      WHERE id = ? AND hotel_id = ?`,
                args: [
                    name || null,
                    bankName !== undefined ? bankName : null,
                    accountDetails !== undefined ? accountDetails : null,
                    requiresAdminValidation !== undefined ? (requiresAdminValidation ? 1 : 0) : null,
                    isActive !== undefined ? (isActive ? 1 : 0) : null,
                    id, hotelId
                ]
            });
            return res.status(200).json({ message: 'Forma de pago actualizada.' });
        }

        if (req.method === 'DELETE') {
            const pmId = req.query.id;
            if (!pmId) return res.status(400).json({ error: 'ID es requerido.' });
            await db.execute({ sql: 'DELETE FROM hotel_payment_methods WHERE id = ? AND hotel_id = ?', args: [pmId, hotelId] });
            return res.status(200).json({ message: 'Forma de pago eliminada.' });
        }
    }

    // Route: Guest Payments & POS Cobros
    if (urlPath.includes('/guest-payments')) {
        if (req.method === 'GET') {
            const bookingId = req.query.bookingId;
            const statusFilter = req.query.status;
            let sql = `
                SELECT p.*, b.room_id, r.room_number, g.full_name as guest_name
                FROM guest_payments p
                JOIN bookings b ON p.booking_id = b.id
                JOIN rooms r ON b.room_id = r.id
                JOIN guests g ON b.guest_id = g.id
                WHERE p.hotel_id = ?
            `;
            let args = [hotelId];
            if (bookingId) {
                sql += ' AND p.booking_id = ?';
                args.push(bookingId);
            }
            if (statusFilter) {
                sql += ' AND p.status = ?';
                args.push(statusFilter);
            }
            sql += ' ORDER BY p.created_at DESC';
            const payRes = await db.execute({ sql, args });
            return res.status(200).json(payRes.rows);
        }

        if (req.method === 'POST') {
            const { bookingId, invoiceId, paymentMethodId, amountUsd, referenceNumber, bankOrigin, notes } = req.body || {};
            if (!bookingId || !paymentMethodId || !amountUsd) {
                return res.status(400).json({ error: 'Reserva, forma de pago y monto son requeridos.' });
            }

            const pmRes = await db.execute({ sql: 'SELECT * FROM hotel_payment_methods WHERE id = ? AND hotel_id = ?', args: [paymentMethodId, hotelId] });
            const pm = pmRes.rows[0];
            if (!pm) return res.status(404).json({ error: 'Forma de pago no encontrada.' });

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

            const amtUsd = parseFloat(amountUsd);
            const amtVes = amtUsd * bcvRate;
            const requiresValidation = Number(pm.requires_admin_validation) === 1;
            const status = requiresValidation ? 'PENDING_VALIDATION' : 'VALIDATED';
            const paymentId = 'pay_' + Date.now();

            await db.execute({
                sql: `INSERT INTO guest_payments 
                (id, hotel_id, booking_id, invoice_id, payment_method_id, method_name, amount_usd, amount_ves, bcv_rate, reference_number, bank_origin, notes, status, registered_by_id, registered_by_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    paymentId, hotelId, bookingId, invoiceId || null, paymentMethodId, pm.name,
                    amtUsd, amtVes, bcvRate, referenceNumber || '', bankOrigin || '', notes || '',
                    status, auth.userId, auth.name
                ]
            });

            // Update booking deposit or invoice status if applicable
            await db.execute({
                sql: 'UPDATE bookings SET deposit_usd = deposit_usd + ? WHERE id = ? AND hotel_id = ?',
                args: [amtUsd, bookingId, hotelId]
            });

            if (invoiceId) {
                await db.execute({
                    sql: "UPDATE invoices SET payment_status = 'PAID' WHERE id = ? AND hotel_id = ?",
                    args: [invoiceId, hotelId]
                });
            }

            return res.status(201).json({
                message: requiresValidation 
                    ? 'Pago registrado exitosamente por Recepción. En espera de validación por Administración.' 
                    : 'Pago registrado y confirmado exitosamente.',
                paymentId,
                status
            });
        }

        if (req.method === 'PUT') {
            const { paymentId, action, notes } = req.body || {};
            if (!paymentId || !action) return res.status(400).json({ error: 'paymentId y acción son requeridos.' });

            if (auth.role !== 'HOTEL_ADMIN' && auth.role !== 'SUPERADMIN') {
                return res.status(403).json({ error: 'Solo el Administrador del hotel o Staff de Administración pueden validar pagos.' });
            }

            const newStatus = action === 'validate' ? 'VALIDATED' : 'REJECTED';
            const nowIso = new Date().toISOString();

            await db.execute({
                sql: `UPDATE guest_payments 
                      SET status = ?, notes = COALESCE(?, notes), validated_by_id = ?, validated_by_name = ?, validated_at = ?
                      WHERE id = ? AND hotel_id = ?`,
                args: [newStatus, notes || null, auth.userId, auth.name, nowIso, paymentId, hotelId]
            });

            return res.status(200).json({ message: `Pago ${action === 'validate' ? 'validado' : 'rechazado'} correctamente.`, status: newStatus });
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
                    GIMNASIO: [
                        { name: 'Pase de Día Gimnasio & Fitness', description: 'Acceso ilimitado a máquinas y área de pesas por 1 día', price_usd: 8.00 },
                        { name: 'Sesión con Entrenador Personal (1 Hora)', description: 'Entrenamiento guiado individualizado', price_usd: 20.00 },
                        { name: 'Clase Grupal de Yoga / Pilates', description: 'Sesión de relajación y estiramiento con instructor', price_usd: 12.00 }
                    ],
                    PADEL: [
                        { name: 'Alquiler Cancha de Pádel (1 Hora)', description: 'Uso exclusivo de cancha de pádel de césped sintético', price_usd: 25.00 },
                        { name: 'Alquiler de Raqueta & Bolas de Pádel', description: 'Incluye 1 pala profesional y tubo de 3 pelotas', price_usd: 5.00 },
                        { name: 'Clase Particular de Pádel', description: 'Entrenamiento técnico con instructor certificado', price_usd: 30.00 }
                    ],
                    GUARDERIA: [
                        { name: 'Cuidado Infantil por Hora (Kids Club)', description: 'Atención especializada por recreadores en área de juegos', price_usd: 10.00 },
                        { name: 'Pase Día Completo Guardería Infantil', description: 'Incluye actividades recreativas, manualidades y snacks', price_usd: 25.00 },
                        { name: 'Taller de Arte & Cerámica Infantil', description: 'Sesión creativa con materiales incluidos', price_usd: 15.00 }
                    ],
                    CINE: [
                        { name: 'Entrada a Función de Cine VIP (Por Persona)', description: 'Acceso a sala climatizada con butacas reclinables', price_usd: 6.00 },
                        { name: 'Combo Cotufas / Palomitas + Refresco Grande', description: 'Palomitas de maíz recién hechas y bebida fría 500ml', price_usd: 5.00 },
                        { name: 'Reserva Privada Sala de Cine (2 Horas)', description: 'Uso exclusivo de la sala para grupos o familias', price_usd: 40.00 }
                    ],
                    PISCINA: [
                        { name: 'Daypass Pase de Día Piscina Principal', description: 'Acceso full day a piscinas y duchas para visitantes', price_usd: 20.00 },
                        { name: 'Alquiler Cama Balinesa / Cama VIP por Día', description: 'Reserva de cama acolchada sombreada con toallas', price_usd: 35.00 },
                        { name: 'Alquiler de Inflables & Flotadores', description: 'Variedad de flotadores divertidos para piscina', price_usd: 8.00 }
                    ],
                    PLAYA: [
                        { name: 'Alquiler Toldo Playero + 2 Sillas Reclinables', description: 'Instalación en la orilla de la playa con servicio de camarero', price_usd: 15.00 },
                        { name: 'Coco Frío Natural con Sorbete', description: 'Agua de coco fresca recién cortada', price_usd: 3.00 },
                        { name: 'Servicio de Tumbona Playera Adicional', description: 'Silla reclinable de playa por día completo', price_usd: 8.00 }
                    ],
                    GOLF: [
                        { name: 'Green Fee Campo de Golf (18 Hoyos)', description: 'Pase al campo de golf con tarjeta de anotación', price_usd: 50.00 },
                        { name: 'Alquiler Carrito de Golf Eléctrico', description: 'Uso por recorrido completo de 18 hoyos', price_usd: 30.00 },
                        { name: 'Set Completo de Palos de Golf & Pelotas', description: 'Bolsa con maderas, hierros, putter y 6 pelotas', price_usd: 20.00 }
                    ],
                    LENCERIA: [
                        { name: 'Juego de Toallas Playeras Adicionales', description: '2 toallas grandes de microfibra de secado rápido', price_usd: 3.00 },
                        { name: 'Almohadón Ortopédico / Anatómico Extra', description: 'Almohada de espuma viscoelástica a solicitud', price_usd: 4.00 },
                        { name: 'Cobija o Manta Térmica Adicional', description: 'Manta suave extra para la habitación', price_usd: 5.00 }
                    ],
                    TENIS: [
                        { name: 'Alquiler Cancha de Tenis (1 Hora)', description: 'Uso de cancha iluminada de arcilla o dura', price_usd: 20.00 },
                        { name: 'Alquiler de 2 Raquetas & Pelotas de Tenis', description: 'Equipo listo para juego en pareja', price_usd: 6.00 },
                        { name: 'Clase Particular de Tenis con Pro', description: 'Lección de 60 minutos con entrenador', price_usd: 25.00 }
                    ],
                    SURF: [
                        { name: 'Alquiler Tabla de Surf (Medio Día)', description: 'Variedad de tablas Softboard, Shortboard y Longboard', price_usd: 20.00 },
                        { name: 'Clase de Surf con Instructor (90 Minutos)', description: 'Teoría en arena e instrucción práctica en olas', price_usd: 35.00 },
                        { name: 'Alquiler de Stand Up Paddleboard (SUP)', description: 'Tabla de remo de pie con remo ajustable por hora', price_usd: 15.00 }
                    ],
                    CABALLOS: [
                        { name: 'Paseo a Caballo por la Playa (45 min)', description: 'Recorrido guiado por la orilla del mar al atardecer', price_usd: 25.00 },
                        { name: 'Ruta Ecuestre Guiada por la Montaña', description: 'Expedición por senderos ecológicos (2 horas)', price_usd: 35.00 }
                    ],
                    CUATRIMOTOS: [
                        { name: 'Tour en Cuatrimoto 4x4 por Senderos (1 Hora)', description: 'Recorrido todoterreno en ATV rústico con casco', price_usd: 40.00 },
                        { name: 'Alquiler de Buggy Playero 2 Puestos (2 Horas)', description: 'Vehículo rústico ligero para dunas y caminos', price_usd: 60.00 }
                    ],
                    HELADERIA: [
                        { name: 'Barquilla de Helado Artesanal (2 Bolas)', description: 'Variedad de sabores criollos e internacionales', price_usd: 3.50 },
                        { name: 'Merengada Espesa de Mantecado o Chocolate', description: 'Batido con crema batida y chispas', price_usd: 5.00 },
                        { name: 'Copa Sundae Especial con Sirope y Frutas', description: '3 bolas de helado, topping de chocolate y nueces', price_usd: 6.00 }
                    ],
                    BODEGON: [
                        { name: 'Vino Tinto Reserva Importado 0.75L', description: 'Botella de vino de cepa seleccionada', price_usd: 25.00 },
                        { name: 'Whisky 12 Años Botella Premium', description: 'Servicio sellado con hielera y vasos fetiche', price_usd: 60.00 },
                        { name: 'Tabla de Quesos Madurados & Embutidos', description: 'Selección de quesos gourmet, aceitunas y galletas', price_usd: 20.00 }
                    ],
                    TIENDA: [
                        { name: 'Protector Solar SPF 50+ Resistente al Agua', description: 'Loción solar dermatológica 200ml', price_usd: 15.00 },
                        { name: 'Traje de Baño / Franela Playera Marca Hotel', description: 'Prenda textil oficial con diseño exclusivo', price_usd: 25.00 },
                        { name: 'Artesanía & Souvenir Típico Venezolano', description: 'Pieza decorativa hecha por artesanos locales', price_usd: 10.00 }
                    ],
                    BUCEO: [
                        { name: 'Bautizo de Buceo Submarino PADI', description: 'Experiencia introductoria con equipo y tanque bajo el agua', price_usd: 60.00 },
                        { name: 'Inmersión de Buceo Profundo Certificados', description: 'Salida en bote a arrecifes de coral con guía', price_usd: 50.00 },
                        { name: 'Alquiler de Kit Snorkeling (Visor, Tubo y Aletas)', description: 'Equipo completo de careteo por día', price_usd: 12.00 }
                    ],
                    PARAPENTE: [
                        { name: 'Vuelo Tándem en Parapente con Instructor', description: 'Vuelo panorámico biplaza sobre la costa/valle con video Go-Pro', price_usd: 70.00 },
                        { name: 'Circuito Extremo de Tirolesa / Canopy', description: 'Recorrido por cable sobre la copa de los árboles', price_usd: 30.00 }
                    ],
                    PESCA: [
                        { name: 'Chárter de Pesca Deportiva en Alta Mar', description: 'Salida de 4 horas en embarcación con marineros y carnada', price_usd: 250.00 },
                        { name: 'Alquiler de Caña y Carrete de Pesca', description: 'Equipo de pesca desde muelle o playa por día', price_usd: 20.00 }
                    ],
                    VEHICULOS: [
                        { name: 'Alquiler Rústico 4x4 por Día (Toyota / Jeep)', description: 'Vehículo todoterreno con km libre e seguro básico', price_usd: 90.00 },
                        { name: 'Alquiler Carrito Eléctrico Urbano por Día', description: 'Vehículo ecológico de 4 puestos para dentro de la propiedad', price_usd: 45.00 }
                    ],
                    EVENTOS: [
                        { name: 'Alquiler y Montaje Salón de Bodas / Eventos', description: 'Uso de salón decorado con climatización y luces', price_usd: 300.00 },
                        { name: 'Servicio de Coctelería & Meseros para Evento', description: 'Personal de atención por 4 horas', price_usd: 80.00 }
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
        const { action, roomNumber, roomTypeId, notes, typeName, basePriceUsd, capacity, status } = req.body || {};
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
            args: [roomId, hotelId, roomTypeId, roomNumber, status || 'AVAILABLE', notes || '']
        });
        return res.status(201).json({ message: 'Habitación creada.', id: roomId });
    }

    if (req.method === 'PUT') {
        const { action, typeId, typeName, basePriceUsd, capacity, roomId, roomNumber, roomTypeId, notes, status } = req.body || {};
        
        if (action === 'update_type' || typeId) {
            if (!typeId || !typeName || basePriceUsd === undefined) return res.status(400).json({ error: 'ID, nombre y precio del tipo de habitación son requeridos.' });
            await db.execute({
                sql: 'UPDATE room_types SET name = ?, base_price_usd = ?, capacity = ? WHERE id = ? AND hotel_id = ?',
                args: [typeName, parseFloat(basePriceUsd), parseInt(capacity || 2), typeId, hotelId]
            });
            return res.status(200).json({ message: 'Tipo de habitación actualizado.' });
        }

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
        const typeId = req.query.typeId;
        if (typeId) {
            const inUse = await db.execute({
                sql: 'SELECT id FROM rooms WHERE room_type_id = ? AND hotel_id = ? LIMIT 1',
                args: [typeId, hotelId]
            });
            if (inUse.rows.length > 0) {
                return res.status(400).json({ error: 'No se puede eliminar este tipo porque hay habitaciones asignadas a él. Reasigne o elimine las habitaciones primero.' });
            }
            await db.execute({ sql: 'DELETE FROM room_types WHERE id = ? AND hotel_id = ?', args: [typeId, hotelId] });
            return res.status(200).json({ message: 'Tipo de habitación eliminado.' });
        }

        const roomId = req.query.id;
        if (!roomId) return res.status(400).json({ error: 'ID de habitación requerido.' });
        await db.execute({ sql: 'DELETE FROM rooms WHERE id = ? AND hotel_id = ?', args: [roomId, hotelId] });
        return res.status(200).json({ message: 'Habitación eliminada.' });
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
