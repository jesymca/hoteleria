import { db, initDB } from '../_lib/turso.js';
import { requireAuth } from '../_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();

    // GET payments: Hotel admin sees their own, SuperAdmin sees all
    if (req.method === 'GET') {
        try {
            let sql = `
                SELECT p.*, h.name as hotel_name, h.rif as hotel_rif,
                       pm.name as method_name, pm.currency as method_currency
                FROM saas_payments p
                JOIN hotels h ON p.hotel_id = h.id
                JOIN saas_payment_methods pm ON p.method_id = pm.id
            `;
            let args = [];

            if (auth.role !== 'SUPERADMIN') {
                sql += ' WHERE p.hotel_id = ?';
                args.push(auth.hotelId);
            }

            sql += ' ORDER BY p.created_at DESC';
            const pRes = await db.execute({ sql, args });

            return res.status(200).json(pRes.rows);
        } catch (err) {
            console.error('Fetch SaaS payments error:', err);
            return res.status(500).json({ error: 'Error al consultar pagos de membresía.' });
        }
    }

    // POST: Hotel reports new SaaS payment
    if (req.method === 'POST') {
        try {
            const { methodId, referenceNumber, amountUsd, amountVes, bcvRate, proofUrl } = req.body || {};

            if (!methodId || !referenceNumber || !amountUsd) {
                return res.status(400).json({ error: 'Método, N° de referencia y monto son requeridos.' });
            }

            const paymentId = 'pay_' + Date.now();
            await db.execute({
                sql: `INSERT INTO saas_payments 
                (id, hotel_id, method_id, reference_number, amount_usd, amount_ves, bcv_rate, proof_url, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
                args: [
                    paymentId,
                    auth.hotelId,
                    methodId,
                    referenceNumber,
                    parseFloat(amountUsd),
                    amountVes ? parseFloat(amountVes) : null,
                    bcvRate ? parseFloat(bcvRate) : null,
                    proofUrl || ''
                ]
            });

            return res.status(201).json({
                message: 'Reporte de pago registrado exitosamente. En proceso de verificación por el SuperAdministrador.',
                paymentId
            });
        } catch (err) {
            console.error('Report SaaS payment error:', err);
            return res.status(500).json({ error: 'Error al reportar pago de membresía.' });
        }
    }

    // PUT: SuperAdmin Approves or Rejects Payment
    if (req.method === 'PUT') {
        if (auth.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Solo el SuperAdministrador puede procesar pagos.' });
        }

        try {
            const { paymentId, status } = req.body || {};

            if (!paymentId || !['APPROVED', 'REJECTED'].includes(status)) {
                return res.status(400).json({ error: 'paymentId y estatus válido (APPROVED/REJECTED) son requeridos.' });
            }

            const pCheck = await db.execute({
                sql: 'SELECT * FROM saas_payments WHERE id = ?',
                args: [paymentId]
            });

            if (pCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Pago no encontrado.' });
            }

            const payment = pCheck.rows[0];
            const nowIso = new Date().toISOString();

            await db.execute({
                sql: 'UPDATE saas_payments SET status = ?, approved_at = ? WHERE id = ?',
                args: [status, status === 'APPROVED' ? nowIso : null, paymentId]
            });

            if (status === 'APPROVED') {
                // Activate hotel subscription for 30 days
                const newDueDate = new Date();
                newDueDate.setDate(newDueDate.getDate() + 30);

                await db.execute({
                    sql: 'UPDATE hotels SET status = "ACTIVE", subscription_due_date = ? WHERE id = ?',
                    args: [newDueDate.toISOString(), payment.hotel_id]
                });
            }

            return res.status(200).json({
                message: status === 'APPROVED' ? 'Pago aprobado. Licencia del hotel activada por 30 días.' : 'Pago rechazado.'
            });
        } catch (err) {
            console.error('Approve payment error:', err);
            return res.status(500).json({ error: 'Error al procesar el pago.' });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
