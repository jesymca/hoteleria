// SuperAdmin Views Module (Tariffs, Payment Approvals, Hotels Directory, Banks, Payment Methods, Live Health Monitor)
import { API } from './api.js';
import { UI } from './ui.js';

export const ViewsAdmin = {
    // 1. TARIFAS Y CONFIGURACIÓN SAAS
    async renderVentas(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const settings = await API.get('/admin/settings');

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="fw-bold mb-1 text-primary"><i class="bi bi-currency-dollar me-2"></i>Gestión de Tarifas y Membresía SaaS</h2>
                        <p class="text-muted mb-0">Control de la cuota mensual ($20.00 USD por defecto) y periodo de prueba gratuito</p>
                    </div>
                </div>

                <div class="row g-4">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-4">
                            <h5 class="fw-bold text-primary mb-3">Ajustes Globales de Licenciamiento</h5>
                            <form id="formSaasSettings">
                                <div class="mb-3">
                                    <label class="form-label">Cuota Mensual de Membresía ($USD)</label>
                                    <input type="number" step="0.01" class="form-control form-control-lg" id="saasFee" value="${settings.monthly_fee_usd || '20.00'}" required>
                                    <small class="text-muted">Cobro mensual aplicable a todos los comercios afiliados.</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Días de Prueba Gratuita (Al Registrarse)</label>
                                    <input type="number" class="form-control form-control-lg" id="saasTrialDays" value="${settings.trial_days || '30'}" required>
                                    <small class="text-muted">Días otorgados automáticamente a nuevas posadas al crear su cuenta.</small>
                                </div>
                                <button type="submit" class="btn btn-primary btn-lg mt-3"><i class="bi bi-check-lg me-1"></i>Actualizar Parámetros SaaS</button>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            container.querySelector('#formSaasSettings').onsubmit = async (e) => {
                e.preventDefault();
                const monthlyFeeUsd = document.getElementById('saasFee').value;
                const trialDays = document.getElementById('saasTrialDays').value;

                try {
                    await API.put('/admin/settings', { monthlyFeeUsd, trialDays });
                    UI.showToast('Configuración SaaS actualizada exitosamente.', 'success');
                } catch (err) {
                    UI.showToast(err.message, 'danger');
                }
            };
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 2. VALIDACIÓN DE PAGOS DE HOTELES CON VISOR R2
    async renderPagos(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const payments = await API.get('/admin/payments');

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="fw-bold mb-1 text-primary"><i class="bi bi-shield-check me-2"></i>Aprobación de Pagos de Membresía</h2>
                        <p class="text-muted mb-0">Verificación de transferencias, pago móvil y comprobantes en Cloudflare R2</p>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-3">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Hotel / Comercio</th>
                                        <th>N° Referencia</th>
                                        <th>Método</th>
                                        <th>Monto ($USD)</th>
                                        <th>Comprobante</th>
                                        <th>Estado</th>
                                        <th>Fecha Reporte</th>
                                        <th class="text-end">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            if (payments.length === 0) {
                html += `<tr><td colspan="8" class="text-center py-4 text-muted">No hay reportes de pago pendientes.</td></tr>`;
            } else {
                payments.forEach(p => {
                    const stBadge = p.status === 'APPROVED' ? '<span class="badge bg-success">Aprobado</span>' :
                                    p.status === 'PENDING' ? '<span class="badge bg-warning text-dark">Pendiente</span>' : '<span class="badge bg-danger">Rechazado</span>';

                    html += `
                        <tr>
                            <td>
                                <strong>${p.hotel_name}</strong>
                                <div class="small text-muted">RIF: ${p.hotel_rif}</div>
                            </td>
                            <td><strong class="text-primary">${p.reference_number}</strong></td>
                            <td>${p.method_name} (${p.method_currency})</td>
                            <td class="fw-bold">$${Number(p.amount_usd).toFixed(2)} USD</td>
                            <td>
                                ${p.proof_url ? `
                                    <button class="btn btn-sm btn-outline-info btn-view-proof" data-url="${p.proof_url}">
                                        <i class="bi bi-file-image me-1"></i>Ver Comprobante R2
                                    </button>
                                ` : 'Sin captura'}
                            </td>
                            <td>${stBadge}</td>
                            <td class="small text-muted">${new Date(p.created_at).toLocaleString('es-VE')}</td>
                            <td class="text-end">
                                ${p.status === 'PENDING' ? `
                                    <button class="btn btn-sm btn-success btn-process-pay me-1" data-id="${p.id}" data-action="APPROVED">
                                        <i class="bi bi-check-circle me-1"></i>Aprobar
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger btn-process-pay" data-id="${p.id}" data-action="REJECTED">
                                        <i class="bi bi-x-circle me-1"></i>Rechazar
                                    </button>
                                ` : ''}
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // View Proof Screenshot
            container.querySelectorAll('.btn-view-proof').forEach(btn => {
                btn.onclick = () => {
                    const url = btn.getAttribute('data-url');
                    UI.showModal({
                        title: 'Visor de Comprobante de Pago (Cloudflare R2)',
                        bodyHtml: `<div class="text-center py-2"><img src="${url}" class="img-fluid rounded border shadow" style="max-height: 500px;"></div>`,
                        footerHtml: `<a href="${url}" target="_blank" class="btn btn-primary me-2"><i class="bi bi-download me-1"></i>Abrir Original</a><button class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`
                    });
                };
            });

            // Process Approve / Reject
            container.querySelectorAll('.btn-process-pay').forEach(btn => {
                btn.onclick = async () => {
                    const paymentId = btn.getAttribute('data-id');
                    const status = btn.getAttribute('data-action');

                    try {
                        const res = await API.put('/admin/payments', { paymentId, status });
                        UI.showToast(res.message, status === 'APPROVED' ? 'success' : 'warning');
                        this.renderPagos(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 3. DIRECTORIO GLOBAL DE COMERCIOS Y LICENCIAS
    async renderComercios(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const hotels = await API.get('/admin/hotels');

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="fw-bold mb-1 text-primary"><i class="bi bi-buildings-fill me-2"></i>Directorio Global de Comercios Afiliados</h2>
                        <p class="text-muted mb-0">Monitoreo de posadas, número de habitaciones, estatus y asignación de licencias SaaS</p>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-3">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Hotel / Posada</th>
                                        <th>Administrador</th>
                                        <th>Contacto / RIF</th>
                                        <th>Tipo Licencia</th>
                                        <th>Estatus y Tiempo Disponible</th>
                                        <th class="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            if (hotels.length === 0) {
                html += `<tr><td colspan="6" class="text-center py-4 text-muted">No hay hoteles afiliados registrados.</td></tr>`;
            } else {
                const now = new Date();
                hotels.forEach(h => {
                    const licType = h.license_type === 'COURTESY' ? 'COURTESY' : 'COMMERCIAL';
                    const licBadge = licType === 'COURTESY' 
                        ? '<span class="badge bg-purple text-white"><i class="bi bi-gift-fill me-1"></i>Licencia de Cortesía</span>'
                        : '<span class="badge bg-primary"><i class="bi bi-award-fill me-1"></i>Licencia Comercial</span>';

                    const stBadge = h.status === 'ACTIVE' ? '<span class="badge bg-success">Activa</span>' :
                                    h.status === 'TRIAL' ? '<span class="badge bg-info text-dark">Prueba (Trial)</span>' :
                                    h.status === 'OVERDUE' ? '<span class="badge bg-warning text-dark">Por Vencer</span>' : '<span class="badge bg-danger">Suspendida</span>';

                    // Calculate days left
                    const dueDate = h.subscription_due_date ? new Date(h.subscription_due_date) : (h.trial_ends_at ? new Date(h.trial_ends_at) : null);
                    let daysLeft = 0;
                    let progressPercent = 0;
                    let progressColor = 'bg-success';

                    if (dueDate) {
                        const diffTime = dueDate.getTime() - now.getTime();
                        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (daysLeft < 0) daysLeft = 0;
                        progressPercent = Math.min(100, Math.max(0, Math.round((daysLeft / 30) * 100)));
                        if (daysLeft <= 5) progressColor = 'bg-danger';
                        else if (daysLeft <= 10) progressColor = 'bg-warning';
                    }

                    html += `
                        <tr>
                            <td>
                                <strong class="fs-6">${h.name}</strong>
                                <div class="small text-muted">${h.address || 'Sin dirección física'}</div>
                                <div class="mt-1"><span class="badge bg-secondary rounded-pill">${h.room_count || 0} Hab.</span></div>
                            </td>
                            <td>
                                <div>${h.owner_name}</div>
                                <div class="small text-muted">${h.owner_email}</div>
                            </td>
                            <td>
                                <div>RIF: ${h.rif}</div>
                                <div class="small text-muted">${h.phone || 'Sin telf'}</div>
                            </td>
                            <td>${licBadge}</td>
                            <td>
                                <div class="d-flex align-items-center gap-2 mb-1">
                                    ${stBadge}
                                    <span class="small fw-bold ${daysLeft <= 5 ? 'text-danger' : 'text-dark'}">${daysLeft} días restantes</span>
                                </div>
                                <div class="progress" style="height: 6px; width: 140px;">
                                    <div class="progress-bar ${progressColor}" role="progressbar" style="width: ${progressPercent}%;"></div>
                                </div>
                                ${dueDate ? `<div class="small text-muted mt-1" style="font-size: 0.75rem;">Vence: ${new Date(dueDate).toLocaleDateString('es-VE')}</div>` : ''}
                            </td>
                            <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary btn-edit-hotel" data-hotel='${JSON.stringify(h).replace(/'/g, "&apos;")}'>
                                        <i class="bi bi-pencil-square me-1"></i>Editar / Datos
                                    </button>
                                    <button class="btn btn-outline-warning btn-assign-license" data-hotel='${JSON.stringify(h).replace(/'/g, "&apos;")}'>
                                        <i class="bi bi-clock-history me-1"></i>Asignar Licencia
                                    </button>
                                    ${h.status === 'SUSPENDED' ? `
                                        <button class="btn btn-success btn-change-status" data-id="${h.id}" data-status="ACTIVE">
                                            <i class="bi bi-play-circle me-1"></i>Reactivar
                                        </button>
                                    ` : `
                                        <button class="btn btn-outline-danger btn-change-status" data-id="${h.id}" data-status="SUSPENDED">
                                            <i class="bi bi-pause-circle me-1"></i>Suspender
                                        </button>
                                    `}
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Change Quick Status (Reactivar / Suspender)
            container.querySelectorAll('.btn-change-status').forEach(btn => {
                btn.onclick = async () => {
                    const hotelId = btn.getAttribute('data-id');
                    const status = btn.getAttribute('data-status');

                    try {
                        const res = await API.put('/admin/hotels', { hotelId, status });
                        UI.showToast(res.message, 'success');
                        this.renderComercios(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            });

            // Assign / Extend Custom License Modal
            container.querySelectorAll('.btn-assign-license').forEach(btn => {
                btn.onclick = () => {
                    const h = JSON.parse(btn.getAttribute('data-hotel'));
                    const currentDueDateStr = h.subscription_due_date ? new Date(h.subscription_due_date).toISOString().split('T')[0] : '';

                    UI.showModal({
                        title: `<i class="bi bi-shield-lock-fill text-primary me-2"></i>Asignar Licencia Especial / Vigencia`,
                        bodyHtml: `
                            <form id="formAssignLicense">
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Hotel / Comercio</label>
                                    <input type="text" class="form-control" value="${h.name}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Tipo de Licencia</label>
                                    <select class="form-select" id="licTypeSelect">
                                        <option value="COMMERCIAL" ${h.license_type !== 'COURTESY' ? 'selected' : ''}>Licencia Comercial (De Pago)</option>
                                        <option value="COURTESY" ${h.license_type === 'COURTESY' ? 'selected' : ''}>Licencia de Cortesía (Gratuita/SuperAdmin)</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Estatus de la Licencia</label>
                                    <select class="form-select" id="licStatusSelect">
                                        <option value="ACTIVE" ${h.status === 'ACTIVE' ? 'selected' : ''}>Activa</option>
                                        <option value="TRIAL" ${h.status === 'TRIAL' ? 'selected' : ''}>Prueba (Trial)</option>
                                        <option value="OVERDUE" ${h.status === 'OVERDUE' ? 'selected' : ''}>Por Vencer / Vencida</option>
                                        <option value="SUSPENDED" ${h.status === 'SUSPENDED' ? 'selected' : ''}>Suspendida</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Fecha de Habilitación / Vencimiento</label>
                                    <input type="date" class="form-control" id="licDueDate" value="${currentDueDateStr}" required>
                                    <small class="text-muted">Selecciona la fecha límite exacta en la que expirará el servicio para este hotel.</small>
                                </div>
                            </form>
                        `,
                        footerHtml: `
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btnSaveLicense"><i class="bi bi-save me-1"></i>Guardar Licencia</button>
                        `
                    });

                    document.getElementById('btnSaveLicense').onclick = async () => {
                        const licenseType = document.getElementById('licTypeSelect').value;
                        const status = document.getElementById('licStatusSelect').value;
                        const dueDate = document.getElementById('licDueDate').value;

                        try {
                            const res = await API.put('/admin/hotels', {
                                hotelId: h.id,
                                licenseType,
                                status,
                                subscriptionDueDate: dueDate
                            });
                            UI.showToast(res.message, 'success');
                            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                            this.renderComercios(container);
                        } catch (e) {
                            UI.showToast(e.message, 'danger');
                        }
                    };
                };
            });

            // Edit Hotel Data Modal
            container.querySelectorAll('.btn-edit-hotel').forEach(btn => {
                btn.onclick = () => {
                    const h = JSON.parse(btn.getAttribute('data-hotel'));

                    UI.showModal({
                        title: `<i class="bi bi-pencil-square text-primary me-2"></i>Editar Datos del Comercio`,
                        bodyHtml: `
                            <form id="formEditHotel">
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Nombre del Hotel / Comercio</label>
                                    <input type="text" class="form-control" id="editHotelName" value="${h.name || ''}" required>
                                </div>
                                <div class="row g-2 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold">RIF</label>
                                        <input type="text" class="form-control" id="editHotelRif" value="${h.rif || ''}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label fw-bold">Teléfono Contacto</label>
                                        <input type="text" class="form-control" id="editHotelPhone" value="${h.phone || ''}">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Dirección Física</label>
                                    <textarea class="form-control" id="editHotelAddress" rows="2">${h.address || ''}</textarea>
                                </div>
                            </form>
                        `,
                        footerHtml: `
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btnSaveHotelData"><i class="bi bi-check-lg me-1"></i>Guardar Cambios</button>
                        `
                    });

                    document.getElementById('btnSaveHotelData').onclick = async () => {
                        const name = document.getElementById('editHotelName').value;
                        const rif = document.getElementById('editHotelRif').value;
                        const phone = document.getElementById('editHotelPhone').value;
                        const address = document.getElementById('editHotelAddress').value;

                        try {
                            const res = await API.put('/admin/hotels', {
                                hotelId: h.id,
                                name,
                                rif,
                                phone,
                                address
                            });
                            UI.showToast(res.message, 'success');
                            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                            this.renderComercios(container);
                        } catch (e) {
                            UI.showToast(e.message, 'danger');
                        }
                    };
                };
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 4. CATÁLOGO OFICIAL DE BANCOS VENEZOLANOS
    async renderBancos(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const banks = await API.get('/admin/banks');

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1 text-primary"><i class="bi bi-bank2 me-2"></i>Catálogo Oficial de Bancos Nacionales</h2>
                        <p class="text-muted mb-0">31 Bancos oficiales activos de Venezuela sembrados en Turso DB</p>
                    </div>
                    <button class="btn btn-primary" id="btnAddBank"><i class="bi bi-plus-lg me-1"></i>Agregar Banco</button>
                </div>

                <div class="card border-0 shadow-sm rounded-3">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>#</th>
                                        <th>Código Banco</th>
                                        <th>Nombre Oficial de la Institución Financiera</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            banks.forEach((b, idx) => {
                html += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong class="text-primary">${b.code}</strong></td>
                        <td class="fw-bold text-dark">${b.name}</td>
                    </tr>
                `;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            container.querySelector('#btnAddBank').onclick = () => {
                UI.showModal({
                    title: 'Agregar Banco al Catálogo Nacional',
                    bodyHtml: `
                        <form id="formBank">
                            <div class="mb-3">
                                <label class="form-label">Código de la Entidad (4 dígitos)</label>
                                <input type="text" class="form-control" id="bankCode" placeholder="Ej: 0134" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Nombre del Banco</label>
                                <input type="text" class="form-control" id="bankName" placeholder="Ej: Banco Digital Nuevo" required>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSaveBank">Guardar Banco</button>
                    `
                });

                document.getElementById('btnSaveBank').onclick = async () => {
                    const code = document.getElementById('bankCode').value;
                    const name = document.getElementById('bankName').value;

                    if (!code || !name) return;

                    try {
                        await API.post('/admin/banks', { code, name });
                        UI.showToast('Banco agregado exitosamente.', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderBancos(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 5. MÉTODOS DE PAGO SAAS
    async renderMetodos(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const methods = await API.get('/admin/payment-methods');

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1 text-primary"><i class="bi bi-wallet2 me-2"></i>Métodos de Pago SaaS Habilitados</h2>
                        <p class="text-muted mb-0">Modalidades receptoras para cuotas en Bolívares (VES) y Divisas (USD)</p>
                    </div>
                    <button class="btn btn-primary" id="btnAddMethod"><i class="bi bi-plus-lg me-1"></i>Agregar Método de Pago</button>
                </div>

                <div class="row g-4">
            `;

            methods.forEach(m => {
                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card border-0 shadow-sm h-100 p-4">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <h5 class="fw-bold mb-0">${m.name}</h5>
                                <span class="badge ${m.currency === 'USD' ? 'bg-success' : 'bg-primary'}">${m.currency}</span>
                            </div>
                            <p class="text-muted small mb-4">${m.details}</p>
                            <button class="btn btn-sm btn-outline-danger mt-auto btn-del-method" data-id="${m.id}">
                                <i class="bi bi-trash me-1"></i>Desactivar
                            </button>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            container.innerHTML = html;

            container.querySelector('#btnAddMethod').onclick = () => {
                UI.showModal({
                    title: 'Agregar Método de Pago Habilitado',
                    bodyHtml: `
                        <form id="formMethod">
                            <div class="mb-3">
                                <label class="form-label">Nombre del Método</label>
                                <input type="text" class="form-control" id="pmName" placeholder="Ej: Pago Móvil Provincial, Zinli, Binance USDT" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Moneda</label>
                                <select class="form-select" id="pmCurr">
                                    <option value="VES">VES (Bolívares al cambio BCV)</option>
                                    <option value="USD">USD (Dólares / Cripto / Zelle)</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Detalles e Instrucciones de Pago</label>
                                <textarea class="form-control" id="pmDetails" rows="3" placeholder="Ej: Banco: Provincial | RIF: J-12345678 | Telf: 0414-1234567" required></textarea>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSaveMethod">Guardar Método</button>
                    `
                });

                document.getElementById('btnSaveMethod').onclick = async () => {
                    const name = document.getElementById('pmName').value;
                    const currency = document.getElementById('pmCurr').value;
                    const details = document.getElementById('pmDetails').value;

                    if (!name || !details) return;

                    try {
                        await API.post('/admin/payment-methods', { name, currency, details });
                        UI.showToast('Método de pago registrado.', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderMetodos(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };

            container.querySelectorAll('.btn-del-method').forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.getAttribute('data-id');
                    try {
                        await API.delete(`/admin/payment-methods?id=${id}`);
                        UI.showToast('Método desactivado.', 'info');
                        this.renderMetodos(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 6. MONITOR DE CONECTIVIDAD API EN TIEMPO REAL
    async renderConectividad(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Midiendo estado de conectividad y latencia...</p></div>`;

        try {
            const health = await API.get('/admin/health');

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 class="fw-bold mb-1 text-primary"><i class="bi bi-activity me-2"></i>Monitor de Conectividad en Tiempo Real</h2>
                        <p class="text-muted mb-0">Estado de salud y tiempo de respuesta en milisegundos de la infraestructura</p>
                    </div>
                    <button class="btn btn-outline-primary" id="btnRefreshHealth"><i class="bi bi-arrow-repeat me-1"></i>Actualizar Medición</button>
                </div>

                <div class="row g-4">
                    <!-- Turso DB -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-4 text-center h-100">
                            <div class="rounded-circle bg-primary text-white p-3 d-inline-block mx-auto mb-3" style="width: fit-content;">
                                <i class="bi bi-database-fill-check fs-1"></i>
                            </div>
                            <h4 class="fw-bold mb-1">Turso DB (libSQL)</h4>
                            <p class="text-muted small mb-3">Base de datos relacional multi-tenant</p>
                            <div class="mt-auto">
                                <span class="badge bg-success fs-6 py-2 px-3 mb-2">${health.turso.status}</span>
                                <div class="fw-bold fs-5 text-dark">${health.turso.latencyMs} ms</div>
                            </div>
                        </div>
                    </div>

                    <!-- Cloudflare R2 -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-4 text-center h-100">
                            <div class="rounded-circle bg-warning text-dark p-3 d-inline-block mx-auto mb-3" style="width: fit-content;">
                                <i class="bi bi-cloud-arrow-up-fill fs-1"></i>
                            </div>
                            <h4 class="fw-bold mb-1">Cloudflare R2</h4>
                            <p class="text-muted small mb-3">Almacenamiento multimedia S3</p>
                            <div class="mt-auto">
                                <span class="badge bg-success fs-6 py-2 px-3 mb-2">${health.r2.status}</span>
                                <div class="fw-bold fs-5 text-dark">${health.r2.latencyMs} ms</div>
                            </div>
                        </div>
                    </div>

                    <!-- DolarAPI BCV -->
                    <div class="col-md-4">
                        <div class="card border-0 shadow-sm p-4 text-center h-100">
                            <div class="rounded-circle bg-success text-white p-3 d-inline-block mx-auto mb-3" style="width: fit-content;">
                                <i class="bi bi-currency-exchange fs-1"></i>
                            </div>
                            <h4 class="fw-bold mb-1">DolarAPI BCV</h4>
                            <p class="text-muted small mb-3">Tasa oficial de cambio oficial</p>
                            <div class="mt-auto">
                                <span class="badge bg-success fs-6 py-2 px-3 mb-2">${health.bcv.status}</span>
                                <div class="fw-bold fs-5 text-dark">${health.bcv.latencyMs} ms</div>
                                ${health.bcv.rate ? `<div class="small text-success font-semibold mt-1">Tasa: Bs. ${health.bcv.rate}</div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.querySelector('#btnRefreshHealth').onclick = () => this.renderConectividad(container);
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    }
};
