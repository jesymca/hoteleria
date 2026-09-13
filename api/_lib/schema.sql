-- Esquema de Base de Datos para Turso DB (libSQL)
-- Sistema SaaS de Control y Gestión de Hotelería y Posadas en Venezuela

-- 1. Usuarios y Roles
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

-- 2. Hoteles y Posadas (Tenants Multi-tenant)
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

-- 3. Catálogo Oficial de 31 Bancos Nacionales de Venezuela
CREATE TABLE IF NOT EXISTS banks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

-- 4. Ajustes Globales SaaS (Tarifa mensual, Días de prueba, Tasa BCV caché)
CREATE TABLE IF NOT EXISTS saas_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Métodos de Pago Habilitados para Membresía SaaS
CREATE TABLE IF NOT EXISTS saas_payment_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    currency TEXT CHECK(currency IN ('USD', 'VES')) NOT NULL,
    details TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
);

-- 6. Pagos de Suscripción SaaS Reportados
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

-- 7. Departamentos / Áreas Internas del Hotel (Restaurante, Bar, Limpieza, etc.)
CREATE TABLE IF NOT EXISTS hotel_departments (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL REFERENCES hotels(id),
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('HOUSEKEEPING', 'RESTAURANT', 'BAR', 'SPA', 'LAUNDRY', 'STORE', 'EXCURSION', 'OTHER')) DEFAULT 'OTHER',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tipos y Estilos de Habitación (100% Personalizables)
CREATE TABLE IF NOT EXISTS room_types (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL REFERENCES hotels(id),
    name TEXT NOT NULL,
    base_price_usd REAL NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 2
);

-- 9. Habitaciones (Rack Físico y Control de Estado)
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

-- 10. Directorio de Huéspedes
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

-- 11. Reservas y Ocupación
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

-- 12. Consumos y Servicios Adicionales en Habitación
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

-- 13. Facturas y Cierres de Cuenta
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

-- 14. Calificación Pública de Hoteles (1 a 5 estrellas para Carrusel Landing)
CREATE TABLE IF NOT EXISTS hotel_ratings (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL REFERENCES hotels(id),
    rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
    comment TEXT,
    reviewer_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Catálogo de Productos y Servicios por Departamento/Área (Restaurante, Bar, Spa, Peluquería, Taxis, Lanchas, etc.)
CREATE TABLE IF NOT EXISTS hotel_catalog_items (
    id TEXT PRIMARY KEY,
    hotel_id TEXT NOT NULL REFERENCES hotels(id),
    department_type TEXT NOT NULL,
    department_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price_usd REAL NOT NULL,
    is_available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. Permisos Granulares de Staff por Departamento/Tipo de Servicio
CREATE TABLE IF NOT EXISTS staff_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    hotel_id TEXT NOT NULL REFERENCES hotels(id),
    department_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, department_type)
);

