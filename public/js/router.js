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
            case '#gimnasio':
                ViewsHotel.renderServicioPOS(mainContainer, 'GIMNASIO', 'Gimnasio & Fitness Center', 'Equipos, entrenadores y clases guiadas', 'bi-heart-pulse');
                break;
            case '#padel':
                ViewsHotel.renderServicioPOS(mainContainer, 'PADEL', 'Canchas de Pádel', 'Reservas de canchas, raquetas y pelotas', 'bi-circle');
                break;
            case '#guarderia':
                ViewsHotel.renderServicioPOS(mainContainer, 'GUARDERIA', 'Guardería & Kids Club', 'Cuidado infantil, recreadores y talleres', 'bi-emoji-smile');
                break;
            case '#cine':
                ViewsHotel.renderServicioPOS(mainContainer, 'CINE', 'Cine & Sala de Proyecciones', 'Películas, cotufas y funciones privadas', 'bi-film');
                break;
            case '#piscina':
                ViewsHotel.renderServicioPOS(mainContainer, 'PISCINA', 'Piscina & Daypass', 'Pasadías, camas balinesas e inflables', 'bi-water');
                break;
            case '#playa':
                ViewsHotel.renderServicioPOS(mainContainer, 'PLAYA', 'Playa & Club de Playa', 'Toldos, sillas reclinables y servicio playero', 'bi-sun');
                break;
            case '#golf':
                ViewsHotel.renderServicioPOS(mainContainer, 'GOLF', 'Campo de Golf & Minigolf', 'Green fee, carritos y palos de golf', 'bi-flag');
                break;
            case '#lenceria':
                ViewsHotel.renderServicioPOS(mainContainer, 'LENCERIA', 'Lencería & Toallas Adicionales', 'Toallas playeras, almohadones y mantas', 'bi-shield-square');
                break;
            case '#tenis':
                ViewsHotel.renderServicioPOS(mainContainer, 'TENIS', 'Canchas de Tenis', 'Alquiler de canchas, raquetas y clases', 'bi-dribbble');
                break;
            case '#surf':
                ViewsHotel.renderServicioPOS(mainContainer, 'SURF', 'Surf & Deportes Acuáticos', 'Tablas de surf, paddleboard y clases', 'bi-tsunami');
                break;
            case '#caballos':
                ViewsHotel.renderServicioPOS(mainContainer, 'CABALLOS', 'Paseos a Caballo', 'Rutas guiadas por playa y montaña', 'bi-postage');
                break;
            case '#cuatrimotos':
                ViewsHotel.renderServicioPOS(mainContainer, 'CUATRIMOTOS', 'Cuatrimotos & ATVs 4x4', 'Tours rústicos y buggies playeros', 'bi-truck');
                break;
            case '#heladeria':
                ViewsHotel.renderServicioPOS(mainContainer, 'HELADERIA', 'Heladería & Postres Artesanales', 'Helados, merengadas y dulces criollos', 'bi-cup-hot');
                break;
            case '#bodegon':
                ViewsHotel.renderServicioPOS(mainContainer, 'BODEGON', 'Bodegón & Licorería VIP', 'Licores finos, vinos y snacks gourmet', 'bi-shop-window');
                break;
            case '#tienda':
                ViewsHotel.renderServicioPOS(mainContainer, 'TIENDA', 'Tienda de Conveniencia & Souvenirs', 'Artículos playeros, ropa y artesanías', 'bi-bag-check');
                break;
            case '#buceo':
                ViewsHotel.renderServicioPOS(mainContainer, 'BUCEO', 'Snorkeling & Buceo PADI', 'Inmersiones marinos, visor y tanques', 'bi-eye');
                break;
            case '#parapente':
                ViewsHotel.renderServicioPOS(mainContainer, 'PARAPENTE', 'Parapente & Aventura Extrema', 'Vuelos tándem y tirolesa extrema', 'bi-wind');
                break;
            case '#pesca':
                ViewsHotel.renderServicioPOS(mainContainer, 'PESCA', 'Pesca Deportiva & Marina', 'Chárter de pesca en alta mar y cañas', 'bi-anchor');
                break;
            case '#vehiculos':
                ViewsHotel.renderServicioPOS(mainContainer, 'VEHICULOS', 'Alquiler de Vehículos 4x4', 'Vehículos rústicos y carritos de golf', 'bi-ev-front');
                break;
            case '#eventos':
                ViewsHotel.renderServicioPOS(mainContainer, 'EVENTOS', 'Salón de Eventos & Bodas', 'Montajes, banquetes y festejos', 'bi-balloon');
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
            const staffPosModules = [
                { id: 'HOUSEKEEPING', hash: '#limpieza', label: 'Mucamas', icon: 'bi-stars', class: 'text-warning fw-bold' },
                { id: 'RESTAURANT', hash: '#restaurante', label: 'Restaurante', icon: 'bi-utensils' },
                { id: 'BAR', hash: '#bar', label: 'Bar', icon: 'bi-cup-straw' },
                { id: 'SPA', hash: '#spa', label: 'Spa', icon: 'bi-flower1' },
                { id: 'PELUQUERIA', hash: '#peluqueria', label: 'Peluquería', icon: 'bi-scissors' },
                { id: 'GALERIA', hash: '#galeria', label: 'Galería', icon: 'bi-palette' },
                { id: 'GUIA_TURISTICA', hash: '#guia-turistica', label: 'Tours', icon: 'bi-compass' },
                { id: 'TAXIS', hash: '#taxis', label: 'Taxis', icon: 'bi-car-front-fill' },
                { id: 'LANCHAS', hash: '#lanchas', label: 'Lanchas', icon: 'bi-tsunami' },
                { id: 'TINTORERIA', hash: '#tintoreria', label: 'Tintorería', icon: 'bi-box-seam' },
                { id: 'ZAPATERIA', hash: '#zapateria', label: 'Zapatería', icon: 'bi-tag' },
                { id: 'MANICURISTA', hash: '#manicurista', label: 'Manicurista', icon: 'bi-hand-index-thumb' },
                { id: 'PEDICURISTA', hash: '#pedicurista', label: 'Pedicurista', icon: 'bi-person-walking' },
                { id: 'TECNOLOGIA', hash: '#tecnologia', label: 'Tecnología', icon: 'bi-laptop' },
                { id: 'ALQUILER_ESPACIOS', hash: '#alquiler-espacios', label: 'Espacios', icon: 'bi-building' },
                { id: 'ALQUILER_EQUIPOS', hash: '#alquiler-equipos', label: 'Equipos', icon: 'bi-speaker' },
                { id: 'GIMNASIO', hash: '#gimnasio', label: 'Gimnasio', icon: 'bi-heart-pulse' },
                { id: 'PADEL', hash: '#padel', label: 'Pádel', icon: 'bi-circle' },
                { id: 'GUARDERIA', hash: '#guarderia', label: 'Guardería', icon: 'bi-emoji-smile' },
                { id: 'CINE', hash: '#cine', label: 'Cine', icon: 'bi-film' },
                { id: 'PISCINA', hash: '#piscina', label: 'Piscina', icon: 'bi-water' },
                { id: 'PLAYA', hash: '#playa', label: 'Playa', icon: 'bi-sun' },
                { id: 'GOLF', hash: '#golf', label: 'Golf', icon: 'bi-flag' },
                { id: 'LENCERIA', hash: '#lenceria', label: 'Lencería', icon: 'bi-shield-square' },
                { id: 'TENIS', hash: '#tenis', label: 'Tenis', icon: 'bi-dribbble' },
                { id: 'SURF', hash: '#surf', label: 'Surf', icon: 'bi-tsunami' },
                { id: 'CABALLOS', hash: '#caballos', label: 'Caballos', icon: 'bi-postage' },
                { id: 'CUATRIMOTOS', hash: '#cuatrimotos', label: 'Cuatrimotos', icon: 'bi-truck' },
                { id: 'HELADERIA', hash: '#heladeria', label: 'Heladería', icon: 'bi-cup-hot' },
                { id: 'BODEGON', hash: '#bodegon', label: 'Bodegón', icon: 'bi-shop-window' },
                { id: 'TIENDA', hash: '#tienda', label: 'Tienda', icon: 'bi-bag-check' },
                { id: 'BUCEO', hash: '#buceo', label: 'Buceo', icon: 'bi-eye' },
                { id: 'PARAPENTE', hash: '#parapente', label: 'Parapente', icon: 'bi-wind' },
                { id: 'PESCA', hash: '#pesca', label: 'Pesca', icon: 'bi-anchor' },
                { id: 'VEHICULOS', hash: '#vehiculos', label: 'Rústicos 4x4', icon: 'bi-ev-front' },
                { id: 'EVENTOS', hash: '#eventos', label: 'Eventos', icon: 'bi-balloon' }
            ];

            staffPosModules.forEach(mod => {
                if (perms.includes(mod.id) || (mod.id === 'HOUSEKEEPING' && perms.length === 0)) {
                    menuHtml += `<li class="nav-item"><a class="nav-link ${mod.class || ''}" href="${mod.hash}"><i class="bi ${mod.icon} me-1"></i>${mod.label}</a></li>`;
                }
            });

            menuHtml += `<li class="nav-item"><a class="nav-link" href="#consumos"><i class="bi bi-receipt me-1"></i>Consumos</a></li>`;
        } else {
            menuHtml += `
                <li class="nav-item"><a class="nav-link" href="#habitaciones"><i class="bi bi-grid-3x3-gap me-1"></i>Rack</a></li>
                <li class="nav-item"><a class="nav-link" href="#limpieza"><i class="bi bi-stars me-1"></i>Mucamas</a></li>
                <li class="nav-item"><a class="nav-link" href="#reservas"><i class="bi bi-calendar-check me-1"></i>Reservas</a></li>
                
                <li class="nav-item dropdown">
                    <a class="nav-link dropdown-toggle text-primary fw-semibold" href="#" data-bs-toggle="dropdown">
                        <i class="bi bi-shop me-1"></i>Servicios Extras POS (35)
                    </a>
                    <ul class="dropdown-menu shadow-lg border-0 rounded-3 custom-scroll" style="max-height: 440px; min-width: 320px; overflow-y: auto;">
                        <li><h6 class="dropdown-header text-uppercase text-primary fw-bold"><i class="bi bi-cup-straw me-1"></i>Gastronomía & Entretenimiento</h6></li>
                        <li><a class="dropdown-item py-2" href="#restaurante"><i class="bi bi-utensils me-2 text-primary"></i>Restaurante & Comedor</a></li>
                        <li><a class="dropdown-item py-2" href="#bar"><i class="bi bi-cup-straw me-2 text-primary"></i>Bar & Coctelería</a></li>
                        <li><a class="dropdown-item py-2" href="#heladeria"><i class="bi bi-cup-hot me-2 text-primary"></i>Heladería & Postres</a></li>
                        <li><a class="dropdown-item py-2" href="#bodegon"><i class="bi bi-shop-window me-2 text-primary"></i>Bodegón & Licorería VIP</a></li>
                        <li><a class="dropdown-item py-2" href="#cine"><i class="bi bi-film me-2 text-primary"></i>Cine & Sala Proyecciones</a></li>

                        <li><hr class="dropdown-divider"></li>
                        <li><h6 class="dropdown-header text-uppercase text-primary fw-bold"><i class="bi bi-sun me-1"></i>Deportes, Playa & Aventura</h6></li>
                        <li><a class="dropdown-item py-2" href="#piscina"><i class="bi bi-water me-2 text-primary"></i>Piscina & Daypass</a></li>
                        <li><a class="dropdown-item py-2" href="#playa"><i class="bi bi-sun me-2 text-primary"></i>Playa & Club de Playa</a></li>
                        <li><a class="dropdown-item py-2" href="#surf"><i class="bi bi-tsunami me-2 text-primary"></i>Surf & Deportes Acuáticos</a></li>
                        <li><a class="dropdown-item py-2" href="#padel"><i class="bi bi-circle me-2 text-primary"></i>Canchas de Pádel</a></li>
                        <li><a class="dropdown-item py-2" href="#tenis"><i class="bi bi-dribbble me-2 text-primary"></i>Canchas de Tenis</a></li>
                        <li><a class="dropdown-item py-2" href="#golf"><i class="bi bi-flag me-2 text-primary"></i>Campo de Golf & Minigolf</a></li>
                        <li><a class="dropdown-item py-2" href="#gimnasio"><i class="bi bi-heart-pulse me-2 text-primary"></i>Gimnasio & Fitness</a></li>
                        <li><a class="dropdown-item py-2" href="#caballos"><i class="bi bi-postage me-2 text-primary"></i>Paseos a Caballo</a></li>
                        <li><a class="dropdown-item py-2" href="#cuatrimotos"><i class="bi bi-truck me-2 text-primary"></i>Cuatrimotos & ATVs 4x4</a></li>
                        <li><a class="dropdown-item py-2" href="#buceo"><i class="bi bi-eye me-2 text-primary"></i>Snorkeling & Buceo PADI</a></li>
                        <li><a class="dropdown-item py-2" href="#parapente"><i class="bi bi-wind me-2 text-primary"></i>Parapente & Aventura</a></li>
                        <li><a class="dropdown-item py-2" href="#pesca"><i class="bi bi-anchor me-2 text-primary"></i>Pesca Deportiva & Marina</a></li>

                        <li><hr class="dropdown-divider"></li>
                        <li><h6 class="dropdown-header text-uppercase text-primary fw-bold"><i class="bi bi-flower1 me-1"></i>Bienestar & Cuidado Infantil</h6></li>
                        <li><a class="dropdown-item py-2" href="#spa"><i class="bi bi-flower1 me-2 text-primary"></i>Spa & Masajes</a></li>
                        <li><a class="dropdown-item py-2" href="#peluqueria"><i class="bi bi-scissors me-2 text-primary"></i>Peluquería & Barbería</a></li>
                        <li><a class="dropdown-item py-2" href="#manicurista"><i class="bi bi-hand-index-thumb me-2 text-primary"></i>Manicurista</a></li>
                        <li><a class="dropdown-item py-2" href="#pedicurista"><i class="bi bi-person-walking me-2 text-primary"></i>Pedicurista</a></li>
                        <li><a class="dropdown-item py-2" href="#guarderia"><i class="bi bi-emoji-smile me-2 text-primary"></i>Guardería & Kids Club</a></li>

                        <li><hr class="dropdown-divider"></li>
                        <li><h6 class="dropdown-header text-uppercase text-primary fw-bold"><i class="bi bi-car-front-fill me-1"></i>Tours, Tienda & Movilidad</h6></li>
                        <li><a class="dropdown-item py-2" href="#guia-turistica"><i class="bi bi-compass me-2 text-primary"></i>Guía Turística & Tours</a></li>
                        <li><a class="dropdown-item py-2" href="#taxis"><i class="bi bi-car-front-fill me-2 text-primary"></i>Servicio de Taxis</a></li>
                        <li><a class="dropdown-item py-2" href="#lanchas"><i class="bi bi-tsunami me-2 text-primary"></i>Paseos en Lancha</a></li>
                        <li><a class="dropdown-item py-2" href="#vehiculos"><i class="bi bi-ev-front me-2 text-primary"></i>Alquiler Vehículos 4x4</a></li>
                        <li><a class="dropdown-item py-2" href="#tienda"><i class="bi bi-bag-check me-2 text-primary"></i>Tienda & Souvenirs</a></li>
                        <li><a class="dropdown-item py-2" href="#galeria"><i class="bi bi-palette me-2 text-primary"></i>Galería & Arte</a></li>

                        <li><hr class="dropdown-divider"></li>
                        <li><h6 class="dropdown-header text-uppercase text-primary fw-bold"><i class="bi bi-building me-1"></i>Servicios Generales & Eventos</h6></li>
                        <li><a class="dropdown-item py-2" href="#tintoreria"><i class="bi bi-box-seam me-2 text-primary"></i>Tintorería & Lavandería</a></li>
                        <li><a class="dropdown-item py-2" href="#zapateria"><i class="bi bi-tag me-2 text-primary"></i>Zapatería & Calzado</a></li>
                        <li><a class="dropdown-item py-2" href="#lenceria"><i class="bi bi-shield-square me-2 text-primary"></i>Lencería & Toallas Extra</a></li>
                        <li><a class="dropdown-item py-2" href="#tecnologia"><i class="bi bi-laptop me-2 text-primary"></i>Tecnología & WiFi</a></li>
                        <li><a class="dropdown-item py-2" href="#alquiler-espacios"><i class="bi bi-building me-2 text-primary"></i>Alquiler de Espacios</a></li>
                        <li><a class="dropdown-item py-2" href="#alquiler-equipos"><i class="bi bi-speaker me-2 text-primary"></i>Alquiler de Equipos</a></li>
                        <li><a class="dropdown-item py-2" href="#eventos"><i class="bi bi-balloon me-2 text-primary"></i>Salón de Eventos & Bodas</a></li>
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
