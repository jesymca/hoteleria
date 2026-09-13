# 🏨 Sistema SaaS de Control y Gestión de Hotelería y Posadas en Venezuela

![Logo Hotel](img/logo.png)

Plataforma Web SaaS de Grado Premium desarrollada para la gestión operativa, comercial y administrativa de hoteles, posadas y alojamientos en Venezuela. Diseñada bajo una arquitectura segura, desacoplada y escalable con **Vercel Serverless Functions** (`/api`) y un **Frontend SPA reactivo** (`public/`).

## 🌟 Características Principales

### 👑 Módulo SuperAdministrador
- **Tarifas y Ajustes SaaS**: Configuración dinámica de la cuota mensual ($20.00 USD por defecto) y días de prueba (30 días).
- **Sincronización de Tasa Oficial BCV**: Integración en tiempo real con DolarAPI (`https://ve.dolarapi.com/v1/dolares`) para conversión automática VES/USD.
- **Validación de Pagos de Membresía**: Panel interactivo con visor de comprobantes (alojados en Cloudflare R2) para aprobar o rechazar reportes de pago (Pago Móvil, Transferencias VES, Zinli, Wally, Binance, Efectivo, etc.).
- **Catálogo de 31 Bancos Venezolanos**: Semilla integrada con la lista oficial de instituciones financieras activas en Venezuela.
- **Monitor de Conectividad en Tiempo Real**: Medición de latencia en milisegundos para Turso DB, Cloudflare R2 y DolarAPI BCV.
- **Gestión Global de Establecimientos**: Directorio de hoteles, estado de suscripción (TRIAL, ACTIVE, OVERDUE, SUSPENDED) y suspensión/reactivación rápida.

### 🏢 Módulo Comercio (Hotel / Posada)
- **Rack Visual e Interactivo de Habitaciones**:
  - 🟢 **Disponible**
  - 🔴 **Ocupada** (muestra nombre del huésped y fecha de salida)
  - 🟡 **En Limpieza / Aseo** (botón de 1-clic para cambio de estado por Personal de Limpieza / Mucamas)
  - 🟠 **En Mantenimiento**
- **Personalización Completa de Habitaciones**: Creación libre de tipos y nombres especiales (ej. "Suite VIP", "Cabaña Marina", "Habitación Matrimonial").
- **Modulo de Limpieza / Housekeeping (Mucamas)**: Panel simplificado para que el personal de servicio técnico y mucamas puedan marcar habitaciones como **Limpias y Disponibles** al instante.
- **Gestión de Reservas & Huéspedes**: Asistente de Check-in y Check-out con algoritmo de prevención de sobreventa (*overbooking*).
- **Consumos y Servicios Adicionales**: Registro instantáneo de consumos a la habitación (Restaurante, Bar, Lavandería, Excursiones) con asignación de personal por departamento (ej. Restaurante).
- **Facturación y Comprobantes PDF**: Emisión con `jsPDF` + `autoTable` incluyendo logo corporativo (desde Cloudflare R2), RIF, teléfonos, desglose en USD y su equivalente en Bolívares (VES) a la Tasa Oficial BCV vigente.
- **Personalización de Marca y Tema**: Configuración de logo, datos de contacto, RIF, paleta de colores y selector de Modo Claro / Modo Oscuro.

### 🌐 Landing Page Pública y Valoraciones
- **Carrusel de Hoteles Afiliados**: Exposición de los establecimientos que utilizan el sistema.
- **Calificación por Estrellas (1 al 5)**: Componente interactivo para que los visitantes valoren los hoteles afiliados.
- **Acceso Directo y Google OAuth**: Opción de inicio de sesión tradicional y botón de integración con Google Login.

---

## 🛠️ Tecnologías e Infraestructura

- **Frontend**: HTML5, CSS3 (Vanilla CSS + Bootstrap 5.3 + Bootstrap Icons + Fuente Inter), JavaScript ES6+ SPA con Hash Routing (`window.location.hash`).
- **Backend**: Vercel Serverless Functions (`/api/`) en Node.js ES Modules.
- **Base de Datos**: Turso DB / libSQL (`@libsql/client`) con aislamiento multi-tenant estricto por `hotel_id`.
- **Almacenamiento Multimedia**: Cloudflare R2 Storage mediante URLs prefirmadas (`@aws-sdk/client-s3`) y compresión client-side en `<canvas>` (máx. 800px WebP/JPEG 0.85).
- **Reportes PDF**: `jsPDF` y `jsPDF-AutoTable`.
- **Autenticación**: JSON Web Tokens (JWT) firmados e hiperseguros con contraseñas encriptadas mediante `bcryptjs`.

---

## 🚀 Despliegue en Vercel

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/herrejose/hoteleria.git
   cd hoteleria
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno en Vercel o archivo `.env`:
   ```env
   TURSO_DATABASE_URL=libsql://hoteleria-herrejose.aws-ap-northeast-1.turso.io
   TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
   R2_ACCOUNT_ID=da7c23add0ce839e4989c068fbfa4394
   R2_ACCESS_KEY_ID=tu_access_key
   R2_SECRET_ACCESS_KEY=tu_secret_key
   R2_BUCKET_NAME=hoteleria
   R2_PUBLIC_URL=https://pub-49558c729b6b41ec952687ab33845c74.r2.dev
   JWT_SECRET=super_secreto_para_firmar_tokens_jwt_saas_hoteles_2026
   ```
4. Desplegar con la CLI de Vercel:
   ```bash
   vercel --prod
   ```

---

## 🔑 Credenciales Predeterminadas (Semilla DB)

- **SuperAdministrador**:
  - **Email**: `herrejose@gmail.com`
  - **Contraseña**: `MyJ01012023`
- **Hotel de Prueba**:
  - **Usuario / Email**: `hotel_prueba@example.com` (o usuario `hotel_prueba`)
  - **Contraseña**: `MyJ01012023`

---

## 📜 Licencia

Desarrollado con estándares de software SaaS de grado comercial. Licencia MIT.
