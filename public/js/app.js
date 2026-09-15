// App Main Entrypoint
import { State } from './state.js';
import { API } from './api.js';
import { Router } from './router.js';
import { UI } from './ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    State.initTheme();

    // 1. Fetch BCV Rate
    fetchBcvRate();
    setInterval(fetchBcvRate, 300000); // 5 min refresh

    // 2. Load Landing Ratings Carousel if on landing page
    loadLandingCarousel();

    // 3. Bind Global Modals (Login & Register)
    bindAuthEvents();

    // 4. Start Router
    Router.init();
});

async function fetchBcvRate() {
    try {
        const data = await API.get('/billing/bcv');
        State.setBcvRate(data);

        const badge = document.getElementById('bcvTickerBadge');
        if (badge) {
            badge.innerHTML = `<i class="bi bi-currency-dollar me-1"></i>BCV: Bs. ${Number(data.promedio).toFixed(2)}`;
        }
    } catch (e) {
        console.warn('Could not update BCV ticker:', e);
    }
}

async function loadLandingCarousel() {
    const container = document.getElementById('landingHotelCarouselContainer');
    if (!container) return;

    try {
        const hotels = await API.get('/ratings');
        if (hotels.length === 0) {
            container.innerHTML = `<div class="col-12 text-center text-muted py-4">Sé el primer hotel en unirte a nuestra red en Venezuela.</div>`;
            return;
        }

        let html = '';
        hotels.forEach(h => {
            const stars = '★'.repeat(Math.round(h.avg_rating)) + '☆'.repeat(5 - Math.round(h.avg_rating));
            html += `
                <div class="col-12 col-md-6 col-lg-4">
                    <div class="card carousel-hotel-card h-100 p-4">
                        <div class="d-flex align-items-center mb-3">
                            <img src="${h.logo_url || 'img/logo.png'}" class="rounded-circle border p-1 me-3" style="width: 55px; height: 55px; object-fit: contain;">
                            <div>
                                <h5 class="fw-bold mb-0">${h.name}</h5>
                                <small class="text-muted"><i class="bi bi-geo-alt me-1"></i>${h.address || 'Venezuela'}</small>
                            </div>
                        </div>
                        <div class="text-warning fs-5 mb-2">${stars} <span class="text-dark fs-6 font-semibold">(${Number(h.avg_rating).toFixed(1)})</span></div>
                        <button class="btn btn-sm btn-outline-primary mt-auto btn-rate-hotel" data-id="${h.id}" data-name="${h.name}">
                            <i class="bi bi-star-fill me-1"></i>Valorar este Hotel
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Rate Hotel Modal
        container.querySelectorAll('.btn-rate-hotel').forEach(btn => {
            btn.onclick = () => {
                const hotelId = btn.getAttribute('data-id');
                const hotelName = btn.getAttribute('data-name');

                UI.showModal({
                    title: `Valorar Hospedaje: ${hotelName}`,
                    bodyHtml: `
                        <form id="formRateHotel">
                            <div class="mb-3 text-center">
                                <label class="form-label d-block fw-bold mb-2">Seleccione su grado de satisfacción (1 a 5 estrellas)</label>
                                <div class="star-rating justify-content-center">
                                    <input type="radio" id="star5" name="rating" value="5"><label for="star5" title="5 estrellas">★</label>
                                    <input type="radio" id="star4" name="rating" value="4"><label for="star4" title="4 estrellas">★</label>
                                    <input type="radio" id="star3" name="rating" value="3" checked><label for="star3" title="3 estrellas">★</label>
                                    <input type="radio" id="star2" name="rating" value="2"><label for="star2" title="2 estrellas">★</label>
                                    <input type="radio" id="star1" name="rating" value="1"><label for="star1" title="1 estrella">★</label>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Su Nombre (Opcional)</label>
                                <input type="text" class="form-control" id="rtName" placeholder="Ej: Familia Rodríguez">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Comentario de la Experiencia</label>
                                <textarea class="form-control" id="rtComment" rows="3" placeholder="Excelente atención y comodidades..."></textarea>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSubmitRating">Enviar Valoración</button>
                    `
                });

                document.getElementById('btnSubmitRating').onclick = async () => {
                    const ratingRadio = document.querySelector('input[name="rating"]:checked');
                    const rating = ratingRadio ? ratingRadio.value : 5;
                    const reviewerName = document.getElementById('rtName').value;
                    const comment = document.getElementById('rtComment').value;

                    try {
                        await API.post('/ratings', { hotelId, rating, reviewerName, comment });
                        UI.showToast('¡Gracias por enviar su valoración! ⭐', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        loadLandingCarousel();
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };
        });
    } catch (e) {
        console.warn('Could not load landing carousel:', e);
    }
}

function bindAuthEvents() {
    // Nav Click Handlers
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnNavLogin') || e.target.closest('#btnHeroLogin')) {
            showLoginModal();
        }
        if (e.target.closest('#btnNavRegister') || e.target.closest('#btnHeroRegister')) {
            showRegisterModal();
        }
    });
}

function showLoginModal() {
    UI.showModal({
        title: 'Iniciar Sesión en el Sistema',
        bodyHtml: `
            <form id="formLogin">
                <div class="mb-3">
                    <label class="form-label">Correo Electrónico o Nombre de Usuario</label>
                    <input type="text" class="form-control form-control-lg" id="loginUsername" placeholder="ejemplo@hotel.com o hotel_prueba" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Contraseña</label>
                    <input type="password" class="form-control form-control-lg" id="loginPassword" required>
                </div>
               
                <hr>
                <button type="button" class="btn btn-outline-dark w-100 py-2 d-flex align-items-center justify-content-center gap-2" id="btnGoogleAuthSim">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Continuar con Google Workspace
                </button>
            </form>
        `,
        footerHtml: `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary px-4" id="btnDoLogin">Ingresar</button>
        `
    });

    document.getElementById('btnDoLogin').onclick = async () => {
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            UI.showToast('Por favor ingrese usuario y contraseña.', 'warning');
            return;
        }

        try {
            const data = await API.post('/auth/login', { username, password });
            State.setSession(data.token, data.user, data.hotel);
            UI.showToast(`¡Bienvenido/a ${data.user.name}!`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();

            if (data.user.role === 'SUPERADMIN') {
                window.location.hash = '#admin-comercios';
            } else if (data.user.role === 'HOTEL_STAFF') {
                window.location.hash = '#limpieza';
            } else {
                window.location.hash = '#habitaciones';
            }
            window.location.reload();
        } catch (e) {
            UI.showToast(e.message, 'danger');
        }
    };

    const btnGoogleAuth = document.getElementById('btnGoogleAuthSim');
    if (btnGoogleAuth) {
        btnGoogleAuth.onclick = () => {
            // Direct Google Workspace Login Modal
            UI.showModal({
                title: 'Inicio de Sesión con Google Workspace',
                bodyHtml: `
                    <div class="text-center py-3">
                        <svg width="56" height="56" viewBox="0 0 24 24" class="mb-3"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                        <h5 class="fw-bold text-dark mb-1">Acceso con Cuenta Google</h5>
                        <p class="text-muted small mb-3">Ingrese su correo de Google / Workspace para verificar su cuenta o registrar su hotel automáticamente.</p>
                        <form id="formGoogleDirect">
                            <div class="mb-3 text-start">
                                <label class="form-label fw-semibold">Correo de Google (@gmail.com o Dominio Workspace)</label>
                                <input type="email" class="form-control form-control-lg" id="googleEmailInput" placeholder="ejemplo@gmail.com" value="herrejose@gmail.com" required>
                            </div>
                        </form>
                    </div>
                `,
                footerHtml: `
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-danger px-4 fw-bold" id="btnSubmitGoogleDirect">
                        <i class="bi bi-google me-1"></i>Continuar con Google
                    </button>
                `
            });

            const btnSubDirect = document.getElementById('btnSubmitGoogleDirect');
            if (btnSubDirect) {
                btnSubDirect.onclick = async () => {
                    const email = document.getElementById('googleEmailInput').value;
                    if (!email) {
                        UI.showToast('Por favor ingrese su correo de Google.', 'warning');
                        return;
                    }

                    try {
                        btnSubDirect.disabled = true;
                        btnSubDirect.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Verificando...';

                        const data = await API.post('/auth/google', { email });
                        State.setSession(data.token, data.user, data.hotel);
                        UI.showToast(`¡Bienvenido/a ${data.user.name}!`, 'success');

                        const modalEl = document.getElementById('dynamicModal');
                        if (modalEl) {
                            const modalInst = bootstrap.Modal.getInstance(modalEl);
                            if (modalInst) modalInst.hide();
                        }

                        if (data.user.role === 'SUPERADMIN') {
                            window.location.hash = '#admin-comercios';
                        } else if (data.user.role === 'HOTEL_STAFF') {
                            window.location.hash = '#limpieza';
                        } else {
                            window.location.hash = '#habitaciones';
                        }
                        window.location.reload();
                    } catch (err) {
                        UI.showToast(err.message, 'danger');
                        btnSubDirect.disabled = false;
                        btnSubDirect.innerHTML = '<i class="bi bi-google me-1"></i>Continuar con Google';
                    }
                };
            }
        };
    }
}

function showRegisterModal() {
    UI.showModal({
        title: 'Registrar Nuevo Hotel o Posada',
        bodyHtml: `
            <form id="formRegister">
                <h6 class="fw-bold text-primary mb-3">Datos del Administrador</h6>
                <div class="mb-3">
                    <label class="form-label">Nombre Completo</label>
                    <input type="text" class="form-control" id="regName" required placeholder="Ej: Pedro Pérez">
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label">Correo Electrónico</label>
                        <input type="email" class="form-control" id="regEmail" required placeholder="admin@mi-posada.com">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Contraseña</label>
                        <input type="password" class="form-control" id="regPassword" required>
                    </div>
                </div>

                <h6 class="fw-bold text-primary mb-3">Datos del Establecimiento</h6>
                <div class="mb-3">
                    <label class="form-label">Nombre del Hotel / Posada</label>
                    <input type="text" class="form-control" id="regHotelName" required placeholder="Ej: Posada Sol y Mar">
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label">RIF Fiscal</label>
                        <input type="text" class="form-control" id="regRif" required placeholder="J-12345678-9">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Teléfono / WhatsApp</label>
                        <input type="text" class="form-control" id="regPhone" placeholder="0414-1234567">
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Dirección Física</label>
                    <input type="text" class="form-control" id="regAddress" placeholder="Pueblo de Choroní, Estado Aragua">
                </div>
                <div class="alert alert-success border small">
                    <i class="bi bi-gift-fill me-1"></i>¡Obtenga 30 Días de Prueba Gratuita sin compromiso de pago inicial!
                </div>
            </form>
        `,
        footerHtml: `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary px-4" id="btnDoRegister">Crear Cuenta Gratis</button>
        `
    });

    document.getElementById('btnDoRegister').onclick = async () => {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const hotelName = document.getElementById('regHotelName').value;
        const rif = document.getElementById('regRif').value;
        const phone = document.getElementById('regPhone').value;
        const hotelAddress = document.getElementById('regAddress').value;

        if (!name || !email || !password || !hotelName || !rif) {
            UI.showToast('Por favor llene los campos obligatorios.', 'warning');
            return;
        }

        try {
            const data = await API.post('/auth/register', {
                name, email, password, hotelName, rif, phone, hotelAddress
            });
            State.setSession(data.token, data.user, data.hotel);
            UI.showToast('¡Registro completado! Su periodo de 30 días de prueba está activo.', 'success');
            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
            window.location.hash = '#habitaciones';
            window.location.reload();
        } catch (e) {
            UI.showToast(e.message, 'danger');
        }
    };
}
