import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';

const url = process.env.TURSO_DATABASE_URL || 'libsql://hoteleria-herrejose.aws-ap-northeast-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkzMDU5NjYsImlkIjoiMDFhMDlhZjEtZDAwMS03M2YwLThmOTYtN2E1YzkzMTI2NDIwIiwia2lkIjoidnM2Yl9rSmo5eXJSQkdqMXQ0WWhBUnlWcVg0Tmx6LXp2elhYeHVLQnV6RSIsInJpZCI6ImU2ZmYzZjc5LWM0MDQtNDU5MC04OWE0LTA0ZDViMmFjYWQ0ZSJ9.RrSC_Z3gX5fGq--mdPp5eD8cgDAgfyTW9kW01CKF2-ntDQaxMQSxfbp4Vq7TyFzwKg44Dz3PQ7XY6wxYlIZTDw';

export const db = createClient({
    url,
    authToken
});

let isInitialized = false;

export async function initDB() {
    if (isInitialized) return;
    try {
        // Run DDL tables
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT CHECK(role IN ('SUPERADMIN', 'HOTEL_ADMIN', 'HOTEL_STAFF')) NOT NULL,
                phone TEXT,
                department_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS hotels (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id),
                name TEXT NOT NULL,
                rif TEXT NOT NULL,
                phone TEXT,
                address TEXT,
                logo_url TEXT,
                status TEXT CHECK(status IN ('TRIAL', 'ACTIVE', 'OVERDUE', 'SUSPENDED')) DEFAULT 'TRIAL',
                trial_ends_at DATETIME,
                subscription_due_date DATETIME,
                primary_color TEXT DEFAULT '#0d6efd',
                dark_mode INTEGER DEFAULT 0,
                social_links TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS banks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS saas_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS saas_payment_methods (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                currency TEXT CHECK(currency IN ('USD', 'VES')) NOT NULL,
                details TEXT NOT NULL,
                is_active INTEGER DEFAULT 1
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS saas_payments (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                method_id TEXT NOT NULL,
                reference_number TEXT NOT NULL,
                amount_usd REAL NOT NULL,
                amount_ves REAL,
                bcv_rate REAL,
                proof_url TEXT,
                status TEXT CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')) DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                approved_at DATETIME
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS hotel_departments (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                name TEXT NOT NULL,
                type TEXT CHECK(type IN ('HOUSEKEEPING', 'RESTAURANT', 'BAR', 'SPA', 'LAUNDRY', 'STORE', 'EXCURSION', 'OTHER')) DEFAULT 'OTHER',
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS room_types (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                name TEXT NOT NULL,
                base_price_usd REAL NOT NULL,
                capacity INTEGER NOT NULL DEFAULT 2
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                room_type_id TEXT NOT NULL REFERENCES room_types(id),
                room_number TEXT NOT NULL,
                status TEXT CHECK(status IN ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE')) DEFAULT 'AVAILABLE',
                notes TEXT,
                cleaned_by TEXT,
                cleaned_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS guests (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                full_name TEXT NOT NULL,
                document_type TEXT CHECK(document_type IN ('V', 'E', 'J', 'G', 'PASSPORT')) DEFAULT 'V',
                document_id TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                origin_city TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                room_id TEXT NOT NULL REFERENCES rooms(id),
                guest_id TEXT NOT NULL REFERENCES guests(id),
                check_in_date DATE NOT NULL,
                check_out_date DATE NOT NULL,
                actual_check_in DATETIME,
                actual_check_out DATETIME,
                status TEXT CHECK(status IN ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED')) DEFAULT 'RESERVED',
                total_amount_usd REAL NOT NULL,
                deposit_usd REAL DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS guest_expenses (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                booking_id TEXT NOT NULL REFERENCES bookings(id),
                department_id TEXT REFERENCES hotel_departments(id),
                staff_user_id TEXT REFERENCES users(id),
                description TEXT NOT NULL,
                amount_usd REAL NOT NULL,
                verified_by_guest INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                booking_id TEXT NOT NULL REFERENCES bookings(id),
                invoice_number TEXT NOT NULL,
                subtotal_usd REAL NOT NULL,
                total_expenses_usd REAL DEFAULT 0,
                total_usd REAL NOT NULL,
                bcv_rate REAL NOT NULL,
                total_ves REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS hotel_ratings (
                id TEXT PRIMARY KEY,
                hotel_id TEXT NOT NULL REFERENCES hotels(id),
                rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
                comment TEXT,
                reviewer_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Seed 31 Official Venezuelan Banks
        const bankCheck = await db.execute('SELECT COUNT(*) as cnt FROM banks');
        if (Number(bankCheck.rows[0].cnt) === 0) {
            const banksList = [
                { code: '0156', name: '100% Banco' },
                { code: '0172', name: 'Bancamiga' },
                { code: '0171', name: 'Banco Activo' },
                { code: '0166', name: 'Banco Agrícola de Venezuela' },
                { code: '0128', name: 'Banco Caroní' },
                { code: '0175', name: 'Banco de Comercio Exterior (BANCOEX)' },
                { code: '0174', name: 'Banco de Desarrollo Económico y Social (BANDES)' },
                { code: '0177', name: 'Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)' },
                { code: '0146', name: 'Banco de la Gente Emprendedora (Bangente)' },
                { code: '0102', name: 'Banco de Venezuela' },
                { code: '0114', name: 'Banco del Caribe (Bancaribe)' },
                { code: '0163', name: 'Banco del Tesoro' },
                { code: '0168', name: 'Banco Digital de los Trabajadores' },
                { code: '0115', name: 'Banco Exterior' },
                { code: '0173', name: 'Banco Internacional de Desarrollo' },
                { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
                { code: '0169', name: 'Banco Nacional de Vivienda y Hábitat (BANAVIH)' },
                { code: '0138', name: 'Banco Plaza' },
                { code: '0108', name: 'Banco Provincial' },
                { code: '0137', name: 'Banco Sofitasa' },
                { code: '0167', name: 'Bancrecer' },
                { code: '0134', name: 'Banesco' },
                { code: '0174-2', name: 'Banplus' },
                { code: '0151', name: 'BFC Banco Fondo Común' },
                { code: '0157', name: 'Del Sur Banco Universal' },
                { code: '0301', name: 'Instituto Municipal de Crédito Popular (IMCP)' },
                { code: '0105', name: 'Mercantil' },
                { code: '0198', name: 'N58 Banco Digital' },
                { code: '0169-2', name: 'R4 Banco Microfinanciero' },
                { code: '0104', name: 'Venezolano de Crédito' },
                { code: '0199', name: 'Mi Banco Banco Microfinanciero' }
            ];

            for (const b of banksList) {
                await db.execute({
                    sql: 'INSERT OR IGNORE INTO banks (code, name) VALUES (?, ?)',
                    args: [b.code, b.name]
                });
            }
        }

        // Seed default SaaS settings
        await db.execute(`
            INSERT OR IGNORE INTO saas_settings (key, value) VALUES ('monthly_fee_usd', '20.00')
        `);
        await db.execute(`
            INSERT OR IGNORE INTO saas_settings (key, value) VALUES ('trial_days', '30')
        `);

        // Seed default SaaS payment methods
        const pmCheck = await db.execute('SELECT COUNT(*) as cnt FROM saas_payment_methods');
        if (Number(pmCheck.rows[0].cnt) === 0) {
            await db.execute({
                sql: 'INSERT INTO saas_payment_methods (id, name, currency, details) VALUES (?, ?, ?, ?)',
                args: ['pm_pm_ves', 'Pago Móvil Banesco', 'VES', 'Banco: 0134 Banesco | RIF: J-400123456 | Teléfono: 0414-1234567']
            });
            await db.execute({
                sql: 'INSERT INTO saas_payment_methods (id, name, currency, details) VALUES (?, ?, ?, ?)',
                args: ['pm_transfer_ves', 'Transferencia Banco de Venezuela', 'VES', 'Banco: 0102 BDV | RIF: J-400123456 | Cuenta: 0102-0001-00-0000000000']
            });
            await db.execute({
                sql: 'INSERT INTO saas_payment_methods (id, name, currency, details) VALUES (?, ?, ?, ?)',
                args: ['pm_zinli', 'Zinli / Wally / USDT', 'USD', 'Zinli Email: pagos@hoteleria.com.ve | Binance Pay ID: 123456789']
            });
        }

        // Seed SuperAdmin user
        const superCheck = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: ['herrejose@gmail.com']
        });

        const defaultHash = await bcrypt.hash('MyJ01012023', 10);

        if (superCheck.rows.length === 0) {
            await db.execute({
                sql: 'INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
                args: ['usr_superadmin', 'SuperAdministrador', 'herrejose@gmail.com', defaultHash, 'SUPERADMIN', '+584120000000']
            });
        }

        // Seed Test Hotel & Hotel Admin (`hotel_prueba`)
        const testHotelUserCheck = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ? OR name = ?',
            args: ['hotel_prueba@example.com', 'hotel_prueba']
        });

        let testHotelAdminId = 'usr_hotel_prueba';
        if (testHotelUserCheck.rows.length === 0) {
            await db.execute({
                sql: 'INSERT INTO users (id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
                args: [testHotelAdminId, 'hotel_prueba', 'hotel_prueba@example.com', defaultHash, 'HOTEL_ADMIN', '+584141112233']
            });
        } else {
            testHotelAdminId = String(testHotelUserCheck.rows[0].id);
        }

        const testHotelCheck = await db.execute({
            sql: 'SELECT id FROM hotels WHERE id = ?',
            args: ['htl_prueba']
        });

        if (testHotelCheck.rows.length === 0) {
            const trialEnds = new Date();
            trialEnds.setDate(trialEnds.getDate() + 30);

            await db.execute({
                sql: `INSERT INTO hotels 
                (id, owner_id, name, rif, phone, address, logo_url, status, trial_ends_at, primary_color, dark_mode) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    'htl_prueba',
                    testHotelAdminId,
                    'Posada Turística El Caribe',
                    'J-501234567',
                    '+582952001122',
                    'Av. Aldonza Manrique, Playa El Agua, Nueva Esparta',
                    'img/logo.png',
                    'ACTIVE',
                    trialEnds.toISOString(),
                    '#0d6efd',
                    0
                ]
            });

            // Add default departments for test hotel
            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: ['dept_housekeeping', 'htl_prueba', 'Servicio de Limpieza (Housekeeping)', 'HOUSEKEEPING']
            });
            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: ['dept_restaurant', 'htl_prueba', 'Restaurante El Faro', 'RESTAURANT']
            });
            await db.execute({
                sql: 'INSERT INTO hotel_departments (id, hotel_id, name, type) VALUES (?, ?, ?, ?)',
                args: ['dept_bar', 'htl_prueba', 'Bar La Brisa', 'BAR']
            });

            // Add Staff / Mucama user for test hotel
            await db.execute({
                sql: 'INSERT INTO users (id, name, email, password_hash, role, phone, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                args: ['usr_mucama', 'María Mucama (Staff Limpieza)', 'mucama_prueba@example.com', defaultHash, 'HOTEL_STAFF', '+584125556677', 'dept_housekeeping']
            });

            // Add Room Types
            await db.execute({
                sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                args: ['rt_matrimonial', 'htl_prueba', 'Habitación Matrimonial Deluxe', 45.00, 2]
            });
            await db.execute({
                sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                args: ['rt_suite', 'htl_prueba', 'Suite VIP Vista al Mar', 85.00, 4]
            });
            await db.execute({
                sql: 'INSERT INTO room_types (id, hotel_id, name, base_price_usd, capacity) VALUES (?, ?, ?, ?, ?)',
                args: ['rt_cabana', 'htl_prueba', 'Cabaña Marina Familiar', 120.00, 6]
            });

            // Add Rooms
            await db.execute({
                sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
                args: ['rm_101', 'htl_prueba', 'rt_matrimonial', '101', 'AVAILABLE', 'Planta baja, cama King']
            });
            await db.execute({
                sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
                args: ['rm_102', 'htl_prueba', 'rt_matrimonial', '102', 'CLEANING', 'Requiere cambio de lencería y aseo profundo por mucama']
            });
            await db.execute({
                sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
                args: ['rm_201', 'htl_prueba', 'rt_suite', '201', 'OCCUPIED', 'Jacuzzi, balcón privado']
            });
            await db.execute({
                sql: 'INSERT INTO rooms (id, hotel_id, room_type_id, room_number, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
                args: ['rm_301', 'htl_prueba', 'rt_cabana', '301', 'MAINTENANCE', 'Revisión del aire acondicionado']
            });

            // Add Sample Guest
            await db.execute({
                sql: 'INSERT INTO guests (id, hotel_id, full_name, document_type, document_id, phone, email, origin_city) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                args: ['gst_001', 'htl_prueba', 'Carlos Mendoza', 'V', '18999888', '+584149998877', 'carlos@example.com', 'Caracas']
            });

            // Add Sample Active Booking
            const today = new Date().toISOString().split('T')[0];
            const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];
            await db.execute({
                sql: `INSERT INTO bookings 
                (id, hotel_id, room_id, guest_id, check_in_date, check_out_date, actual_check_in, status, total_amount_usd, deposit_usd) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: ['bk_001', 'htl_prueba', 'rm_201', 'gst_001', today, nextWeek, new Date().toISOString(), 'CHECKED_IN', 425.00, 100.00]
            });

            // Add Sample Expense from Restaurant
            await db.execute({
                sql: 'INSERT INTO guest_expenses (id, hotel_id, booking_id, department_id, staff_user_id, description, amount_usd) VALUES (?, ?, ?, ?, ?, ?, ?)',
                args: ['exp_001', 'htl_prueba', 'bk_001', 'dept_restaurant', testHotelAdminId, 'Almuerzo Mariscada Especial + 2 Bebidas', 35.50]
            });

            // Add Sample Rating
            await db.execute({
                sql: 'INSERT INTO hotel_ratings (id, hotel_id, rating, comment, reviewer_name) VALUES (?, ?, ?, ?, ?)',
                args: ['rtg_001', 'htl_prueba', 5, 'Excelente atención, habitaciones impecables y la mejor comida de la playa.', 'Familia Rodríguez']
            });
        }

        isInitialized = true;
    } catch (err) {
        console.error('Error initializing Turso DB:', err);
    }
}
