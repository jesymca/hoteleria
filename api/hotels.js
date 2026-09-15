import { db, initDB } from './_lib/turso.js';
import { requireAuth } from './_lib/auth.js';

export default async function handler(req, res) {
    const auth = requireAuth(req, res);
    if (!auth) return;

    await initDB();
    const hotelId = auth.hotelId;

    if (!hotelId && auth.role !== 'SUPERADMIN') {
        return res.status(400).json({ error: 'Usuario no tiene un hotel asignado.' });
    }

    if (req.method === 'GET') {
        try {
            const targetId = req.query.id || hotelId;
            const hRes = await db.execute({
                sql: 'SELECT * FROM hotels WHERE id = ?',
                args: [targetId]
            });
            if (hRes.rows.length === 0) {
                return res.status(404).json({ error: 'Hotel no encontrado.' });
            }
            return res.status(200).json(hRes.rows[0]);
        } catch (err) {
            console.error('Fetch hotel error:', err);
            return res.status(500).json({ error: 'Error al obtener datos del hotel.' });
        }
    }

    if (req.method === 'PUT') {
        try {
            const { 
                name, rif, phone, address, logo_url, primary_color, dark_mode, social_links, 
                check_in_time, check_out_time,
                invoice_prefix, invoice_next_number, invoice_header_notes, invoice_footer_notes,
                invoice_show_logo
            } = req.body || {};

            // Ensure no undefined values are passed to libSQL args
            const safeName = name ?? null;
            const safeRif = rif ?? null;
            const safePhone = phone ?? null;
            const safeAddress = address ?? null;
            const safeLogoUrl = logo_url ?? null;
            const safeColor = primary_color ?? null;
            const safeDarkMode = dark_mode !== undefined ? (dark_mode ? 1 : 0) : null;
            const safeSocial = social_links ?? null;
            const safeCheckIn = check_in_time ?? null;
            const safeCheckOut = check_out_time ?? null;
            const safeInvPrefix = invoice_prefix ?? null;
            const safeInvNextNum = invoice_next_number !== undefined && invoice_next_number !== null ? parseInt(invoice_next_number) : null;
            const safeInvHeader = invoice_header_notes ?? null;
            const safeInvFooter = invoice_footer_notes ?? null;
            const safeInvShowLogo = invoice_show_logo !== undefined && invoice_show_logo !== null ? (invoice_show_logo ? 1 : 0) : null;

            await db.execute({
                sql: `UPDATE hotels 
                SET name = COALESCE(?, name),
                    rif = COALESCE(?, rif),
                    phone = COALESCE(?, phone),
                    address = COALESCE(?, address),
                    logo_url = COALESCE(?, logo_url),
                    primary_color = COALESCE(?, primary_color),
                    dark_mode = COALESCE(?, dark_mode),
                    social_links = COALESCE(?, social_links),
                    check_in_time = COALESCE(?, check_in_time),
                    check_out_time = COALESCE(?, check_out_time),
                    invoice_prefix = COALESCE(?, invoice_prefix),
                    invoice_next_number = COALESCE(?, invoice_next_number),
                    invoice_header_notes = COALESCE(?, invoice_header_notes),
                    invoice_footer_notes = COALESCE(?, invoice_footer_notes),
                    invoice_show_logo = COALESCE(?, invoice_show_logo)
                WHERE id = ?`,
                args: [
                    safeName, safeRif, safePhone, safeAddress, safeLogoUrl, safeColor, 
                    safeDarkMode, safeSocial, safeCheckIn, safeCheckOut,
                    safeInvPrefix, safeInvNextNum, safeInvHeader, safeInvFooter, safeInvShowLogo,
                    hotelId
                ]
            });

            const updated = await db.execute({
                sql: 'SELECT * FROM hotels WHERE id = ?',
                args: [hotelId]
            });

            return res.status(200).json(updated.rows[0]);
        } catch (err) {
            console.error('Update hotel error:', err);
            return res.status(500).json({ error: `Error al actualizar perfil del hotel: ${err.message}` });
        }
    }

    return res.status(405).json({ error: 'Método no permitido' });
}
