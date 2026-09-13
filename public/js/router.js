// Hash Routing Controller
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
            navbarNav.innerHTML = '';
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
        if (!user) {
            navContainer.innerHTML = `
                <ul class="navbar-nav ms-auto mb-2 mb-lg-0 align-items-center">
                    <li class="nav-item me-2">
                        <span class="bcv-ticker" id="bcvTickerBadge"><i class="bi bi-currency-dollar me-1"></i>BCV: Cargando...</span>
                    </li>
                    <li class="nav-item">
                        <button class="btn btn-outline-primary me-2 fw-semibold" id="btnNavLogin"><i class="bi bi-box-arrow-in-right me-1"></i>Iniciar Sesión</button>
                    </li>
                    <li class="nav-item">
                        <button class="btn btn-primary fw-semibold" id="btnNavRegister"><i class="bi bi-person-plus me-1"></i>Registrar Mi Hotel</button>
                    </li>
                </ul>
            `;
            return;
        }

        const isSuperAdmin = user.role === 'SUPERADMIN';
        const isStaff = user.role === 'HOTEL_STAFF';

        let menuHtml = `<ul class="navbar-nav me-auto mb-2 mb-lg-0 fw-medium">`;

        if (isSuperAdmin) {
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#admin-comercios"><i class="bi bi-buildings me-1"></i>Hoteles Afiliados</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-pagos"><i class="bi bi-shield-check me-1"></i>Verificar Pagos</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-ventas"><i class="bi bi-currency-dollar me-1"></i>Tarifas SaaS</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-bancos"><i class="bi bi-bank me-1"></i>Bancos (31)</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-metodos"><i class="bi bi-wallet2 me-1"></i>Métodos Pago</a></li>
                <li class="nav-item"><a class="nav-link" href="#admin-conectividad"><i class="bi bi-activity me-1"></i>Salud Infraestructura</a></li>
            `;
        } else if (isStaff) {
            menuHtml += `
                <li class="nav-item"><a class="nav-link text-warning fw-bold" href="#limpieza"><i class="bi bi-stars me-1"></i>Panel Mucamas / Limpieza</a></li>
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack Habitaciones</a></li>
                <li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Cargar Consumos</a></li>
            `;
        } else {
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack Habitaciones</a></li>
                <li class="nav-item"><a class="nav-link" href="#limpieza"><i class="bi bi-stars me-1"></i>Mucamas / Limpieza</a></li>
                <li class="nav-item"><a class="nav-link" href="#reservas"><i class="bi bi-calendar-check me-1"></i>Reservas & Huéspedes</a></li>
                <li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Consumos Extras</a></li>
                <li class="nav-item"><a class="nav-link" href="#facturacion"><i class="bi bi-file-earmark-pdf me-1"></i>Facturación PDF</a></li>
                <li class="nav-item"><a class="nav-link" href="#areas"><i class="bi bi-building-gear me-1"></i>Áreas / Personal</a></li>
                <li class="nav-item"><a class="nav-link" href="#ajustes"><i class="bi bi-gear me-1"></i>Perfil Hotel</a></li>
                <li class="nav-item"><a class="nav-link text-success fw-bold" href="#pagos"><i class="bi bi-credit-card me-1"></i>Membresía</a></li>
            `;
        }

        menuHtml += `</ul>`;

        menuHtml += `
            <div class="d-flex align-items-center gap-3">
                <span class="bcv-ticker" id="bcvTickerBadge"><i class="bi bi-currency-dollar me-1"></i>BCV: Cargando...</span>
                <div class="dropdown">
                    <button class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown">
                        <i class="bi bi-person-circle fs-5"></i>
                        <span>${user.name}</span>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end shadow">
                        <li><span class="dropdown-item-text text-muted small">${user.email} (${user.role})</span></li>
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
