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
                ViewsHotel.renderReservas(mainContainer);
                break;
            case '#huespedes':
                ViewsHotel.renderReservas(mainContainer); // Integrated guest/booking view
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
            menuHtml += `
                <li class="nav-item"><a class="nav-link text-warning fw-bold" href="#limpieza"><i class="bi bi-stars me-1"></i>Limpieza / Mucamas</a></li>
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack</a></li>
                <li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Consumos</a></li>
            `;
        } else {
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack</a></li>
                <li class="nav-item"><a class="nav-link" href="#limpieza"><i class="bi bi-stars me-1"></i>Mucamas</a></li>
                <li class="nav-item"><a class="nav-link" href="#reservas"><i class="bi bi-calendar-check me-1"></i>Reservas</a></li>
                <li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Consumos</a></li>
                <li class="nav-item"><a class="nav-link" href="#facturacion"><i class="bi bi-file-earmark-pdf me-1"></i>Facturas</a></li>
                <li class="nav-item"><a class="nav-link" href="#areas"><i class="bi bi-building-gear me-1"></i>Áreas</a></li>
                <li class="nav-item"><a class="nav-link" href="#ajustes"><i class="bi bi-gear me-1"></i>Perfil</a></li>
                <li class="nav-item"><a class="nav-link text-success fw-bold" href="#pagos"><i class="bi bi-credit-card me-1"></i>Suscripción</a></li>
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
