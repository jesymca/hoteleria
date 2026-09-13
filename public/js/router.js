// Hash Routing Controller & Dynamic Branding Navbar
import { State } from './state.js';
import { ViewsHotel } from './views-hotel.js';
import { ViewsAdmin } from './views-admin.js';

export const Router = {
    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },

    async handleRoute() {
        const hash = window.location.hash || '#inicio';
        const mainContainer = document.getElementById('mainContentContainer');
        const landingContainer = document.getElementById('landingContainer');
        const navbarNav = document.getElementById('navbarNavContent');

        // Check Authentication
        const isAuthenticated = State.isAuthenticated();
        const user = State.getUser();

        // If not authenticated and trying to access protected route
        if (!isAuthenticated && hash !== '#inicio' && hash !== '#login' && hash !== '#registro') {
            landingContainer.classList.remove('d-none');
            mainContainer.classList.add('d-none');
            this.renderNavbar(navbarNav, null);
            return;
        }

        // Public Landing Route
        if (!isAuthenticated || hash === '#inicio') {
            landingContainer.classList.remove('d-none');
            mainContainer.classList.add('d-none');
            this.renderNavbar(navbarNav, null);
            return;
        }

        // Authenticated User Dashboard
        landingContainer.classList.add('d-none');
        mainContainer.classList.remove('d-none');

        this.renderNavbar(navbarNav, user);

        // Route Switch
        switch (hash) {
            // Hotel Admin / Staff Routes
            case '#habitaciones':
                ViewsHotel.renderRack(mainContainer);
                break;
            case '#limpieza':
                ViewsHotel.renderLimpieza(mainContainer);
                break;
            case '#reservas':
            case '#huespedes':
                ViewsHotel.renderReservas(mainContainer);
                break;
            case '#consumos':
                ViewsHotel.renderConsumos(mainContainer);
                break;
            case '#facturacion':
                ViewsHotel.renderFacturacion(mainContainer);
                break;
            case '#areas':
                ViewsHotel.renderAreas(mainContainer);
                break;
            case '#ajustes':
                ViewsHotel.renderAjustes(mainContainer);
                break;
            case '#pagos':
                ViewsHotel.renderPagos(mainContainer);
                break;

            // specialized POS service routes
            case '#restaurante':
                ViewsHotel.renderServicioPOS(mainContainer, 'RESTAURANT', 'Restaurante & Comedor', 'Menú de platos y gastronomía', 'bi-utensils');
                break;
            case '#bar':
                ViewsHotel.renderServicioPOS(mainContainer, 'BAR', 'Bar & Coctelería', 'Bebidas, cócteles y licores', 'bi-cup-straw');
                break;
            case '#spa':
                ViewsHotel.renderServicioPOS(mainContainer, 'SPA', 'Spa & Masajes', 'Tratamientos corporales y relajación', 'bi-flower1');
                break;
            case '#peluqueria':
                ViewsHotel.renderServicioPOS(mainContainer, 'PELUQUERIA', 'Peluquería & Barbería', 'Cortes, peinados y estética capilar', 'bi-scissors');
                break;
            case '#galeria':
                ViewsHotel.renderServicioPOS(mainContainer, 'GALERIA', 'Galería & Arte', 'Souvenirs, artesanías y cuadros', 'bi-palette');
                break;
            case '#guia-turistica':
                ViewsHotel.renderServicioPOS(mainContainer, 'GUIA_TURISTICA', 'Guía Turística & Tours', 'Excursiones y paseos guiados', 'bi-compass');
                break;
            case '#taxis':
                ViewsHotel.renderServicioPOS(mainContainer, 'TAXIS', 'Servicio de Taxis & Traslados', 'Traslados aeropuerto y ciudad', 'bi-car-front-fill');
                break;
            case '#lanchas':
                ViewsHotel.renderServicioPOS(mainContainer, 'LANCHAS', 'Paseos en Lancha & Botes', 'Viajes a cayos y paseos marinos', 'bi-tsunami');
                break;
            case '#tintoreria':
                ViewsHotel.renderServicioPOS(mainContainer, 'TINTORERIA', 'Tintorería & Lavandería', 'Lavado, planchado y tintorería', 'bi-box-seam');
                break;
            case '#zapateria':
                ViewsHotel.renderServicioPOS(mainContainer, 'ZAPATERIA', 'Zapatería & Calzado', 'Reparaciones y pulido de calzado', 'bi-tag');
                break;
            case '#manicurista':
                ViewsHotel.renderServicioPOS(mainContainer, 'MANICURISTA', 'Servicio de Manicurista', 'Cuidado y diseño de uñas de manos', 'bi-hand-index-thumb');
                break;
            case '#pedicurista':
                ViewsHotel.renderServicioPOS(mainContainer, 'PEDICURISTA', 'Servicio de Pedicurista', 'Cuidado y estética de pies', 'bi-person-walking');
                break;
            case '#tecnologia':
                ViewsHotel.renderServicioPOS(mainContainer, 'TECNOLOGIA', 'Servicios de Tecnología & WiFi', 'Impresiones, soporte y conectividad', 'bi-laptop');
                break;
            case '#alquiler-espacios':
                ViewsHotel.renderServicioPOS(mainContainer, 'ALQUILER_ESPACIOS', 'Alquiler de Espacios del Hotel', 'Salones de eventos, terrazas y caney', 'bi-building');
                break;
            case '#alquiler-equipos':
                ViewsHotel.renderServicioPOS(mainContainer, 'ALQUILER_EQUIPOS', 'Alquiler de Equipos Tecnológicos', 'Proyectores, sonido y pantallas', 'bi-speaker');
                break;

            // SuperAdmin Routes
            case '#admin-ventas':
                ViewsAdmin.renderVentas(mainContainer);
                break;
            case '#admin-pagos':
                ViewsAdmin.renderPagos(mainContainer);
                break;
            case '#admin-comercios':
                ViewsAdmin.renderComercios(mainContainer);
                break;
            case '#admin-bancos':
                ViewsAdmin.renderBancos(mainContainer);
                break;
            case '#admin-metodos':
                ViewsAdmin.renderMetodos(mainContainer);
                break;
            case '#admin-conectividad':
                ViewsAdmin.renderConectividad(mainContainer);
                break;

            default:
                if (State.isSuperAdmin()) {
                    ViewsAdmin.renderComercios(mainContainer);
                } else if (State.isStaff()) {
                    ViewsHotel.renderLimpieza(mainContainer);
                } else {
                    ViewsHotel.renderRack(mainContainer);
                }
                break;
        }
    },

    renderNavbar(navContainer, user) {
        const brandLogo = document.getElementById('navBrandLogo');
        const brandText = document.getElementById('navBrandText');
        const hotel = State.getHotel();

        // Dynamic Brand Update for Hotel Owners / Staff
        if (user && hotel && (user.role === 'HOTEL_ADMIN' || user.role === 'HOTEL_STAFF')) {
            if (brandLogo) brandLogo.src = hotel.logo_url || 'img/logo.png';
            if (brandText) brandText.textContent = hotel.name || 'Mi Hotel';
        } else if (user && user.role === 'SUPERADMIN') {
            if (brandLogo) brandLogo.src = 'img/logo.png';
            if (brandText) brandText.textContent = 'SuperAdmin SaaS';
        } else {
            if (brandLogo) brandLogo.src = 'img/logo.png';
            if (brandText) brandText.textContent = 'Hotelería Venezuela';
        }

        if (!user) {
            navContainer.innerHTML = `
                <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-center gap-1">
                    <li class="nav-item me-2">
                        <span class="bcv-ticker" id="bcvTickerBadge"><i class="bi bi-currency-dollar me-1"></i>BCV: Cargando...</span>
                    </li>
                    <li class="nav-item">
                        <button class="btn btn-sm btn-outline-primary fw-semibold" id="btnNavLogin"><i class="bi bi-box-arrow-in-right me-1"></i>Iniciar Sesión</button>
                    </li>
                    <li class="nav-item">
                        <button class="btn btn-sm btn-primary fw-semibold" id="btnNavRegister"><i class="bi bi-person-plus me-1"></i>Registrar Mi Hotel</button>
                    </li>
                </ul>
            `;
            return;
        }

        const isSuperAdmin = user.role === 'SUPERADMIN';
        const isStaff = user.role === 'HOTEL_STAFF';

        let menuHtml = `<ul class="navbar-nav me-auto mb-2 mb-lg-0 align-items-center gap-1">`;

        if (isSuperAdmin) {
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#admin-comercios"><i class="bi bi-buildings me-1"></i>Comercios</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-pagos"><i class="bi bi-shield-check me-1"></i>Pagos</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-ventas"><i class="bi bi-currency-dollar me-1"></i>Tarifas</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-bancos"><i class="bi bi-bank me-1"></i>Bancos</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-metodos"><i class="bi bi-wallet2 me-1"></i>Métodos</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-conectividad"><i class="bi bi-activity me-1"></i>Salud API</a></li>
            `;
        } else if (isStaff) {
            const perms = user.permissions || [];
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack</a></li>
            `;

            if (perms.includes('HOUSEKEEPING') || perms.length === 0) {
                menuHtml += `<li class="nav-item"><a class="nav-link text-warning fw-bold" href="#limpieza"><i class="bi bi-stars me-1"></i>Mucamas</a></li>`;
            }
            if (perms.includes('RESTAURANT')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#restaurante"><i class="bi bi-utensils me-1"></i>Restaurante</a></li>`;
            }
            if (perms.includes('BAR')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#bar"><i class="bi bi-cup-straw me-1"></i>Bar</a></li>`;
            }
            if (perms.includes('SPA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#spa"><i class="bi bi-flower1 me-1"></i>Spa</a></li>`;
            }
            if (perms.includes('PELUQUERIA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#peluqueria"><i class="bi bi-scissors me-1"></i>Peluquería</a></li>`;
            }
            if (perms.includes('GALERIA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#galeria"><i class="bi bi-palette me-1"></i>Galería</a></li>`;
            }
            if (perms.includes('GUIA_TURISTICA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#guia-turistica"><i class="bi bi-compass me-1"></i>Tours</a></li>`;
            }
            if (perms.includes('TAXIS')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#taxis"><i class="bi bi-car-front-fill me-1"></i>Taxis</a></li>`;
            }
            if (perms.includes('LANCHAS')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#lanchas"><i class="bi bi-tsunami me-1"></i>Lanchas</a></li>`;
            }
            if (perms.includes('TINTORERIA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#tintoreria"><i class="bi bi-box-seam me-1"></i>Tintorería</a></li>`;
            }
            if (perms.includes('ZAPATERIA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#zapateria"><i class="bi bi-tag me-1"></i>Zapatería</a></li>`;
            }
            if (perms.includes('MANICURISTA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#manicurista"><i class="bi bi-hand-index-thumb me-1"></i>Manicurista</a></li>`;
            }
            if (perms.includes('PEDICURISTA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#pedicurista"><i class="bi bi-person-walking me-1"></i>Pedicurista</a></li>`;
            }
            if (perms.includes('TECNOLOGIA')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#tecnologia"><i class="bi bi-laptop me-1"></i>Tecnología</a></li>`;
            }
            if (perms.includes('ALQUILER_ESPACIOS')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#alquiler-espacios"><i class="bi bi-building me-1"></i>Espacios</a></li>`;
            }
            if (perms.includes('ALQUILER_EQUIPOS')) {
                menuHtml += `<li class="nav-item"><a class="nav-link" href="#alquiler-equipos"><i class="bi bi-speaker me-1"></i>Equipos</a></li>`;
            }

            menuHtml += `<li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Consumos</a></li>`;
        } else {
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack</a></li>
                <li class="nav-item"><a class="nav-link" href="#limpieza"><i class="bi bi-stars me-1"></i>Mucamas</a></li>
                <li class="nav-item"><a class="nav-link" href="#reservas"><i class="bi bi-calendar-check me-1"></i>Reservas</a></li>
                
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle text-primary fw-semibold" href="#" data-bs-toggle="dropdown">
                        <i class="bi bi-shop me-1"></i>Servicios Extras POS
                    </a>
                    <ul class="dropdown-menu shadow border-0">
                        <li><a class="dropdown-item" href="#restaurante"><i class="bi bi-utensils me-2 text-primary"></i>Restaurante & Comedor</a></li>
                        <li><a class="dropdown-item" href="#bar"><i class="bi bi-cup-straw me-2 text-primary"></i>Bar & Coctelería</a></li>
                        <li><a class="dropdown-item" href="#spa"><i class="bi bi-flower1 me-2 text-primary"></i>Spa & Masajes</a></li>
                        <li><a class="dropdown-item" href="#peluqueria"><i class="bi bi-scissors me-2 text-primary"></i>Peluquería & Barbería</a></li>
                        <li><a class="dropdown-item" href="#galeria"><i class="bi bi-palette me-2 text-primary"></i>Galería & Arte</a></li>
                        <li><a class="dropdown-item" href="#guia-turistica"><i class="bi bi-compass me-2 text-primary"></i>Guía Turística & Tours</a></li>
                        <li><a class="dropdown-item" href="#taxis"><i class="bi bi-car-front-fill me-2 text-primary"></i>Servicio de Taxis</a></li>
                        <li><a class="dropdown-item" href="#lanchas"><i class="bi bi-tsunami me-2 text-primary"></i>Paseos en Lancha</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#tintoreria"><i class="bi bi-box-seam me-2 text-primary"></i>Tintorería & Lavandería</a></li>
                        <li><a class="dropdown-item" href="#zapateria"><i class="bi bi-tag me-2 text-primary"></i>Zapatería & Calzado</a></li>
                        <li><a class="dropdown-item" href="#manicurista"><i class="bi bi-hand-index-thumb me-2 text-primary"></i>Manicurista</a></li>
                        <li><a class="dropdown-item" href="#pedicurista"><i class="bi bi-person-walking me-2 text-primary"></i>Pedicurista</a></li>
                        <li><a class="dropdown-item" href="#tecnologia"><i class="bi bi-laptop me-2 text-primary"></i>Tecnología & WiFi</a></li>
                        <li><a class="dropdown-item" href="#alquiler-espacios"><i class="bi bi-building me-2 text-primary"></i>Alquiler de Espacios</a></li>
                        <li><a class="dropdown-item" href="#alquiler-equipos"><i class="bi bi-speaker me-2 text-primary"></i>Alquiler de Equipos</a></li>
                    </ul>
                </li>

                <li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Consumos</a></li>
                <li class="nav-item"><a class="nav-link" href="#facturacion"><i class="bi bi-file-earmark-pdf me-1"></i>Facturas</a></li>
                <li class="nav-item"><a class="nav-link" href="#areas"><i class="bi bi-building-gear me-1"></i>Áreas & Staff</a></li>
            `;
        }

        menuHtml += `</ul>`;

        menuHtml += `
            <div class="d-flex align-items-center gap-2 mt-2 mt-lg-0">
                <span class="bcv-ticker" id="bcvTickerBadge"><i class="bi bi-currency-dollar me-1"></i>BCV: Cargando...</span>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary user-dropdown-btn dropdown-toggle d-flex align-items-center gap-1" type="button" data-bs-toggle="dropdown">
                        <i class="bi bi-person-circle"></i>
                        <span class="text-truncate" style="max-width: 110px;">${user.name}</span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                        <li><span class="dropdown-item-text text-muted small">${user.email}</span></li>
                        <li><span class="dropdown-item-text text-muted small fw-bold">Rol: ${user.role}</span></li>
                        <li><hr class="dropdown-divider"></li>
                        ${!isSuperAdmin ? `
                            <li><a class="dropdown-item" href="#ajustes"><i class="bi bi-gear me-2 text-primary"></i>Perfil del Hotel</a></li>
                            <li><a class="dropdown-item" href="#pagos"><i class="bi bi-credit-card me-2 text-success"></i>Suscripción / Membresía</a></li>
                            <li><hr class="dropdown-divider"></li>
                        ` : ''}
                        <li><button class="dropdown-item text-danger" id="btnLogout"><i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesión</button></li>
                    </ul>
                </div>
            </div>
        `;

        navContainer.innerHTML = menuHtml;

        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) {
            btnLogout.onclick = () => {
                State.clearSession();
                window.location.hash = '#inicio';
                window.location.reload();
            };
        }
    }
};
