// Hotel Views Module (Rack, Housekeeping/Mucamas, Bookings, Guests, Consumos, Billing, Departments, Settings, Payments)
import { API } from './api.js';
import { State } from './state.js';
import { UI } from './ui.js';
import { Uploader } from './uploader.js';
import { PDFService } from './pdf-service.js';
// Helper CSV Utility for POS catalog imports
const CSVUtil = {
    downloadTemplate(filename, content) {
        const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    parse(text) {
        const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) return [];

        const parseLine = (line) => {
            const result = [];
            let cur = '';
            let inQuotes = false;
            const separator = line.includes(';') ? ';' : ',';

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === separator && !inQuotes) {
                    result.push(cur.trim().replace(/^"|"$/g, ''));
                    cur = '';
                } else {
                    cur += char;
                }
            }
            result.push(cur.trim().replace(/^"|"$/g, ''));
            return result;
        };

        const rawHeaders = parseLine(lines[0]);
        const headers = rawHeaders.map(h => 
            h.toLowerCase()
             .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
             .replace(/[^a-z0-9_]/g, "")
        );

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseLine(lines[i]);
            if (values.length === 0 || values.every(v => !v)) continue;
            
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
            });

            const dept = row.departamento || row.departamentotype || row.dept || row.seccion || row.tipo || '';
            const name = row.nombre || row.name || row.producto || row.servicio || row.item || '';
            const desc = row.descripcion || row.description || row.detalles || row.detalle || '';
            const price = row.precio_usd || row.preciousd || row.precio || row.price || row.costo || '';

            rows.push({
                departmentType: dept.trim().toUpperCase(),
                name: name.trim(),
                description: desc.trim(),
                priceUsd: parseFloat(price) || 0,
                rawPrice: price,
                isValid: name.trim().length > 0 && !isNaN(parseFloat(price)) && parseFloat(price) >= 0
            });
        }
        return rows;
    }
};

export const ViewsHotel = {
    // 1. RACK DE HABITACIONES INTERACTIVO
    async renderRack(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Cargando Rack de Habitaciones...</p></div>`;

        try {
            const data = await API.get('/rooms');
            const rooms = data.rooms || [];
            const types = data.roomTypes || [];

            const user = State.getUser();
            const isStaff = State.isStaff();

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-grid-3x3-gap-fill text-primary me-2"></i>Rack Visual de Habitaciones</h2>
                        <p class="text-muted mb-0">Estado en tiempo real de la capacidad y gestión de huéspedes</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-success fw-bold shadow-sm" id="btnRackCheckIn"><i class="bi bi-box-arrow-in-right me-1"></i>Nuevo Check-in</button>
                        <button class="btn btn-outline-info" id="btnPaymentMethods"><i class="bi bi-wallet2 me-1"></i>Medios de Pago</button>
                        ${!isStaff ? `
                            <button class="btn btn-outline-warning" id="btnAuditPayments"><i class="bi bi-shield-check me-1"></i>Validación de Pagos</button>
                            <button class="btn btn-outline-primary" id="btnCreateRoomType"><i class="bi bi-tags-fill me-1"></i>Estilos/Tipos</button>
                            <button class="btn btn-primary" id="btnCreateRoom"><i class="bi bi-plus-lg me-1"></i>Nueva Habitación</button>
                        ` : ''}
                        <button class="btn btn-outline-secondary" id="btnQuickCleaningView"><i class="bi bi-stars me-1"></i>Mucamas</button>
                    </div>
                </div>

                <!-- Legend Cards -->
                <div class="row g-3 mb-4">
                    <div class="col-6 col-md-3">
                        <div class="p-3 border rounded shadow-sm d-flex align-items-center bg-white">
                            <div class="rounded-circle p-2 bg-success text-white me-3"><i class="bi bi-check-lg fs-5"></i></div>
                            <div>
                                <div class="text-muted small">Disponibles</div>
                                <div class="fs-4 fw-bold text-success">${rooms.filter(r => r.status === 'AVAILABLE').length}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 border rounded shadow-sm d-flex align-items-center bg-white">
                            <div class="rounded-circle p-2 bg-danger text-white me-3"><i class="bi bi-person-fill fs-5"></i></div>
                            <div>
                                <div class="text-muted small">Ocupadas</div>
                                <div class="fs-4 fw-bold text-danger">${rooms.filter(r => r.status === 'OCCUPIED').length}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 border rounded shadow-sm d-flex align-items-center bg-white">
                            <div class="rounded-circle p-2 bg-warning text-dark me-3"><i class="bi bi-brush-fill fs-5"></i></div>
                            <div>
                                <div class="text-muted small">En Limpieza</div>
                                <div class="fs-4 fw-bold text-warning">${rooms.filter(r => r.status === 'CLEANING').length}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3">
                        <div class="p-3 border rounded shadow-sm d-flex align-items-center bg-white">
                            <div class="rounded-circle p-2 bg-secondary text-white me-3"><i class="bi bi-tools fs-5"></i></div>
                            <div>
                                <div class="text-muted small">Mantenimiento</div>
                                <div class="fs-4 fw-bold text-secondary">${rooms.filter(r => r.status === 'MAINTENANCE').length}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Grid of Room Cards -->
                <div class="row g-3" id="roomsGridContainer">
            `;

            if (rooms.length === 0) {
                html += `<div class="col-12"><div class="alert alert-info text-center py-4"><i class="bi bi-info-circle fs-3 d-block mb-2"></i>No hay habitaciones registradas. Haga clic en "Nueva Habitación" para empezar.</div></div>`;
            } else {
                rooms.forEach(room => {
                    const statusClass = room.status === 'AVAILABLE' ? 'status-available' :
                                        room.status === 'OCCUPIED' ? 'status-occupied' :
                                        room.status === 'CLEANING' ? 'status-cleaning' : 'status-maintenance';

                    const statusBadgeText = room.status === 'AVAILABLE' ? 'Disponible 🟢' :
                                            room.status === 'OCCUPIED' ? 'Ocupada 🔴' :
                                            room.status === 'CLEANING' ? 'En Limpieza 🟡' : 'Mantenimiento 🟠';

                    html += `
                        <div class="col-12 col-sm-6 col-md-4 col-lg-3">
                            <div class="card h-100 room-card ${statusClass} p-3 shadow-sm">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h4 class="fw-bold mb-0">Hab. ${room.room_number}</h4>
                                        <span class="text-muted small">${room.room_type_name} ($${room.base_price_usd}/noche)</span>
                                    </div>
                                    <span class="badge room-badge rounded-pill">${statusBadgeText}</span>
                                </div>
                                <div class="mb-3">
                                    <small class="text-secondary d-block"><i class="bi bi-card-text me-1"></i>${room.notes || 'Sin observaciones'}</small>
                                    ${room.cleaned_by ? `<small class="text-success d-block"><i class="bi bi-check-all me-1"></i>Limpia por: ${room.cleaned_by}</small>` : ''}
                                </div>
                                <div class="mt-auto d-flex flex-column gap-1">
                                    ${room.status === 'CLEANING' ? `
                                        <button class="btn btn-sm btn-success w-100 btn-mark-clean" data-id="${room.id}">
                                            <i class="bi bi-stars me-1"></i>Marcar Limpia y Lista
                                        </button>
                                    ` : room.status === 'AVAILABLE' ? `
                                        <button class="btn btn-sm btn-success w-100 btn-rack-checkin-room mb-1 fw-bold" data-id="${room.id}">
                                            <i class="bi bi-box-arrow-in-right me-1"></i>Check-in aquí
                                        </button>
                                        <div class="d-flex gap-1 w-100">
                                            <button class="btn btn-sm btn-outline-danger flex-fill btn-set-status" data-id="${room.id}" data-status="CLEANING">
                                                <i class="bi bi-brush"></i> Limpieza
                                            </button>
                                            <button class="btn btn-sm btn-outline-warning flex-fill btn-set-status" data-id="${room.id}" data-status="MAINTENANCE">
                                                <i class="bi bi-tools"></i> Mant.
                                            </button>
                                        </div>
                                    ` : room.status === 'MAINTENANCE' ? `
                                        <button class="btn btn-sm btn-outline-success btn-set-status" data-id="${room.id}" data-status="AVAILABLE">
                                            <i class="bi bi-check-circle me-1"></i>Habilitar Disponible
                                        </button>
                                    ` : `
                                        <button class="btn btn-sm btn-primary w-100 btn-rack-pos-cobro fw-bold mb-1" data-id="${room.id}">
                                            <i class="bi bi-cash-stack me-1"></i>Cobrar / POS
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger w-100 btn-rack-checkout" data-id="${room.id}">
                                            <i class="bi bi-box-arrow-right me-1"></i>Check-out
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            html += `</div>`;
            container.innerHTML = html;
            container.innerHTML = html;

            // Bind Action Listeners
            this.bindRackEvents(container, rooms, types);
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    bindRackEvents(container, rooms, types) {
        // Main Check-in Header Button
        const btnRackCheckIn = container.querySelector('#btnRackCheckIn');
        if (btnRackCheckIn) {
            btnRackCheckIn.onclick = () => this.showCheckInModal(container);
        }

        // Room Card Check-in Buttons
        container.querySelectorAll('.btn-rack-checkin-room').forEach(btn => {
            btn.onclick = () => {
                const roomId = btn.getAttribute('data-id');
                this.showCheckInModal(container, roomId);
            };
        });

        // Payment Methods Management Button
        const btnPaymentMethods = container.querySelector('#btnPaymentMethods');
        if (btnPaymentMethods) {
            btnPaymentMethods.onclick = () => this.showPaymentMethodsModal(container);
        }

        // Audit & Validate Payments Button
        const btnAuditPayments = container.querySelector('#btnAuditPayments');
        if (btnAuditPayments) {
            btnAuditPayments.onclick = () => this.showPaymentAuditModal(container);
        }

        // Room Card POS Cobro Buttons
        container.querySelectorAll('.btn-rack-pos-cobro').forEach(btn => {
            btn.onclick = () => {
                const roomId = btn.getAttribute('data-id');
                this.showPOSCobroModal(container, roomId, false);
            };
        });

        // Room Card Check-out Buttons
        container.querySelectorAll('.btn-rack-checkout').forEach(btn => {
            btn.onclick = () => {
                const roomId = btn.getAttribute('data-id');
                this.showPOSCobroModal(container, roomId, true);
            };
        });

        // Quick Cleaning View Button
        const btnCleaning = container.querySelector('#btnQuickCleaningView');
        if (btnCleaning) {
            btnCleaning.onclick = () => window.location.hash = '#limpieza';
        }

        // Quick 1-Click Mark Clean (Mucamas / Staff)
        container.querySelectorAll('.btn-mark-clean').forEach(btn => {
            btn.onclick = async () => {
                const roomId = btn.getAttribute('data-id');
                try {
                    btn.disabled = true;
                    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Procesando...`;
                    await API.put('/rooms/status', { roomId, status: 'AVAILABLE' });
                    UI.showToast('Habitación marcada como Limpia y Disponible exitosamente ✨', 'success');
                    this.renderRack(container);
                } catch (e) {
                    UI.showToast(e.message, 'danger');
                    btn.disabled = false;
                }
            };
        });

        // Set status
        container.querySelectorAll('.btn-set-status').forEach(btn => {
            btn.onclick = async () => {
                const roomId = btn.getAttribute('data-id');
                const status = btn.getAttribute('data-status');
                try {
                    await API.put('/rooms/status', { roomId, status });
                    UI.showToast('Estado de habitación actualizado.', 'info');
                    this.renderRack(container);
                } catch (e) {
                    UI.showToast(e.message, 'danger');
                }
            };
        });

        // Create Room Type & Management Modal
        const btnCreateType = container.querySelector('#btnCreateRoomType');
        if (btnCreateType) {
            btnCreateType.onclick = async () => {
                let currentTypes = types;
                try {
                    const data = await API.get('/rooms');
                    currentTypes = data.roomTypes || [];
                } catch (e) {}

                const renderRoomTypeModal = () => {
                    UI.showModal({
                        title: 'Gestión & Creación de Estilos / Tipos de Habitación',
                        bodyHtml: `
                            <div class="card border-0 bg-light p-3 mb-4 rounded-3">
                                <h6 class="fw-bold text-primary mb-2"><i class="bi bi-plus-circle-fill me-1"></i>Crear Nuevo Estilo / Tipo</h6>
                                <form id="formRoomType">
                                    <div class="mb-3">
                                        <label class="form-label fw-semibold">Nombre del Estilo / Tipo (Libre)</label>
                                        <input type="text" class="form-control" id="rtName" placeholder="Ej: Suite VIP Vista al Mar, Cabaña Marina, Matrimonial Deluxe" required>
                                    </div>
                                    <div class="row g-2 mb-3">
                                        <div class="col-6">
                                            <label class="form-label fw-semibold">Precio Base por Noche ($USD)</label>
                                            <input type="number" step="0.01" class="form-control" id="rtPrice" placeholder="50.00" required>
                                        </div>
                                        <div class="col-6">
                                            <label class="form-label fw-semibold">Capacidad de Huéspedes</label>
                                            <input type="number" class="form-control" id="rtCap" value="2" min="1" required>
                                        </div>
                                    </div>
                                    <button type="button" class="btn btn-primary w-100 fw-bold shadow-sm" id="btnSaveRoomType">
                                        <i class="bi bi-check-circle me-1"></i>Guardar Nuevo Estilo
                                    </button>
                                </form>
                            </div>

                            <div>
                                <h6 class="fw-bold text-dark mb-2"><i class="bi bi-tags-fill me-1 text-primary"></i>Estilos Registrados (${currentTypes.length})</h6>
                                ${currentTypes.length === 0 ? `
                                    <p class="text-muted small text-center py-3">No hay estilos registrados aún.</p>
                                ` : `
                                    <div class="table-responsive border rounded custom-scroll" style="max-height: 220px; overflow-y: auto;">
                                        <table class="table table-sm table-hover align-middle mb-0 small">
                                            <thead class="table-light sticky-top">
                                                <tr>
                                                    <th>Estilo / Tipo</th>
                                                    <th>Precio Base ($USD)</th>
                                                    <th>Capacidad</th>
                                                    <th class="text-end">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${currentTypes.map(t => `
                                                    <tr>
                                                        <td class="fw-bold text-dark">${t.name}</td>
                                                        <td class="fw-bold text-primary">$${Number(t.base_price_usd).toFixed(2)} USD</td>
                                                        <td><span class="badge bg-secondary-subtle text-secondary border"><i class="bi bi-people me-1"></i>${t.capacity} pers.</span></td>
                                                        <td class="text-end">
                                                            <button type="button" class="btn btn-sm btn-outline-primary me-1 btn-edit-room-type" data-id="${t.id}" title="Editar estilo">
                                                                <i class="bi bi-pencil-fill"></i>
                                                            </button>
                                                            <button type="button" class="btn btn-sm btn-outline-danger btn-delete-room-type" data-id="${t.id}" title="Eliminar estilo">
                                                                <i class="bi bi-trash-fill"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        `,
                        footerHtml: `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`
                    });

                    // Save new room type
                    const btnSaveType = document.getElementById('btnSaveRoomType');
                    if (btnSaveType) {
                        btnSaveType.onclick = async () => {
                            const typeName = document.getElementById('rtName').value;
                            const basePriceUsd = document.getElementById('rtPrice').value;
                            const capacity = document.getElementById('rtCap').value;

                            if (!typeName || !basePriceUsd) {
                                UI.showToast('Debe ingresar nombre y precio base.', 'warning');
                                return;
                            }

                            try {
                                await API.post('/rooms', { action: 'create_type', typeName, basePriceUsd, capacity });
                                UI.showToast('Tipo de habitación creado exitosamente.', 'success');
                                const data = await API.get('/rooms');
                                currentTypes = data.roomTypes || [];
                                this.renderRack(container);
                                renderRoomTypeModal();
                            } catch (e) {
                                UI.showToast(e.message, 'danger');
                            }
                        };
                    }

                    // Edit Room Type Submodal
                    const modalEl = document.getElementById('dynamicModal');
                    modalEl.querySelectorAll('.btn-edit-room-type').forEach(btn => {
                        btn.onclick = () => {
                            const typeId = btn.dataset.id;
                            const targetType = currentTypes.find(t => t.id === typeId);
                            if (!targetType) return;

                            UI.showModal({
                                title: `Editar Estilo: ${targetType.name}`,
                                bodyHtml: `
                                    <form id="formEditRoomType">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Nombre del Estilo / Tipo</label>
                                            <input type="text" class="form-control" id="editRtName" value="${targetType.name}" required>
                                        </div>
                                        <div class="row g-2 mb-3">
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Precio Base ($USD)</label>
                                                <input type="number" step="0.01" class="form-control" id="editRtPrice" value="${targetType.base_price_usd}" required>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Capacidad</label>
                                                <input type="number" class="form-control" id="editRtCap" value="${targetType.capacity}" min="1" required>
                                            </div>
                                        </div>
                                    </form>
                                `,
                                footerHtml: `
                                    <button type="button" class="btn btn-secondary" id="btnCancelEditType"><i class="bi bi-arrow-left me-1"></i>Volver</button>
                                    <button type="button" class="btn btn-primary" id="btnUpdateRoomType"><i class="bi bi-save me-1"></i>Guardar Cambios</button>
                                `
                            });

                            document.getElementById('btnCancelEditType').onclick = () => {
                                renderRoomTypeModal();
                            };

                            document.getElementById('btnUpdateRoomType').onclick = async () => {
                                const typeName = document.getElementById('editRtName').value;
                                const basePriceUsd = document.getElementById('editRtPrice').value;
                                const capacity = document.getElementById('editRtCap').value;

                                try {
                                    await API.put('/rooms', { action: 'update_type', typeId: targetType.id, typeName, basePriceUsd, capacity });
                                    UI.showToast('Estilo actualizado correctamente.', 'success');
                                    const data = await API.get('/rooms');
                                    currentTypes = data.roomTypes || [];
                                    this.renderRack(container);
                                    renderRoomTypeModal();
                                } catch (err) {
                                    UI.showToast(err.message, 'danger');
                                }
                            };
                        };
                    });

                    // Delete Room Type Handler
                    modalEl.querySelectorAll('.btn-delete-room-type').forEach(btn => {
                        btn.onclick = async () => {
                            const typeId = btn.dataset.id;
                            try {
                                await API.delete('/rooms?typeId=' + typeId);
                                UI.showToast('Estilo eliminado.', 'info');
                                const data = await API.get('/rooms');
                                currentTypes = data.roomTypes || [];
                                this.renderRack(container);
                                renderRoomTypeModal();
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                            }
                        };
                    });
                };

                renderRoomTypeModal();
            };
        }

        // Create Room & Management Modal
        const btnCreateRoom = container.querySelector('#btnCreateRoom');
        if (btnCreateRoom) {
            btnCreateRoom.onclick = async () => {
                let currentRooms = rooms;
                let currentTypes = types;
                try {
                    const data = await API.get('/rooms');
                    currentRooms = data.rooms || [];
                    currentTypes = data.roomTypes || [];
                } catch (e) {}

                const renderRoomManageModal = () => {
                    let typeOptions = currentTypes.map(t => `<option value="${t.id}">${t.name} ($${t.base_price_usd}/noche)</option>`).join('');

                    UI.showModal({
                        title: 'Gestión & Agregar Nueva Habitación al Rack',
                        bodyHtml: `
                            <div class="card border-0 bg-light p-3 mb-4 rounded-3">
                                <h6 class="fw-bold text-primary mb-2"><i class="bi bi-plus-circle-fill me-1"></i>Registrar Nueva Habitación</h6>
                                <form id="formRoom">
                                    <div class="row g-2 mb-3">
                                        <div class="col-6">
                                            <label class="form-label fw-semibold">Número de Habitación / Identificador</label>
                                            <input type="text" class="form-control" id="rmNumber" placeholder="Ej: 101, 202-B, Cabaña 3" required>
                                        </div>
                                        <div class="col-6">
                                            <label class="form-label fw-semibold">Tipo / Estilo</label>
                                            <select class="form-select" id="rmType" required>
                                                ${typeOptions || '<option value="">Sin tipos de habitación registrados</option>'}
                                            </select>
                                        </div>
                                    </div>
                                    <div class="row g-2 mb-3">
                                        <div class="col-6">
                                            <label class="form-label fw-semibold">Estado Inicial</label>
                                            <select class="form-select" id="rmStatus">
                                                <option value="AVAILABLE">Disponible para Alquilar</option>
                                                <option value="MAINTENANCE">Inhabilitada (Mantenimiento)</option>
                                                <option value="OUT_OF_SERVICE">Fuera de Servicio (Reparación)</option>
                                            </select>
                                        </div>
                                        <div class="col-6">
                                            <label class="form-label fw-semibold">Observaciones / Detalles</label>
                                            <input type="text" class="form-control" id="rmNotes" placeholder="Ej: Vista a la piscina, cama King">
                                        </div>
                                    </div>
                                    <button type="button" class="btn btn-primary w-100 fw-bold shadow-sm" id="btnSaveRoom">
                                        <i class="bi bi-plus-lg me-1"></i>Agregar Habitación al Rack
                                    </button>
                                </form>
                            </div>

                            <div>
                                <h6 class="fw-bold text-dark mb-2"><i class="bi bi-grid-3x3-gap-fill me-1 text-primary"></i>Habitaciones Registradas en el Rack (${currentRooms.length})</h6>
                                ${currentRooms.length === 0 ? `
                                    <p class="text-muted small text-center py-3">No hay habitaciones registradas en este hotel.</p>
                                ` : `
                                    <div class="table-responsive border rounded custom-scroll" style="max-height: 230px; overflow-y: auto;">
                                        <table class="table table-sm table-hover align-middle mb-0 small">
                                            <thead class="table-light sticky-top">
                                                <tr>
                                                    <th>N° Hab.</th>
                                                    <th>Estilo / Tipo</th>
                                                    <th>Estado</th>
                                                    <th>Notas</th>
                                                    <th class="text-end">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${currentRooms.map(r => {
                                                    let statusBadge = '';
                                                    if (r.status === 'AVAILABLE') {
                                                        statusBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle me-1"></i>Disponible</span>`;
                                                    } else if (r.status === 'OCCUPIED') {
                                                        statusBadge = `<span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-person-fill me-1"></i>Ocupada</span>`;
                                                    } else if (r.status === 'CLEANING') {
                                                        statusBadge = `<span class="badge bg-warning-subtle text-warning border border-warning-subtle"><i class="bi bi-stars me-1"></i>Limpieza</span>`;
                                                    } else {
                                                        statusBadge = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-slash-circle me-1"></i>Inhabilitada</span>`;
                                                    }

                                                    const isMaint = r.status === 'MAINTENANCE' || r.status === 'OUT_OF_SERVICE';

                                                    return `
                                                        <tr>
                                                            <td class="fw-bold text-dark">Hab. ${r.room_number}</td>
                                                            <td>${r.room_type_name || '-'}</td>
                                                            <td>${statusBadge}</td>
                                                            <td class="text-muted small">${r.notes || '-'}</td>
                                                            <td class="text-end">
                                                                <button type="button" class="btn btn-xs ${isMaint ? 'btn-outline-success' : 'btn-outline-warning'} me-1 btn-toggle-room" data-id="${r.id}" data-status="${r.status}" title="${isMaint ? 'Habilitar' : 'Inhabilitar'}">
                                                                    <i class="bi ${isMaint ? 'bi-check-lg' : 'bi-slash-circle'}"></i> ${isMaint ? 'Habilitar' : 'Inhabilitar'}
                                                                </button>
                                                                <button type="button" class="btn btn-xs btn-outline-primary me-1 btn-edit-room" data-id="${r.id}" title="Editar">
                                                                    <i class="bi bi-pencil-fill"></i>
                                                                </button>
                                                                <button type="button" class="btn btn-xs btn-outline-danger btn-delete-room" data-id="${r.id}" title="Eliminar">
                                                                    <i class="bi bi-trash-fill"></i>
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                `}
                            </div>
                        `,
                        footerHtml: `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`
                    });

                    // Save room
                    const btnSaveR = document.getElementById('btnSaveRoom');
                    if (btnSaveR) {
                        btnSaveR.onclick = async () => {
                            const roomNumber = document.getElementById('rmNumber').value;
                            const roomTypeId = document.getElementById('rmType').value;
                            const status = document.getElementById('rmStatus').value;
                            const notes = document.getElementById('rmNotes').value;

                            if (!roomNumber) {
                                UI.showToast('Debe ingresar el número de habitación.', 'warning');
                                return;
                            }

                            try {
                                await API.post('/rooms', { roomNumber, roomTypeId, status, notes });
                                UI.showToast('Habitación creada exitosamente.', 'success');
                                const data = await API.get('/rooms');
                                currentRooms = data.rooms || [];
                                currentTypes = data.roomTypes || [];
                                this.renderRack(container);
                                renderRoomManageModal();
                            } catch (e) {
                                UI.showToast(e.message, 'danger');
                            }
                        };
                    }

                    const modalEl = document.getElementById('dynamicModal');

                    // Toggle room status (Inhabilitar / Habilitar)
                    modalEl.querySelectorAll('.btn-toggle-room').forEach(btn => {
                        btn.onclick = async () => {
                            const roomId = btn.dataset.id;
                            const currentStatus = btn.dataset.status;
                            const newStatus = (currentStatus === 'MAINTENANCE' || currentStatus === 'OUT_OF_SERVICE') ? 'AVAILABLE' : 'MAINTENANCE';

                            try {
                                await API.put('/rooms', { roomId, status: newStatus });
                                UI.showToast(`Habitación ${newStatus === 'AVAILABLE' ? 'habilitada' : 'inhabilitada'} correctamente.`, 'info');
                                const data = await API.get('/rooms');
                                currentRooms = data.rooms || [];
                                currentTypes = data.roomTypes || [];
                                this.renderRack(container);
                                renderRoomManageModal();
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                            }
                        };
                    });

                    // Edit room submodal
                    modalEl.querySelectorAll('.btn-edit-room').forEach(btn => {
                        btn.onclick = () => {
                            const roomId = btn.dataset.id;
                            const room = currentRooms.find(r => r.id === roomId);
                            if (!room) return;

                            let editTypeOptions = currentTypes.map(t => `<option value="${t.id}" ${t.id === room.room_type_id ? 'selected' : ''}>${t.name} ($${t.base_price_usd}/noche)</option>`).join('');

                            UI.showModal({
                                title: `Editar Habitación N° ${room.room_number}`,
                                bodyHtml: `
                                    <form id="formEditRoom">
                                        <div class="row g-2 mb-3">
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Número / Identificador</label>
                                                <input type="text" class="form-control" id="editRmNumber" value="${room.room_number}" required>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Estilo / Tipo</label>
                                                <select class="form-select" id="editRmType" required>
                                                    ${editTypeOptions}
                                                </select>
                                            </div>
                                        </div>
                                        <div class="row g-2 mb-3">
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Estado de la Habitación</label>
                                                <select class="form-select" id="editRmStatus">
                                                    <option value="AVAILABLE" ${room.status === 'AVAILABLE' ? 'selected' : ''}>Disponible</option>
                                                    <option value="OCCUPIED" ${room.status === 'OCCUPIED' ? 'selected' : ''}>Ocupada</option>
                                                    <option value="CLEANING" ${room.status === 'CLEANING' ? 'selected' : ''}>En Limpieza</option>
                                                    <option value="MAINTENANCE" ${room.status === 'MAINTENANCE' ? 'selected' : ''}>Inhabilitada (Mantenimiento)</option>
                                                    <option value="OUT_OF_SERVICE" ${room.status === 'OUT_OF_SERVICE' ? 'selected' : ''}>Fuera de Servicio</option>
                                                </select>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Observaciones / Detalles</label>
                                                <input type="text" class="form-control" id="editRmNotes" value="${room.notes || ''}">
                                            </div>
                                        </div>
                                    </form>
                                `,
                                footerHtml: `
                                    <button type="button" class="btn btn-secondary" id="btnCancelEditRoom"><i class="bi bi-arrow-left me-1"></i>Volver</button>
                                    <button type="button" class="btn btn-primary" id="btnUpdateRoom"><i class="bi bi-save me-1"></i>Guardar Cambios</button>
                                `
                            });

                            document.getElementById('btnCancelEditRoom').onclick = () => {
                                renderRoomManageModal();
                            };

                            document.getElementById('btnUpdateRoom').onclick = async () => {
                                const roomNumber = document.getElementById('editRmNumber').value;
                                const roomTypeId = document.getElementById('editRmType').value;
                                const status = document.getElementById('editRmStatus').value;
                                const notes = document.getElementById('editRmNotes').value;

                                try {
                                    await API.put('/rooms', { roomId: room.id, roomNumber, roomTypeId, status, notes });
                                    UI.showToast('Habitación actualizada exitosamente.', 'success');
                                    const data = await API.get('/rooms');
                                    currentRooms = data.rooms || [];
                                    currentTypes = data.roomTypes || [];
                                    this.renderRack(container);
                                    renderRoomManageModal();
                                } catch (err) {
                                    UI.showToast(err.message, 'danger');
                                }
                            };
                        };
                    });

                    // Delete room handler
                    modalEl.querySelectorAll('.btn-delete-room').forEach(btn => {
                        btn.onclick = async () => {
                            const roomId = btn.dataset.id;
                            try {
                                await API.delete('/rooms?id=' + roomId);
                                UI.showToast('Habitación eliminada.', 'info');
                                const data = await API.get('/rooms');
                                currentRooms = data.rooms || [];
                                currentTypes = data.roomTypes || [];
                                this.renderRack(container);
                                renderRoomManageModal();
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                            }
                        };
                    });
                };

                renderRoomManageModal();
            };
        }
    },

    // MODALES Y SERVICIOS DEL RACK Y RECEPCIÓN
    async showCheckInModal(container, preselectedRoomId = null) {
        let rooms = [];
        let guests = [];
        try {
            const roomsData = await API.get('/rooms');
            rooms = (roomsData.rooms || []).filter(r => r.status === 'AVAILABLE' || r.id === preselectedRoomId);
            guests = await API.get('/guests');
        } catch (e) {
            UI.showToast('Error cargando datos para Check-in: ' + e.message, 'danger');
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        UI.showModal({
            title: '🛎️ Nuevo Check-in / Asignar Habitación Directa',
            bodyHtml: `
                <form id="formCheckInRack">
                    <div class="card border-0 bg-light p-3 mb-3 rounded-3">
                        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-person-fill me-1"></i>1. Selección o Registro de Huésped</h6>
                        <div class="row g-2 mb-2">
                            <div class="col-md-7">
                                <label class="form-label small fw-semibold">Seleccionar Huésped Existente</label>
                                <select class="form-select form-select-sm" id="ciGuestSelect">
                                    <option value="">-- Registrar Nuevo Huésped A Continuación --</option>
                                    ${guests.map(g => `<option value="${g.id}">${g.full_name} (${g.document_type || 'V'}-${g.document_id})</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-5 d-flex align-items-end">
                                <small class="text-muted">Si no existe en la lista, llene los datos rápidos:</small>
                            </div>
                        </div>
                        <div class="row g-2" id="quickGuestFields">
                            <div class="col-md-6">
                                <input type="text" class="form-control form-control-sm" id="ciGuestName" placeholder="Nombre completo del cliente">
                            </div>
                            <div class="col-md-2">
                                <select class="form-select form-select-sm" id="ciGuestDocType">
                                    <option value="V">V</option>
                                    <option value="E">E</option>
                                    <option value="J">J</option>
                                    <option value="G">G</option>
                                    <option value="PASSPORT">Pasaporte</option>
                                </select>
                            </div>
                            <div class="col-md-4">
                                <input type="text" class="form-control form-control-sm" id="ciGuestDocId" placeholder="N° Cédula / RIF / ID">
                            </div>
                        </div>
                    </div>

                    <div class="card border-0 bg-light p-3 mb-3 rounded-3">
                        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-door-open-fill me-1"></i>2. Habitación, Período y Depósito</h6>
                        <div class="row g-2 mb-3">
                            <div class="col-md-6">
                                <label class="form-label small fw-semibold">Habitación Disponible</label>
                                <select class="form-select form-select-sm" id="ciRoomSelect" required>
                                    <option value="">-- Seleccionar Habitación --</option>
                                    ${rooms.map(r => `<option value="${r.id}" data-price="${r.base_price_usd}" ${r.id === preselectedRoomId ? 'selected' : ''}>Hab. ${r.room_number} - ${r.room_type_name} ($${r.base_price_usd}/noche)</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label small fw-semibold">Entrada (Check-in)</label>
                                <input type="date" class="form-control form-control-sm" id="ciCheckInDate" value="${todayStr}" required>
                            </div>
                            <div class="col-md-3">
                                <label class="form-label small fw-semibold">Salida Estimada</label>
                                <input type="date" class="form-control form-control-sm" id="ciCheckOutDate" value="${tomorrowStr}" required>
                            </div>
                        </div>
                        <div class="row g-2">
                            <div class="col-md-6">
                                <label class="form-label small fw-semibold">Depósito / Abono Inicial ($USD)</label>
                                <input type="number" step="0.01" class="form-control form-control-sm" id="ciDeposit" value="0.00">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label small fw-semibold">Observaciones / Notas</label>
                                <input type="text" class="form-control form-control-sm" id="ciNotes" placeholder="Ej: Abono de garantía en dólares">
                            </div>
                        </div>
                    </div>
                </form>
            `,
            footerButtons: [
                { text: 'Cancelar', class: 'btn-secondary', dismiss: true },
                {
                    text: ' Confirmar Check-in Directo',
                    class: 'btn-success fw-bold',
                    onClick: async () => {
                        let guestId = document.getElementById('ciGuestSelect').value;
                        if (!guestId) {
                            const name = document.getElementById('ciGuestName').value.trim();
                            const docType = document.getElementById('ciGuestDocType').value;
                            const docId = document.getElementById('ciGuestDocId').value.trim();
                            if (!name || !docId) {
                                UI.showToast('Debe seleccionar un huésped existente o ingresar Nombre y N° Documento.', 'danger');
                                return;
                            }
                            try {
                                const newG = await API.post('/guests', { fullName: name, documentType: docType, documentId: docId });
                                guestId = newG.guest.id;
                            } catch (err) {
                                UI.showToast('Error al registrar huésped: ' + err.message, 'danger');
                                return;
                            }
                        }

                        const roomId = document.getElementById('ciRoomSelect').value;
                        const checkInDate = document.getElementById('ciCheckInDate').value;
                        const checkOutDate = document.getElementById('ciCheckOutDate').value;
                        const depositUsd = document.getElementById('ciDeposit').value || 0;
                        const notes = document.getElementById('ciNotes').value;

                        if (!roomId) {
                            UI.showToast('Por favor seleccione una habitación.', 'warning');
                            return;
                        }

                        const roomOption = document.querySelector(`#ciRoomSelect option[value="${roomId}"]`);
                        const nightPrice = roomOption ? parseFloat(roomOption.getAttribute('data-price') || 0) : 0;
                        const d1 = new Date(checkInDate);
                        const d2 = new Date(checkOutDate);
                        const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
                        const totalAmountUsd = nightPrice * diffDays;

                        try {
                            await API.post('/bookings', {
                                roomId,
                                guestId,
                                checkInDate,
                                checkOutDate,
                                depositUsd,
                                totalAmountUsd,
                                notes,
                                isCheckInImmediate: true
                            });

                            UI.showToast('Check-in realizado exitosamente. Habitación ocupada.', 'success');
                            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                            this.renderRack(container);
                        } catch (err) {
                            UI.showToast('Error al realizar Check-in: ' + err.message, 'danger');
                        }
                    }
                }
            ]
        });
    },

    async showPOSCobroModal(container, roomId, isCheckout = false) {
        try {
            const bookings = await API.get('/bookings?status=CHECKED_IN');
            const booking = bookings.find(b => b.room_id === roomId);
            if (!booking) {
                UI.showToast('No hay una ocupación activa en esta habitación.', 'warning');
                return;
            }

            const expenses = await API.get(`/expenses?bookingId=${booking.id}`);
            const totalExpensesUsd = expenses.reduce((acc, e) => acc + Number(e.amount_usd || 0), 0);
            const subtotalUsd = Number(booking.total_amount_usd);
            const totalUsd = subtotalUsd + totalExpensesUsd;

            const bcvRateData = await API.get('/billing/bcv');
            const bcvRate = Number(bcvRateData.promedio || 40.0);
            const totalVes = totalUsd * bcvRate;

            const paymentMethods = await API.get('/payment-methods');
            const activeMethods = paymentMethods.filter(m => Number(m.is_active) === 1);

            UI.showModal({
                title: isCheckout ? '🧾 Check-out & Cobro Final POS' : '💳 POS de Recepción - Registrar Cobro',
                bodyHtml: `
                    <div class="card border-0 bg-light p-3 mb-3 rounded-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold text-primary mb-0"><i class="bi bi-person-badge-fill me-1"></i>Detalles de Ocupación</h6>
                            <span class="badge bg-primary fs-6">Hab. ${booking.room_number}</span>
                        </div>
                        <p class="mb-1"><strong>Huésped:</strong> ${booking.guest_name} (${booking.document_type || 'V'}-${booking.document_id})</p>
                        <p class="mb-0 small text-muted"><strong>Período:</strong> ${booking.check_in_date} al ${booking.check_out_date}</p>
                    </div>

                    <!-- Account Balance Summary -->
                    <div class="row g-2 mb-3">
                        <div class="col-6 col-md-3">
                            <div class="p-2 border rounded bg-white text-center">
                                <small class="text-muted d-block">Hospedaje</small>
                                <span class="fw-bold text-dark">$${subtotalUsd.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="p-2 border rounded bg-white text-center">
                                <small class="text-muted d-block">Consumos Extras (${expenses.length})</small>
                                <span class="fw-bold text-dark">$${totalExpensesUsd.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="p-2 border rounded bg-white text-center">
                                <small class="text-muted d-block">TOTAL USD</small>
                                <span class="fw-bold text-primary fs-5">$${totalUsd.toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="col-6 col-md-3">
                            <div class="p-2 border rounded bg-white text-center">
                                <small class="text-muted d-block">TOTAL VES (BCV ${bcvRate.toFixed(2)})</small>
                                <span class="fw-bold text-success fs-6">Bs. ${totalVes.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Payment Form POS -->
                    <div class="card border-0 bg-white p-3 border rounded-3 shadow-sm">
                        <h6 class="fw-bold text-dark mb-3"><i class="bi bi-wallet2 me-1 text-success"></i>Forma y Datos de Pago</h6>
                        
                        <div class="mb-3">
                            <label class="form-label fw-semibold small">Seleccionar Medio de Pago Configurado</label>
                            <select class="form-select form-select-sm" id="posMethodSelect">
                                <option value="">-- Seleccionar Forma de Pago --</option>
                                ${activeMethods.map(m => `<option value="${m.id}" data-reqval="${m.requires_admin_validation}" data-details="${m.account_details || ''}" data-bank="${m.bank_name || ''}">${m.name} (${Number(m.requires_admin_validation) === 1 ? '⚠️ Requiere Validación Admin' : '✅ Confirmación Inmediata'})</option>`).join('')}
                            </select>
                        </div>

                        <div id="posMethodDetailsBox" class="alert alert-info small d-none py-2 mb-3">
                            <i class="bi bi-info-circle-fill me-1"></i><span id="posMethodDetailsText"></span>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-md-6">
                                <label class="form-label fw-semibold small">Monto Recibido / Cobrado ($USD)</label>
                                <input type="number" step="0.01" class="form-control form-control-sm" id="posAmountUsd" value="${totalUsd.toFixed(2)}">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-semibold small">Banco Origen / Entidad (Si es Transferencia)</label>
                                <input type="text" class="form-control form-control-sm" id="posBankOrigin" placeholder="Ej: BNC, Banco de Venezuela, Mercantil">
                            </div>
                        </div>

                        <div class="row g-2 mb-3">
                            <div class="col-md-6">
                                <label class="form-label fw-semibold small">N° de Referencia / Comprobante</label>
                                <input type="text" class="form-control form-control-sm" id="posRefNumber" placeholder="Ej: 00289182">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label fw-semibold small">Notas de Recepción</label>
                                <input type="text" class="form-control form-control-sm" id="posNotes" placeholder="Observaciones adicionales">
                            </div>
                        </div>

                        <div class="mb-2">
                            <label class="form-label fw-semibold small d-block">Condición de Pago / Facturación</label>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="posStatusRadio" id="posPaidRadio" value="PAID" checked>
                                <label class="form-check-label text-success fw-bold" for="posPaidRadio">🟢 PAGADO COMPLETAMENTE</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="posStatusRadio" id="posCreditRadio" value="CREDIT">
                                <label class="form-check-label text-warning fw-bold" for="posCreditRadio">🟡 LÍNEA DE CRÉDITO / PENDIENTE</label>
                            </div>
                        </div>
                    </div>
                `,
                footerButtons: [
                    { text: 'Cancelar', class: 'btn-secondary', dismiss: true },
                    {
                        text: isCheckout ? ' Confirmar Check-out & Emitir Factura' : ' Registrar Pago POS',
                        class: isCheckout ? 'btn-danger fw-bold' : 'btn-primary fw-bold',
                        onClick: async () => {
                            const methodId = document.getElementById('posMethodSelect').value;
                            const amountUsd = document.getElementById('posAmountUsd').value;
                            const bankOrigin = document.getElementById('posBankOrigin').value;
                            const referenceNumber = document.getElementById('posRefNumber').value;
                            const notes = document.getElementById('posNotes').value;
                            const paymentStatus = document.querySelector('input[name="posStatusRadio"]:checked').value;

                            if (!methodId && paymentStatus === 'PAID') {
                                UI.showToast('Por favor seleccione una Forma de Pago.', 'warning');
                                return;
                            }

                            try {
                                if (isCheckout) {
                                    const checkoutRes = await API.post('/bookings/checkout', {
                                        bookingId: booking.id,
                                        paymentStatus,
                                        paymentMethodId: methodId,
                                        referenceNumber,
                                        bankOrigin,
                                        notes
                                    });
                                    UI.showToast(checkoutRes.message || 'Check-out procesado exitosamente.', 'success');
                                } else {
                                    const payRes = await API.post('/guest-payments', {
                                        bookingId: booking.id,
                                        paymentMethodId: methodId,
                                        amountUsd,
                                        referenceNumber,
                                        bankOrigin,
                                        notes
                                    });
                                    UI.showToast(payRes.message, 'success');
                                }

                                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                this.renderRack(container);
                            } catch (err) {
                                UI.showToast('Error al registrar cobro: ' + err.message, 'danger');
                            }
                        }
                    }
                ]
            });

            setTimeout(() => {
                const selectEl = document.getElementById('posMethodSelect');
                const detailsBox = document.getElementById('posMethodDetailsBox');
                const detailsText = document.getElementById('posMethodDetailsText');

                if (selectEl) {
                    selectEl.onchange = () => {
                        const selected = selectEl.options[selectEl.selectedIndex];
                        if (selected && selected.value) {
                            const bank = selected.getAttribute('data-bank');
                            const details = selected.getAttribute('data-details');
                            const reqval = Number(selected.getAttribute('data-reqval')) === 1;

                            detailsText.innerHTML = `<strong>${bank ? bank + ': ' : ''}</strong>${details || 'Sin detalles extra'}<br>${reqval ? '⚠️ Note: Las transferencias en esta opción quedan sujetas a aprobación por Administración.' : '✅ Pago validado automáticamente.'}`;
                            detailsBox.classList.remove('d-none');
                        } else {
                            detailsBox.classList.add('d-none');
                        }
                    };
                }
            }, 100);

        } catch (e) {
            UI.showToast('Error al preparar cobro POS: ' + e.message, 'danger');
        }
    },

    async showPaymentMethodsModal(container) {
        let methods = [];
        try {
            methods = await API.get('/payment-methods');
        } catch (e) {
            UI.showToast('Error cargando medios de pago: ' + e.message, 'danger');
            return;
        }

        const renderModalBody = () => {
            UI.showModal({
                title: '💳 Configuración de Formas y Medios de Pago del Hotel',
                bodyHtml: `
                    <div class="card border-0 bg-light p-3 mb-4 rounded-3">
                        <h6 class="fw-bold text-primary mb-2"><i class="bi bi-plus-circle-fill me-1"></i>Agregar Nueva Forma de Pago</h6>
                        <form id="formAddPaymentMethod">
                            <div class="row g-2 mb-2">
                                <div class="col-md-6">
                                    <label class="form-label small fw-semibold">Nombre del Método</label>
                                    <input type="text" class="form-control form-control-sm" id="pmName" placeholder="Ej: Transferencia BNC, Pago Móvil BDV, Zelle" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small fw-semibold">Tipo de Forma de Pago</label>
                                    <select class="form-select form-select-sm" id="pmType" required>
                                        <option value="TRANSFER">Transferencia Bancaria</option>
                                        <option value="PAGO_MOVIL">Pago Móvil Interbancario</option>
                                        <option value="CASH_USD">Efectivo Dólares (USD)</option>
                                        <option value="CASH_VES">Efectivo Bolívares (VES)</option>
                                        <option value="POS">Punto de Venta (POS)</option>
                                        <option value="ZELLE">Zelle / Transferencia USD</option>
                                        <option value="OTHER">Otro Medio</option>
                                    </select>
                                </div>
                            </div>
                            <div class="row g-2 mb-3">
                                <div class="col-md-6">
                                    <label class="form-label small fw-semibold">Banco / Entidad Financiadora</label>
                                    <input type="text" class="form-control form-control-sm" id="pmBankName" placeholder="Ej: Banco Nacional de Crédito (0191)">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label small fw-semibold">Datos de la Cuenta / Destino</label>
                                    <input type="text" class="form-control form-control-sm" id="pmAccountDetails" placeholder="RIF, N° Cuenta, Teléfono">
                                </div>
                            </div>
                            <div class="form-check form-switch mb-3">
                                <input class="form-check-input" type="checkbox" id="pmRequiresAdmin" checked>
                                <label class="form-check-label fw-semibold small" for="pmRequiresAdmin">
                                    🔒 Requiere Validación por Administración (Los pagos de Recepción quedarán en PENDING_VALIDATION hasta ser auditados)
                                </label>
                            </div>
                            <button type="button" class="btn btn-primary btn-sm w-100 fw-bold" id="btnSavePaymentMethod">
                                <i class="bi bi-save me-1"></i>Guardar Forma de Pago
                            </button>
                        </form>
                    </div>

                    <h6 class="fw-bold text-dark mb-2"><i class="bi bi-list-check me-1 text-primary"></i>Medios de Pago Habilitados (${methods.length})</h6>
                    <div class="table-responsive border rounded custom-scroll" style="max-height: 280px; overflow-y: auto;">
                        <table class="table table-sm table-hover align-middle mb-0 small">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>Forma de Pago</th>
                                    <th>Banco / Entidad</th>
                                    <th>Validación Admin</th>
                                    <th>Estado</th>
                                    <th class="text-end">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${methods.length === 0 ? `<tr><td colspan="5" class="text-center py-3 text-muted">No hay medios de pago configurados.</td></tr>` : ''}
                                ${methods.map(m => `
                                    <tr>
                                        <td>
                                            <strong class="text-dark">${m.name}</strong>
                                            <small class="d-block text-muted">${m.account_details || ''}</small>
                                        </td>
                                        <td>${m.bank_name || 'N/A'}</td>
                                        <td>
                                            ${Number(m.requires_admin_validation) === 1 
                                                ? '<span class="badge bg-warning text-dark"><i class="bi bi-shield-lock me-1"></i>Sí (Req. Admin)</span>' 
                                                : '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>No (Confirmación Directa)</span>'}
                                        </td>
                                        <td>
                                            ${Number(m.is_active) === 1 
                                                ? '<span class="badge bg-success">Activo</span>' 
                                                : '<span class="badge bg-secondary">Inactivo</span>'}
                                        </td>
                                        <td class="text-end">
                                            <button class="btn btn-sm py-1 px-2 btn-outline-primary btn-toggle-pm-val me-1" data-id="${m.id}" data-reqval="${m.requires_admin_validation}" title="Alternar requisito de aprobación admin">
                                                <i class="bi bi-sliders me-1"></i>${Number(m.requires_admin_validation) === 1 ? 'Quitar Req.' : 'Exigir Req.'}
                                            </button>
                                            <button class="btn btn-sm py-1 px-2 ${Number(m.is_active) === 1 ? 'btn-outline-warning' : 'btn-outline-success'} btn-toggle-pm-active me-1" data-id="${m.id}" data-active="${m.is_active}" title="${Number(m.is_active) === 1 ? 'Inhabilitar medio de pago' : 'Habilitar medio de pago'}">
                                                <i class="bi ${Number(m.is_active) === 1 ? 'bi-eye-slash' : 'bi-eye'} me-1"></i>${Number(m.is_active) === 1 ? 'Inhabilitar' : 'Habilitar'}
                                            </button>
                                            <button class="btn btn-sm py-1 px-2 btn-outline-danger btn-delete-pm" data-id="${m.id}" title="Eliminar medio de pago">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `,
                footerButtons: [
                    { text: 'Cerrar', class: 'btn-secondary', dismiss: true }
                ]
            });

            setTimeout(() => {
                const btnSave = document.getElementById('btnSavePaymentMethod');
                if (btnSave) {
                    btnSave.onclick = async () => {
                        const name = document.getElementById('pmName').value.trim();
                        const type = document.getElementById('pmType').value;
                        const bankName = document.getElementById('pmBankName').value.trim();
                        const accountDetails = document.getElementById('pmAccountDetails').value.trim();
                        const requiresAdminValidation = document.getElementById('pmRequiresAdmin').checked;

                        if (!name) {
                            UI.showToast('Por favor ingrese el nombre de la forma de pago.', 'warning');
                            return;
                        }

                        try {
                            await API.post('/payment-methods', { name, type, bankName, accountDetails, requiresAdminValidation });
                            UI.showToast('Forma de pago registrada.', 'success');
                            methods = await API.get('/payment-methods');
                            renderModalBody();
                        } catch (err) {
                            UI.showToast(err.message, 'danger');
                        }
                    };
                }

                document.querySelectorAll('.btn-toggle-pm-val').forEach(btn => {
                    btn.onclick = async () => {
                        const id = btn.getAttribute('data-id');
                        const curReq = Number(btn.getAttribute('data-reqval')) === 1;
                        const targetM = methods.find(m => m.id === id);
                        if (targetM) {
                            try {
                                await API.put('/payment-methods', {
                                    id,
                                    name: targetM.name,
                                    bankName: targetM.bank_name,
                                    accountDetails: targetM.account_details,
                                    requiresAdminValidation: !curReq,
                                    isActive: Number(targetM.is_active) === 1
                                });
                                UI.showToast('Requisito de validación actualizado.', 'info');
                                methods = await API.get('/payment-methods');
                                renderModalBody();
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                            }
                        }
                    };
                });

                document.querySelectorAll('.btn-toggle-pm-active').forEach(btn => {
                    btn.onclick = async () => {
                        const id = btn.getAttribute('data-id');
                        const curActive = Number(btn.getAttribute('data-active')) === 1;
                        try {
                            await API.put('/payment-methods', { id, isActive: !curActive });
                            UI.showToast(`Medio de pago ${!curActive ? 'habilitado' : 'inhabilitado'}.`, 'info');
                            methods = await API.get('/payment-methods');
                            renderModalBody();
                        } catch (err) {
                            UI.showToast(err.message, 'danger');
                        }
                    };
                });

                document.querySelectorAll('.btn-delete-pm').forEach(btn => {
                    btn.onclick = async () => {
                        const id = btn.getAttribute('data-id');
                        if (confirm('¿Está seguro de eliminar esta forma de pago?')) {
                            try {
                                await API.delete('/payment-methods?id=' + id);
                                UI.showToast('Forma de pago eliminada.', 'success');
                                methods = await API.get('/payment-methods');
                                renderModalBody();
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                            }
                        }
                    };
                });
            }, 100);
        };

        renderModalBody();
    },

    async showPaymentAuditModal(container) {
        let payments = [];
        try {
            payments = await API.get('/guest-payments?status=PENDING_VALIDATION');
        } catch (e) {
            UI.showToast('Error al cargar pagos pendientes de validación: ' + e.message, 'danger');
            return;
        }

        const renderAuditBody = () => {
            UI.showModal({
                title: '🛡️ Panel Auditoría de Pagos y Transferencias',
                bodyHtml: `
                    <div class="alert alert-warning small mb-3">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>
                        <strong>Atención Administración:</strong> Aquí se presentan las transferencias y pagos reportados por el personal de Recepción que requieren verificación en los estados de cuenta bancarios del hotel.
                    </div>

                    <div class="table-responsive border rounded custom-scroll" style="max-height: 350px; overflow-y: auto;">
                        <table class="table table-sm table-hover align-middle mb-0 small">
                            <thead class="table-light sticky-top">
                                <tr>
                                    <th>Fecha / Registro</th>
                                    <th>Hab. / Huésped</th>
                                    <th>Forma de Pago</th>
                                    <th>Ref. / Banco Origen</th>
                                    <th>Monto USD / VES</th>
                                    <th class="text-end">Acción Auditoría</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${payments.length === 0 ? `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-check-all fs-4 d-block mb-1 text-success"></i>No hay pagos pendientes por validar. ¡Todo al día!</td></tr>` : ''}
                                ${payments.map(p => `
                                    <tr>
                                        <td>
                                            <small class="fw-bold d-block">${new Date(p.created_at).toLocaleDateString('es-VE')}</small>
                                            <small class="text-muted">Por: ${p.registered_by_name || 'Recepción'}</small>
                                        </td>
                                        <td>
                                            <strong class="text-primary">Hab. ${p.room_number}</strong>
                                            <small class="d-block text-truncate" style="max-width: 130px;">${p.guest_name}</small>
                                        </td>
                                        <td><span class="badge bg-info text-dark">${p.method_name}</span></td>
                                        <td>
                                            <strong class="text-dark">${p.reference_number || 'S/N'}</strong>
                                            <small class="d-block text-muted">${p.bank_origin || 'Sin banco'}</small>
                                        </td>
                                        <td>
                                            <strong class="text-primary">$${Number(p.amount_usd).toFixed(2)} USD</strong>
                                            <small class="d-block text-success fw-bold">Bs. ${Number(p.amount_ves).toFixed(2)}</small>
                                        </td>
                                        <td class="text-end">
                                            <button class="btn btn-xs btn-success btn-validate-pay me-1" data-id="${p.id}">
                                                <i class="bi bi-check-lg me-1"></i>Validar 🟢
                                            </button>
                                            <button class="btn btn-xs btn-outline-danger btn-reject-pay" data-id="${p.id}">
                                                <i class="bi bi-x-lg me-1"></i>Rechazar 🔴
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `,
                footerButtons: [
                    { text: 'Cerrar', class: 'btn-secondary', dismiss: true }
                ]
            });

            setTimeout(() => {
                document.querySelectorAll('.btn-validate-pay').forEach(btn => {
                    btn.onclick = async () => {
                        const paymentId = btn.getAttribute('data-id');
                        try {
                            await API.put('/guest-payments', { paymentId, action: 'validate' });
                            UI.showToast('Pago validado y aprobado exitosamente 🟢', 'success');
                            payments = await API.get('/guest-payments?status=PENDING_VALIDATION');
                            renderAuditBody();
                        } catch (err) {
                            UI.showToast(err.message, 'danger');
                        }
                    };
                });

                document.querySelectorAll('.btn-reject-pay').forEach(btn => {
                    btn.onclick = async () => {
                        const paymentId = btn.getAttribute('data-id');
                        try {
                            await API.put('/guest-payments', { paymentId, action: 'reject' });
                            UI.showToast('Pago marcado como rechazado 🔴', 'warning');
                            payments = await API.get('/guest-payments?status=PENDING_VALIDATION');
                            renderAuditBody();
                        } catch (err) {
                            UI.showToast(err.message, 'danger');
                        }
                    };
                });
            }, 100);
        };

        renderAuditBody();
    },

    // 2. VISTA DE LIMPIEZA PARA MUCAMAS Y PERSONAL DE ASEO
    async renderLimpieza(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-warning" role="status"></div><p class="mt-2">Cargando Panel de Limpieza...</p></div>`;

        try {
            const data = await API.get('/rooms');
            const cleaningRooms = (data.rooms || []).filter(r => r.status === 'CLEANING');

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1 text-warning"><i class="bi bi-stars me-2"></i>Panel de Limpieza y Mucamas</h2>
                        <p class="text-muted mb-0">Gestión ágil para que el personal de servicio confirme el aseo de habitaciones</p>
                    </div>
                    <button class="btn btn-outline-secondary" onclick="window.location.hash='#habitaciones'"><i class="bi bi-arrow-left me-1"></i>Volver al Rack</button>
                </div>
            `;

            if (cleaningRooms.length === 0) {
                html += `
                    <div class="alert alert-success text-center py-5 shadow-sm rounded-4">
                        <i class="bi bi-check-circle-fill text-success display-1 d-block mb-3"></i>
                        <h3 class="fw-bold">¡Todas las habitaciones están impecables!</h3>
                        <p class="text-muted">No hay habitaciones pendientes por aseo en este momento.</p>
                    </div>
                `;
            } else {
                html += `<div class="row g-4">`;
                cleaningRooms.forEach(room => {
                    html += `
                        <div class="col-12 col-md-6 col-lg-4">
                            <div class="card border-warning shadow-sm rounded-4 h-100 p-4">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h2 class="fw-bold mb-0 text-dark">Habitación ${room.room_number}</h2>
                                    <span class="badge bg-warning text-dark fs-6"><i class="bi bi-brush me-1"></i>Pendiente Aseo</span>
                                </div>
                                <p class="text-muted mb-3"><i class="bi bi-info-circle me-1"></i>${room.notes || 'Habitación desocupada lista para aseo profundo y cambio de sábanas.'}</p>
                                <button class="btn btn-success btn-lg w-100 py-3 mt-auto btn-complete-cleaning" data-id="${room.id}">
                                    <i class="bi bi-stars fs-4 me-2"></i>MARCAR LIMPIA Y LISTA
                                </button>
                            </div>
                        </div>
                    `;
                });
                html += `</div>`;
            }

            container.innerHTML = html;

            container.querySelectorAll('.btn-complete-cleaning').forEach(btn => {
                btn.onclick = async () => {
                    const roomId = btn.getAttribute('data-id');
                    try {
                        btn.disabled = true;
                        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Confirmando...`;
                        await API.put('/rooms/status', { roomId, status: 'AVAILABLE' });
                        UI.showToast(`Habitación ${roomId} lista y disponible ✨`, 'success');
                        this.renderLimpieza(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                        btn.disabled = false;
                    }
                };
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 3. CONTROL DE RESERVAS Y HUÉSPEDES
    async renderReservas(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const bookings = await API.get('/bookings');
            const roomsData = await API.get('/rooms');
            const rooms = roomsData.rooms || [];

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-calendar-check-fill text-primary me-2"></i>Reservas & Ocupación</h2>
                        <p class="text-muted mb-0">Control de entradas, salidas y prevención de sobreventa</p>
                    </div>
                    <button class="btn btn-primary" id="btnNewBooking"><i class="bi bi-plus-lg me-1"></i>Nueva Reserva / Check-in</button>
                </div>

                <div class="card border-0 shadow-sm rounded-3">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Huésped</th>
                                        <th>Habitación</th>
                                        <th>Entrada</th>
                                        <th>Salida</th>
                                        <th>Monto Total</th>
                                        <th>Depósito</th>
                                        <th>Estado</th>
                                        <th class="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            if (bookings.length === 0) {
                html += `<tr><td colspan="8" class="text-center py-4 text-muted">No hay reservaciones registradas.</td></tr>`;
            } else {
                bookings.forEach(b => {
                    const statusBadge = b.status === 'CHECKED_IN' ? '<span class="badge bg-success">Ocupada (In)</span>' :
                                        b.status === 'RESERVED' ? '<span class="badge bg-primary">Reservada</span>' :
                                        b.status === 'CHECKED_OUT' ? '<span class="badge bg-secondary">Check-out (Out)</span>' : '<span class="badge bg-danger">Cancelada</span>';

                    html += `
                        <tr>
                            <td>
                                <strong>${b.guest_name}</strong>
                                <div class="small text-muted">${b.document_type}-${b.document_id} | ${b.guest_phone || 'Sin telf'}</div>
                            </td>
                            <td>
                                <strong>Hab. ${b.room_number}</strong>
                                <div class="small text-muted">${b.room_type_name}</div>
                            </td>
                            <td>${b.check_in_date}</td>
                            <td>${b.check_out_date}</td>
                            <td class="fw-bold text-primary">$${Number(b.total_amount_usd).toFixed(2)} USD</td>
                            <td>$${Number(b.deposit_usd || 0).toFixed(2)} USD</td>
                            <td>${statusBadge}</td>
                            <td class="text-end">
                                ${b.status === 'CHECKED_IN' ? `
                                    <button class="btn btn-sm btn-outline-danger btn-checkout" data-id="${b.id}">
                                        <i class="bi bi-door-closed me-1"></i>Check-out
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

            // New Booking Modal
            const btnNewBooking = container.querySelector('#btnNewBooking');
            if (btnNewBooking) {
                btnNewBooking.onclick = () => this.showNewBookingModal(container, rooms);
            }

            // Checkout Buttons
            container.querySelectorAll('.btn-checkout').forEach(btn => {
                btn.onclick = () => {
                    const bookingId = btn.getAttribute('data-id');
                    UI.confirm({
                        title: 'Procesar Check-out de la Habitación',
                        message: '¿Está seguro de procesar la salida del huésped? La habitación pasará automáticamente a estado EN LIMPIEZA para el personal de aseo.',
                        confirmText: 'Procesar Check-out',
                        confirmBtnClass: 'btn-danger',
                        onConfirm: async () => {
                            try {
                                const result = await API.post('/bookings/checkout', { bookingId });
                                UI.showToast(result.message, 'success');
                                this.renderReservas(container);
                            } catch (e) {
                                UI.showToast(e.message, 'danger');
                            }
                        }
                    });
                };
            });
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    showNewBookingModal(container, rooms) {
        const availableRooms = rooms.filter(r => r.status === 'AVAILABLE');
        let roomOpts = availableRooms.map(r => `<option value="${r.id}" data-price="${r.base_price_usd}">Hab. ${r.room_number} (${r.room_type_name} - $${r.base_price_usd}/noche)</option>`).join('');

        UI.showModal({
            title: 'Registrar Nueva Reserva / Check-in Directo',
            bodyHtml: `
                <form id="formBooking">
                    <h6 class="fw-bold text-primary mb-3">1. Datos del Huésped</h6>
                    <div class="row g-2 mb-3">
                        <div class="col-4">
                            <label class="form-label">Doc.</label>
                            <select class="form-select" id="bkDocType">
                                <option value="V">V (Venezolano)</option>
                                <option value="E">E (Extranjero)</option>
                                <option value="J">J (Jurídico)</option>
                                <option value="G">G (Gobierno)</option>
                                <option value="PASSPORT">Pasaporte</option>
                            </select>
                        </div>
                        <div class="col-8">
                            <label class="form-label">N° Cédula / Pasaporte</label>
                            <input type="text" class="form-control" id="bkDocId" required placeholder="12345678">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Nombre Completo del Huésped</label>
                        <input type="text" class="form-control" id="bkGuestName" required placeholder="Ej: Carlos Mendoza">
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label">Teléfono / WhatsApp</label>
                            <input type="text" class="form-control" id="bkGuestPhone" placeholder="0414-1234567">
                        </div>
                        <div class="col-6">
                            <label class="form-label">Ciudad de Origen</label>
                            <input type="text" class="form-control" id="bkGuestOrigin" placeholder="Caracas, Valencia...">
                        </div>
                    </div>

                    <h6 class="fw-bold text-primary mb-3">2. Asignación de Habitación y Fechas</h6>
                    <div class="mb-3">
                        <label class="form-label">Habitación Disponible</label>
                        <select class="form-select" id="bkRoomId" required>
                            <option value="">Seleccione habitación...</option>
                            ${roomOpts}
                        </select>
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label">Fecha de Entrada</label>
                            <input type="date" class="form-control" id="bkCheckIn" value="${new Date().toISOString().split('T')[0]}" required>
                        </div>
                        <div class="col-6">
                            <label class="form-label">Fecha de Salida</label>
                            <input type="date" class="form-control" id="bkCheckOut" value="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}" required>
                        </div>
                    </div>
                    <div class="row g-2 mb-3">
                        <div class="col-6">
                            <label class="form-label">Total Estancia ($USD)</label>
                            <input type="number" step="0.01" class="form-control" id="bkTotalAmount" required placeholder="0.00">
                        </div>
                        <div class="col-6">
                            <label class="form-label">Abono / Depósito ($USD)</label>
                            <input type="number" step="0.01" class="form-control" id="bkDeposit" value="0.00">
                        </div>
                    </div>
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" id="bkImmediateCheckIn" checked>
                        <label class="form-check-label fw-bold" for="bkImmediateCheckIn">
                            Check-in Inmediato (Ocupar habitación hoy)
                        </label>
                    </div>
                </form>
            `,
            footerHtml: `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" id="btnSaveBooking">Confirmar Reserva</button>
            `
        });

        // Recalculate price on selection
        const roomSelect = document.getElementById('bkRoomId');
        const checkInInp = document.getElementById('bkCheckIn');
        const checkOutInp = document.getElementById('bkCheckOut');
        const totalInp = document.getElementById('bkTotalAmount');

        const updatePrice = () => {
            const opt = roomSelect.options[roomSelect.selectedIndex];
            if (!opt || !opt.dataset.price) return;
            const basePrice = parseFloat(opt.dataset.price);
            const inDate = new Date(checkInInp.value);
            const outDate = new Date(checkOutInp.value);
            const nights = Math.max(1, Math.round((outDate - inDate) / (1000 * 60 * 60 * 24)));
            totalInp.value = (basePrice * nights).toFixed(2);
        };

        roomSelect.onchange = updatePrice;
        checkInInp.onchange = updatePrice;
        checkOutInp.onchange = updatePrice;

        document.getElementById('btnSaveBooking').onclick = async () => {
            const fullName = document.getElementById('bkGuestName').value;
            const documentType = document.getElementById('bkDocType').value;
            const documentId = document.getElementById('bkDocId').value;
            const phone = document.getElementById('bkGuestPhone').value;
            const originCity = document.getElementById('bkGuestOrigin').value;

            const roomId = roomSelect.value;
            const checkInDate = checkInInp.value;
            const checkOutDate = checkOutInp.value;
            const totalAmountUsd = totalInp.value;
            const depositUsd = document.getElementById('bkDeposit').value;
            const isCheckInImmediate = document.getElementById('bkImmediateCheckIn').checked;

            if (!fullName || !documentId || !roomId || !checkInDate || !checkOutDate) {
                UI.showToast('Por favor complete los campos requeridos.', 'warning');
                return;
            }

            try {
                // 1. Create or get guest
                const guestRes = await API.post('/guests', { fullName, documentType, documentId, phone, originCity });
                const guestId = guestRes.guest.id;

                // 2. Create Booking
                const bookingRes = await API.post('/bookings', {
                    roomId,
                    guestId,
                    checkInDate,
                    checkOutDate,
                    totalAmountUsd,
                    depositUsd,
                    isCheckInImmediate
                });

                UI.showToast(bookingRes.message, 'success');
                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                this.renderReservas(container);
            } catch (e) {
                UI.showToast(e.message, 'danger');
            }
        };
    },

    // 4. CONSUMOS Y CARGOS A LA HABITACIÓN
    async renderConsumos(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const expenses = await API.get('/expenses');
            const bookings = await API.get('/bookings?status=CHECKED_IN');
            const deptsData = await API.get('/departments');
            const depts = deptsData.departments || [];

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-receipt text-primary me-2"></i>Consumos y Cargos Extras</h2>
                        <p class="text-muted mb-0">Registro de restaurant, bar, lavandería y excursiones cargados a habitaciones</p>
                    </div>
                    <button class="btn btn-primary" id="btnAddExpense"><i class="bi bi-plus-lg me-1"></i>Cargar Consumo a Habitación</button>
                </div>

                <div class="card border-0 shadow-sm rounded-3">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>Habitación</th>
                                        <th>Huésped</th>
                                        <th>Área / Departamento</th>
                                        <th>Descripción Consumo</th>
                                        <th>Monto ($USD)</th>
                                        <th>Fecha / Hora</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            if (expenses.length === 0) {
                html += `<tr><td colspan="6" class="text-center py-4 text-muted">No se han registrado consumos extras aún.</td></tr>`;
            } else {
                expenses.forEach(e => {
                    html += `
                        <tr>
                            <td><strong>Hab. ${e.room_number}</strong></td>
                            <td>${e.guest_name}</td>
                            <td><span class="badge bg-info text-dark">${e.department_name || 'General'}</span></td>
                            <td>${e.description}</td>
                            <td class="fw-bold text-success">$${Number(e.amount_usd).toFixed(2)} USD</td>
                            <td class="small text-muted">${new Date(e.created_at).toLocaleString('es-VE')}</td>
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

            const btnAddExpense = container.querySelector('#btnAddExpense');
            if (btnAddExpense) {
                btnAddExpense.onclick = () => {
                    let bookingOpts = bookings.map(b => `<option value="${b.id}">Hab. ${b.room_number} - ${b.guest_name}</option>`).join('');
                    let deptOpts = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

                    if (bookings.length === 0) {
                        UI.showToast('No hay habitaciones ocupadas (CHECKED_IN) para cargar consumos.', 'warning');
                        return;
                    }

                    UI.showModal({
                        title: 'Cargar Consumo Extra a Habitación',
                        bodyHtml: `
                            <form id="formExpense">
                                <div class="mb-3">
                                    <label class="form-label">Habitación / Huésped Ocupante</label>
                                    <select class="form-select" id="expBookingId" required>
                                        ${bookingOpts}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Departamento Emisor del Consumo</label>
                                    <select class="form-select" id="expDeptId">
                                        <option value="">Servicio General / Recepción</option>
                                        ${deptOpts}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Descripción del Consumo</label>
                                    <input type="text" class="form-control" id="expDesc" required placeholder="Ej: Almuerzo Mariscada + 2 Refrescos, Servicio Lavandería">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Monto ($USD)</label>
                                    <input type="number" step="0.01" class="form-control" id="expAmount" required placeholder="15.50">
                                </div>
                            </form>
                        `,
                        footerHtml: `
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="btnSaveExpense">Registrar Consumo</button>
                        `
                    });

                    document.getElementById('btnSaveExpense').onclick = async () => {
                        const bookingId = document.getElementById('expBookingId').value;
                        const departmentId = document.getElementById('expDeptId').value;
                        const description = document.getElementById('expDesc').value;
                        const amountUsd = document.getElementById('expAmount').value;

                        if (!bookingId || !description || !amountUsd) {
                            UI.showToast('Todos los campos obligatorios deben completarse.', 'warning');
                            return;
                        }

                        try {
                            await API.post('/expenses', { bookingId, departmentId, description, amountUsd });
                            UI.showToast('Consumo cargado exitosamente a la habitación.', 'success');
                            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                            this.renderConsumos(container);
                        } catch (e) {
                            UI.showToast(e.message, 'danger');
                        }
                    };
                };
            }
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 5. FACTURACIÓN E IMPRESIÓN PDF CON TASA BCV Y GESTIÓN DE CRÉDITOS
    async renderFacturacion(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Cargando Facturación e Historial...</p></div>`;

        try {
            const invoices = await API.get('/billing/invoices');
            const hotel = State.getHotel();

            const invoicesMap = {};
            invoices.forEach(inv => { invoicesMap[inv.id] = inv; });

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-file-earmark-pdf-fill text-primary me-2"></i>Facturación e Historial de Comprobantes</h2>
                        <p class="text-muted mb-0">Gestión de recibos, emisión de PDF a Tasa BCV y control de líneas de crédito</p>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-4">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>N° Factura</th>
                                        <th>Huésped</th>
                                        <th>Habitación</th>
                                        <th>Total USD</th>
                                        <th>Total VES (BCV)</th>
                                        <th>Condición / Estado</th>
                                        <th>Fecha</th>
                                        <th class="text-end">Acciones / Comprobante</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            const canManageInvoices = State.isHotelAdmin() || State.isSuperAdmin() || State.hasDepartmentPermission('FACTURACION_ADMIN');

            if (invoices.length === 0) {
                html += `<tr><td colspan="8" class="text-center py-4 text-muted">No hay facturas emitidas aún. Realice un Check-out para generar un comprobante.</td></tr>`;
            } else {
                invoices.forEach(inv => {
                    const st = inv.payment_status || 'PAID';
                    const statusBadge = st === 'PAID' ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>PAGADO</span>` :
                                        st === 'CREDIT' ? `<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>CRÉDITO PENDIENTE</span>` :
                                        st === 'VOIDED' ? `<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>ANULADA</span>` :
                                        `<span class="badge bg-purple text-white"><i class="bi bi-arrow-return-left me-1"></i>DEVOLUCIÓN</span>`;

                    html += `
                        <tr class="${st === 'VOIDED' ? 'table-secondary opacity-75' : ''}">
                            <td><strong class="text-primary">${inv.invoice_number}</strong></td>
                            <td>${inv.guest_name}</td>
                            <td>Hab. ${inv.room_number}</td>
                            <td class="fw-bold">$${Number(inv.total_usd).toFixed(2)} USD</td>
                            <td class="fw-bold text-success">Bs. ${Number(inv.total_ves).toFixed(2)} <small class="text-muted font-monospace">(tasa ${Number(inv.bcv_rate).toFixed(2)})</small></td>
                            <td>${statusBadge}</td>
                            <td class="small text-muted">${new Date(inv.created_at).toLocaleDateString('es-VE')}</td>
                            <td class="text-end">
                                <div class="btn-group btn-group-sm">
                                    <button class="btn btn-outline-primary btn-download-pdf" data-id="${inv.id}">
                                        <i class="bi bi-file-earmark-pdf me-1"></i>PDF
                                    </button>
                                    ${st === 'CREDIT' && canManageInvoices ? `
                                        <button class="btn btn-success btn-pay-invoice" data-id="${inv.id}">
                                            <i class="bi bi-cash me-1"></i>Liquidar
                                        </button>
                                    ` : ''}
                                    ${canManageInvoices ? `
                                        <div class="dropdown d-inline-block">
                                            <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                                Acciones
                                            </button>
                                            <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                                                ${st !== 'VOIDED' ? `
                                                    <li><button class="dropdown-item text-warning btn-void-invoice" data-id="${inv.id}"><i class="bi bi-slash-circle me-2"></i>Anular Factura</button></li>
                                                ` : ''}
                                                ${st !== 'REFUNDED' && st !== 'VOIDED' ? `
                                                    <li><button class="dropdown-item text-purple btn-refund-invoice" data-id="${inv.id}"><i class="bi bi-arrow-return-left me-2"></i>Procesar Devolución</button></li>
                                                ` : ''}
                                                <li><hr class="dropdown-divider"></li>
                                                <li><button class="dropdown-item text-danger btn-delete-invoice" data-id="${inv.id}"><i class="bi bi-trash me-2"></i>Eliminar Factura</button></li>
                                            </ul>
                                        </div>
                                    ` : ''}
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

            // Bind PDF download buttons
            container.querySelectorAll('.btn-download-pdf').forEach(btn => {
                btn.onclick = async () => {
                    const invId = btn.getAttribute('data-id');
                    const inv = invoicesMap[invId];
                    if (!inv) return;

                    try {
                        btn.disabled = true;
                        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>Generando...`;

                        let expenses = [];
                        try {
                            expenses = await API.get(`/expenses?bookingId=${inv.booking_id}`);
                        } catch (e) {}

                        const booking = {
                            guest_name: inv.guest_name,
                            document_type: inv.document_type || 'V',
                            document_id: inv.document_id || '',
                            room_number: inv.room_number || '',
                            room_type_name: inv.room_type_name || 'Estándar',
                            check_in_date: inv.check_in_date || 'N/A',
                            check_out_date: inv.check_out_date || 'N/A'
                        };

                        await PDFService.generateInvoicePDF(hotel || { name: 'Hotel' }, booking, inv, expenses);
                        UI.showToast('PDF Comprobante generado correctamente 📄', 'success');
                    } catch (err) {
                        UI.showToast('Error al generar PDF: ' + err.message, 'danger');
                    } finally {
                        btn.disabled = false;
                        btn.innerHTML = `<i class="bi bi-file-earmark-pdf me-1"></i>PDF`;
                    }
                };
            });

            // Bind Liquidate Payment for Credit Invoices
            container.querySelectorAll('.btn-pay-invoice').forEach(btn => {
                btn.onclick = async () => {
                    const invId = btn.getAttribute('data-id');
                    const inv = invoicesMap[invId];
                    if (!inv) return;

                    UI.showModal({
                        title: '💳 Liquidar Factura con Línea de Crédito',
                        bodyHtml: `
                            <p><strong>Factura:</strong> ${inv.invoice_number}</p>
                            <p><strong>Huésped:</strong> ${inv.guest_name}</p>
                            <p class="fs-5 fw-bold text-primary">Monto Total: $${Number(inv.total_usd).toFixed(2)} USD (Bs. ${Number(inv.total_ves).toFixed(2)})</p>
                            <div class="mb-3">
                                <label class="form-label small fw-semibold">Notas / Observación del Pago</label>
                                <input type="text" class="form-control" id="payInvNotes" placeholder="Ej: Pago total recibido por transferencia BNC">
                            </div>
                        `,
                        footerButtons: [
                            { text: 'Cancelar', class: 'btn-secondary', dismiss: true },
                            {
                                text: 'Marcar Factura como PAGADA 🟢',
                                class: 'btn-success fw-bold',
                                onClick: async () => {
                                    const notes = document.getElementById('payInvNotes').value;
                                    try {
                                        await API.put('/billing/invoices', { invoiceId: inv.id, paymentStatus: 'PAID', notes });
                                        UI.showToast('Factura marcada como PAGADA exitosamente 🟢', 'success');
                                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                        this.renderFacturacion(container);
                                    } catch (err) {
                                        UI.showToast(err.message, 'danger');
                                    }
                                }
                            }
                        ]
                    });
                };
            });

            // Bind Anular / Void Invoice
            container.querySelectorAll('.btn-void-invoice').forEach(btn => {
                btn.onclick = () => {
                    const invId = btn.getAttribute('data-id');
                    const inv = invoicesMap[invId];
                    if (!inv) return;

                    UI.showModal({
                        title: '⚠️ Anular Factura',
                        bodyHtml: `
                            <p>¿Está seguro de anular la factura <strong>${inv.invoice_number}</strong> de <strong>${inv.guest_name}</strong>?</p>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Motivo de Anulación</label>
                                <input type="text" class="form-control" id="voidInvNotes" placeholder="Ej: Error en datos de emisión, cancelación de estadía">
                            </div>
                        `,
                        footerButtons: [
                            { text: 'Cancelar', class: 'btn-secondary', dismiss: true },
                            {
                                text: 'Confirmar Anulación 🔴',
                                class: 'btn-danger fw-bold',
                                onClick: async () => {
                                    const notes = document.getElementById('voidInvNotes').value;
                                    try {
                                        await API.put('/billing/invoices', { invoiceId: inv.id, paymentStatus: 'VOIDED', notes });
                                        UI.showToast('Factura anulada correctamente.', 'warning');
                                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                        this.renderFacturacion(container);
                                    } catch (err) {
                                        UI.showToast(err.message, 'danger');
                                    }
                                }
                            }
                        ]
                    });
                };
            });

            // Bind Devolución / Refund Invoice
            container.querySelectorAll('.btn-refund-invoice').forEach(btn => {
                btn.onclick = () => {
                    const invId = btn.getAttribute('data-id');
                    const inv = invoicesMap[invId];
                    if (!inv) return;

                    UI.showModal({
                        title: '🟣 Procesar Devolución / Nota de Crédito',
                        bodyHtml: `
                            <p><strong>Factura:</strong> ${inv.invoice_number}</p>
                            <p><strong>Huésped:</strong> ${inv.guest_name}</p>
                            <p class="fs-5 fw-bold text-purple">Monto a Devolver: $${Number(inv.total_usd).toFixed(2)} USD</p>
                            <div class="mb-3">
                                <label class="form-label small fw-bold">Detalle / Motivo de Devolución</label>
                                <input type="text" class="form-control" id="refundInvNotes" placeholder="Ej: Reembolso acordado por desocupación anticipada">
                            </div>
                        `,
                        footerButtons: [
                            { text: 'Cancelar', class: 'btn-secondary', dismiss: true },
                            {
                                text: 'Emitir Devolución 🟣',
                                class: 'btn-primary fw-bold',
                                onClick: async () => {
                                    const notes = document.getElementById('refundInvNotes').value;
                                    try {
                                        await API.put('/billing/invoices', { invoiceId: inv.id, paymentStatus: 'REFUNDED', notes });
                                        UI.showToast('Devolución registrada exitosamente.', 'info');
                                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                        this.renderFacturacion(container);
                                    } catch (err) {
                                        UI.showToast(err.message, 'danger');
                                    }
                                }
                            }
                        ]
                    });
                };
            });

            // Bind Delete Invoice
            container.querySelectorAll('.btn-delete-invoice').forEach(btn => {
                btn.onclick = () => {
                    const invId = btn.getAttribute('data-id');
                    const inv = invoicesMap[invId];
                    if (!inv) return;

                    UI.showModal({
                        title: '🗑️ Eliminar Factura Permanentemente',
                        bodyHtml: `<p class="text-danger fw-bold">Esta acción eliminará el registro de la factura ${inv.invoice_number} de forma irreversible. ¿Desea continuar?</p>`,
                        footerButtons: [
                            { text: 'Cancelar', class: 'btn-secondary', dismiss: true },
                            {
                                text: 'Eliminar Factura 🗑️',
                                class: 'btn-danger fw-bold',
                                onClick: async () => {
                                    try {
                                        await API.delete(`/billing/invoices?id=${inv.id}`);
                                        UI.showToast('Factura eliminada.', 'info');
                                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                        this.renderFacturacion(container);
                                    } catch (err) {
                                        UI.showToast(err.message, 'danger');
                                    }
                                }
                            }
                        ]
                    });
                };
            });

        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 6. ÁREAS INTERNAS Y GESTIÓN DE PERSONAL (STAFF)
    async renderAreas(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const data = await API.get('/departments');
            let depts = data.departments || [];
            let staff = data.staff || [];

            let deptOptsHtml = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-building-gear text-primary me-2"></i>Áreas Internas & Personal</h2>
                        <p class="text-muted mb-0">Gestión de departamentos y personal autorizado con búsqueda rápida</p>
                    </div>
                    <div class="d-flex gap-2 flex-wrap">
                        <button class="btn btn-outline-success shadow-sm fw-bold" id="btnGlobalBulkCsv"><i class="bi bi-file-earmark-spreadsheet-fill me-1"></i>Carga Masiva POS (CSV Global)</button>
                        <button class="btn btn-outline-primary shadow-sm" id="btnCreateDept"><i class="bi bi-plus-lg me-1"></i>Activar Nueva Área</button>
                        <button class="btn btn-primary shadow-sm" id="btnCreateStaff"><i class="bi bi-person-plus-fill me-1"></i>Crear Usuario Personal</button>
                    </div>
                </div>

                <div class="row g-4">
                    <!-- COLUMNA IZQUIERDA: DEPARTAMENTOS -->
                    <div class="col-lg-5">
                        <div class="card border-0 shadow-sm rounded-3 h-100">
                            <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                                <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-diagram-3-fill me-2 text-primary"></i>Áreas / Departamentos</h5>
                                <span class="badge bg-primary rounded-pill fs-7" id="deptCountBadge">${depts.length} áreas</span>
                            </div>
                            <div class="card-body pt-0">
                                <div class="input-group mb-3">
                                    <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control bg-light border-start-0" id="searchDeptInput" placeholder="Buscar área por nombre o tipo...">
                                </div>
                                <div class="list-group list-group-flush custom-scroll" id="deptListContainer" style="max-height: 520px; overflow-y: auto;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- COLUMNA DERECHA: PERSONAL (STAFF) -->
                    <div class="col-lg-7">
                        <div class="card border-0 shadow-sm rounded-3 h-100">
                            <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <h5 class="fw-bold mb-0 text-dark"><i class="bi bg-people-fill me-2 text-primary"></i>Personal Autorizado (Staff)</h5>
                                <span class="badge bg-secondary rounded-pill fs-7" id="staffCountBadge">Mostrando ${staff.length} de ${staff.length}</span>
                            </div>
                            <div class="card-body pt-0">
                                <div class="row g-2 mb-3">
                                    <div class="col-md-7">
                                        <div class="input-group">
                                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-search text-muted"></i></span>
                                            <input type="text" class="form-control bg-light border-start-0" id="searchStaffInput" placeholder="Buscar por nombre, correo o teléfono...">
                                        </div>
                                    </div>
                                    <div class="col-md-5">
                                        <select class="form-select bg-light" id="filterStaffDept">
                                            <option value="">Todas las Áreas</option>
                                            ${deptOptsHtml}
                                        </select>
                                    </div>
                                </div>
                                <div class="list-group list-group-flush custom-scroll" id="staffListContainer" style="max-height: 520px; overflow-y: auto;">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Global Bulk CSV Modal Handler
            const btnGlobalCsv = container.querySelector('#btnGlobalBulkCsv');
            if (btnGlobalCsv) {
                btnGlobalCsv.onclick = () => {
                    UI.showModal({
                        title: 'Carga Masiva Global de Productos y Servicios POS',
                        bodyHtml: `
                            <div class="card border-0 bg-light p-3 mb-3 rounded-3">
                                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                                    <div>
                                        <h6 class="fw-bold mb-1 text-dark"><i class="bi bi-download text-success me-1"></i>Paso 1: Descarga la plantilla CSV Global</h6>
                                        <p class="small text-muted mb-0">Alimenta todos los POS del hotel desde un solo archivo (Headers: <code>departamento, nombre, descripcion, precio_usd</code>)</p>
                                    </div>
                                    <button type="button" class="btn btn-sm btn-outline-success fw-bold" id="btnDownloadGlobalCsv"><i class="bi bi-file-earmark-arrow-down me-1"></i>Descargar Plantilla Global</button>
                                </div>
                                <div class="small bg-white p-2 rounded border mb-2 text-muted">
                                    <strong>Departamentos válidos:</strong> RESTAURANTE, BAR, SPA, PELUQUERIA, GALERIA, GUIA_TURISTICA, TAXIS, LANCHAS, TINTORERIA, ZAPATERIA, MANICURISTA, PEDICURISTA, TECNOLOGIA, ALQUILER_ESPACIOS, ALQUILER_EQUIPOS, GIMNASIO, PADEL, GUARDERIA, CINE, PISCINA, PLAYA, GOLF, LENCERIA, TENIS, SURF, CABALLOS, CUATRIMOTOS, HELADERIA, BODEGON, TIENDA, BUCEO, PARAPENTE, PESCA, VEHICULOS, EVENTOS, HOUSEKEEPING.
                                </div>
                                <hr class="my-2">
                                <div>
                                    <h6 class="fw-bold mb-1 text-dark"><i class="bi bi-upload text-primary me-1"></i>Paso 2: Selecciona tu archivo CSV editado</h6>
                                    <input type="file" class="form-control form-control-sm mt-1" id="globalCsvFileInput" accept=".csv,text/csv">
                                </div>
                            </div>

                            <div id="globalCsvPreviewSection" style="display: none;">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-eye me-1 text-primary"></i>Previsualización en Vivo</h6>
                                    <span id="globalCsvParsedCountBadge" class="badge bg-primary">0 ítems</span>
                                </div>
                                <div class="table-responsive border rounded custom-scroll" style="max-height: 250px; overflow-y: auto;">
                                    <table class="table table-sm table-hover align-middle mb-0 small">
                                        <thead class="table-light sticky-top">
                                            <tr>
                                                <th>#</th>
                                                <th>Departamento POS</th>
                                                <th>Nombre</th>
                                                <th>Descripción</th>
                                                <th>Precio ($USD)</th>
                                                <th>Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody id="globalCsvPreviewTbody"></tbody>
                                    </table>
                                </div>
                                <button type="button" class="btn btn-success w-100 py-2 shadow-sm mt-3" id="btnUploadGlobalBulk" disabled><i class="bi bi-cloud-arrow-up-fill me-1"></i>Confirmar y Cargar Catálogo POS Global</button>
                            </div>
                        `,
                        footerHtml: `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`
                    });

                    // Download Global CSV template
                    const btnDlGlobal = document.getElementById('btnDownloadGlobalCsv');
                    if (btnDlGlobal) {
                        btnDlGlobal.onclick = () => {
                            const sampleCsv = `departamento,nombre,descripcion,precio_usd\nRESTAURANTE,"Pabellón Criollo Especial","Arroz, carne mechada, caraotas y tajadas",12.00\nBAR,"Mojito Cubano Tradicional","Ron blanco, menta y limón",6.00\nSPA,"Masaje Relajante Corporal","Terapia 45 minutos",35.00\nTAXIS,"Traslado Aeropuerto","Vehículo con aire acondicionado",25.00\nLANCHAS,"Paseo a Cayos","Traslado en peñero ida y vuelta",25.00\n`;
                            CSVUtil.downloadTemplate(`plantilla_catalogo_global_pos.csv`, sampleCsv);
                        };
                    }

                    // Global CSV parsing & live preview
                    const globalCsvInput = document.getElementById('globalCsvFileInput');
                    const globalPreviewSec = document.getElementById('globalCsvPreviewSection');
                    const globalTbody = document.getElementById('globalCsvPreviewTbody');
                    const globalCountBadge = document.getElementById('globalCsvParsedCountBadge');
                    const btnUploadGlobal = document.getElementById('btnUploadGlobalBulk');

                    let currentGlobalItems = [];

                    if (globalCsvInput) {
                        globalCsvInput.onchange = (evt) => {
                            const file = evt.target.files[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const text = e.target.result;
                                currentGlobalItems = CSVUtil.parse(text);

                                if (currentGlobalItems.length === 0) {
                                    UI.showToast('El archivo CSV está vacío o no tiene el formato correcto.', 'warning');
                                    globalPreviewSec.style.display = 'none';
                                    if (btnUploadGlobal) btnUploadGlobal.disabled = true;
                                    return;
                                }

                                const validItems = currentGlobalItems.filter(x => x.isValid && x.departmentType);
                                if (globalCountBadge) globalCountBadge.textContent = `${validItems.length} de ${currentGlobalItems.length} ítems válidos`;

                                if (globalTbody) {
                                    globalTbody.innerHTML = currentGlobalItems.map((item, idx) => `
                                        <tr class="${item.isValid && item.departmentType ? '' : 'table-danger'}">
                                            <td>${idx + 1}</td>
                                            <td><span class="badge bg-secondary-subtle text-secondary border">${item.departmentType || 'RESTAURANTE'}</span></td>
                                            <td class="fw-bold">${item.name || '<span class="text-danger">Falta nombre</span>'}</td>
                                            <td class="text-muted small">${item.description || '-'}</td>
                                            <td class="fw-bold text-primary">$${Number(item.priceUsd || 0).toFixed(2)}</td>
                                            <td>
                                                ${item.isValid && item.departmentType ? 
                                                    `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle me-1"></i>Listo</span>` :
                                                    `<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-x-circle me-1"></i>Inválido</span>`
                                                }
                                            </td>
                                        </tr>
                                    `).join('');
                                }

                                if (globalPreviewSec) globalPreviewSec.style.display = 'block';
                                if (btnUploadGlobal) btnUploadGlobal.disabled = validItems.length === 0;
                            };
                            reader.readAsText(file);
                        };
                    }

                    // Bulk Global upload handler
                    if (btnUploadGlobal) {
                        btnUploadGlobal.onclick = async () => {
                            const validItems = currentGlobalItems.filter(x => x.isValid && x.departmentType);
                            if (validItems.length === 0) return;

                            try {
                                btnUploadGlobal.disabled = true;
                                btnUploadGlobal.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Cargando productos al sistema...';

                                const res = await API.post('/catalog/bulk', { items: validItems });
                                UI.showToast(res.message || 'Carga global completada exitosamente.', 'success');

                                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                this.renderAreas(container);
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                                btnUploadGlobal.disabled = false;
                                btnUploadGlobal.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i>Confirmar y Cargar Catálogo POS Global';
                            }
                        };
                    }
                };
            }

            const deptListContainer = container.querySelector('#deptListContainer');
            const staffListContainer = container.querySelector('#staffListContainer');
            const searchDeptInput = container.querySelector('#searchDeptInput');
            const searchStaffInput = container.querySelector('#searchStaffInput');
            const filterStaffDept = container.querySelector('#filterStaffDept');
            const deptCountBadge = container.querySelector('#deptCountBadge');
            const staffCountBadge = container.querySelector('#staffCountBadge');

            // Render Departments List
            const renderDeptList = (filteredDepts) => {
                deptCountBadge.textContent = `${filteredDepts.length} área${filteredDepts.length !== 1 ? 's' : ''}`;
                if (filteredDepts.length === 0) {
                    deptListContainer.innerHTML = `
                        <div class="text-center py-4 text-muted">
                            <i class="bi bi-search fs-2 d-block mb-1"></i>
                            <small>No se encontraron áreas coincidentes.</small>
                        </div>
                    `;
                    return;
                }

                deptListContainer.innerHTML = filteredDepts.map(d => `
                    <div class="list-group-item d-flex justify-content-between align-items-center px-2 py-3 border-bottom">
                        <div>
                            <div class="fw-bold text-dark mb-1">${d.name}</div>
                            <span class="badge bg-light text-dark border me-1">${d.type || 'OTHER'}</span>
                            <span class="badge ${d.is_active !== 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}">${d.is_active !== 0 ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary btn-edit-dept px-2" data-id="${d.id}" title="Editar área">
                            <i class="bi bi-pencil-fill me-1"></i>Editar
                        </button>
                    </div>
                `).join('');

                // Bind click events for department edits
                deptListContainer.querySelectorAll('.btn-edit-dept').forEach(btn => {
                    btn.onclick = () => {
                        const dId = btn.dataset.id;
                        const targetDept = depts.find(x => x.id === dId);
                        if (targetDept) this.showEditDeptModal(container, targetDept);
                    };
                });
            };

            // Render Staff List
            const renderStaffList = (filteredStaff) => {
                staffCountBadge.textContent = `Mostrando ${filteredStaff.length} de ${staff.length}`;
                if (filteredStaff.length === 0) {
                    staffListContainer.innerHTML = `
                        <div class="text-center py-4 text-muted">
                            <i class="bi bi-person-x fs-2 d-block mb-1"></i>
                            <small>No se encontró personal con los filtros aplicados.</small>
                        </div>
                    `;
                    return;
                }

                staffListContainer.innerHTML = filteredStaff.map(s => {
                    const userPerms = s.permissions || [];
                    const isStaffAdmin = s.role === 'HOTEL_ADMIN' || userPerms.includes('SUBSCRIPCION') || userPerms.includes('FACTURACION_ADMIN');
                    const roleBadge = isStaffAdmin 
                        ? '<span class="badge bg-purple text-white me-1 mb-1"><i class="bi bi-shield-lock me-1"></i>STAFF ADMINISTRATIVO</span>' 
                        : '<span class="badge bg-secondary text-light me-1 mb-1"><i class="bi bi-person-badge me-1"></i>STAFF HOTEL</span>';

                    const permBadges = userPerms.map(p => {
                        if (p === 'SUBSCRIPCION') return '<span class="badge bg-warning text-dark border border-warning me-1 mb-1"><i class="bi bi-star-fill me-1"></i>Membresía / Suscripción</span>';
                        if (p === 'FACTURACION_ADMIN') return '<span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1 mb-1"><i class="bi bi-receipt-cutoff me-1"></i>Anulación/Devolución Facturas</span>';
                        return `<span class="badge bg-primary-subtle text-primary border border-primary-subtle fs-8 me-1 mb-1">${p}</span>`;
                    }).join('');

                    return `
                        <div class="list-group-item d-flex justify-content-between align-items-center px-2 py-3 border-bottom">
                            <div class="d-flex align-items-center gap-3">
                                <div class="avatar-circle ${isStaffAdmin ? 'bg-purple text-white' : 'bg-primary-subtle text-primary'} fw-bold rounded-circle d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; font-size: 1.1rem;">
                                    ${(s.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div class="fw-bold text-dark mb-0">${s.name} ${roleBadge}</div>
                                    <div class="small text-muted mb-1">
                                        <i class="bi bi-envelope me-1"></i>${s.email}
                                        ${s.phone ? `<span class="ms-2"><i class="bi bi-whatsapp me-1 text-success"></i>${s.phone}</span>` : ''}
                                    </div>
                                    <div class="mb-1">
                                        <span class="badge bg-info text-dark me-1">${s.department_name || 'Sin área fija (General)'}</span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center mt-1">
                                        ${permBadges || '<span class="text-muted small">Sin servicios asignados</span>'}
                                    </div>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-outline-primary btn-edit-staff px-2" data-id="${s.id}" title="Editar usuario staff">
                                <i class="bi bi-pencil-fill me-1"></i>Editar
                            </button>
                        </div>
                    `;
                }).join('');

                // Bind click events for staff edits
                staffListContainer.querySelectorAll('.btn-edit-staff').forEach(btn => {
                    btn.onclick = () => {
                        const sId = btn.dataset.id;
                        const targetStaff = staff.find(x => x.id === sId);
                        if (targetStaff) this.showEditStaffModal(container, targetStaff, depts);
                    };
                });
            };

            // Filter logic
            const filterDepts = () => {
                const term = searchDeptInput.value.toLowerCase().trim();
                const filtered = depts.filter(d => 
                    d.name.toLowerCase().includes(term) || (d.type && d.type.toLowerCase().includes(term))
                );
                renderDeptList(filtered);
            };

            const filterStaff = () => {
                const term = searchStaffInput.value.toLowerCase().trim();
                const selectedDeptId = filterStaffDept.value;

                const filtered = staff.filter(s => {
                    const matchesTerm = s.name.toLowerCase().includes(term) || 
                                        s.email.toLowerCase().includes(term) || 
                                        (s.phone && s.phone.includes(term)) ||
                                        (s.department_name && s.department_name.toLowerCase().includes(term));
                    const matchesDept = !selectedDeptId || s.department_id === selectedDeptId;
                    return matchesTerm && matchesDept;
                });
                renderStaffList(filtered);
            };

            searchDeptInput.oninput = filterDepts;
            searchStaffInput.oninput = filterStaff;
            filterStaffDept.onchange = filterStaff;

            // Initial render
            renderDeptList(depts);
            renderStaffList(staff);

            // Modal Create Dept
            container.querySelector('#btnCreateDept').onclick = () => {
                UI.showModal({
                    title: 'Activar Nueva Área / Departamento Interno',
                    bodyHtml: `
                        <form id="formDept">
                            <div class="mb-3">
                                <label class="form-label">Nombre del Área</label>
                                <input type="text" class="form-control" id="deptName" placeholder="Ej: Spa & Masajes, Galería de Arte, Excursiones en Lancha" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Tipo de Departamento</label>
                                <select class="form-select" id="deptType">
                                    <option value="RESTAURANT">Restaurante / Comedor</option>
                                    <option value="BAR">Bar / Coctelería</option>
                                    <option value="HOUSEKEEPING">Limpieza / Mucamas</option>
                                    <option value="SPA">Spa & Masajes</option>
                                    <option value="PELUQUERIA">Peluquería & Barbería</option>
                                    <option value="GALERIA">Galería & Arte</option>
                                    <option value="GUIA_TURISTICA">Guía Turística & Tours</option>
                                    <option value="TAXIS">Servicio de Taxis</option>
                                    <option value="LANCHAS">Viajes en Lancha</option>
                                    <option value="TINTORERIA">Tintorería & Lavandería</option>
                                    <option value="ZAPATERIA">Zapatería & Calzado</option>
                                    <option value="MANICURISTA">Manicurista</option>
                                    <option value="PEDICURISTA">Pedicurista</option>
                                    <option value="TECNOLOGIA">Servicios de Tecnología & WiFi</option>
                                    <option value="ALQUILER_ESPACIOS">Alquiler de Espacios del Hotel</option>
                                    <option value="ALQUILER_EQUIPOS">Alquiler de Equipos Tecnológicos</option>
                                    <option value="GIMNASIO">Gimnasio & Fitness Center</option>
                                    <option value="PADEL">Canchas de Pádel</option>
                                    <option value="GUARDERIA">Guardería & Kids Club</option>
                                    <option value="CINE">Cine & Sala Proyecciones</option>
                                    <option value="PISCINA">Piscina & Daypass</option>
                                    <option value="PLAYA">Playa & Club de Playa</option>
                                    <option value="GOLF">Campo de Golf & Minigolf</option>
                                    <option value="LENCERIA">Lencería & Toallas Extra</option>
                                    <option value="TENIS">Canchas de Tenis</option>
                                    <option value="SURF">Surf & Deportes Acuáticos</option>
                                    <option value="CABALLOS">Paseos a Caballo</option>
                                    <option value="CUATRIMOTOS">Cuatrimotos & ATVs 4x4</option>
                                    <option value="HELADERIA">Heladería & Postres</option>
                                    <option value="BODEGON">Bodegón & Licorería VIP</option>
                                    <option value="TIENDA">Tienda de Conveniencia & Souvenirs</option>
                                    <option value="BUCEO">Snorkeling & Buceo PADI</option>
                                    <option value="PARAPENTE">Parapente & Aventura Extrema</option>
                                    <option value="PESCA">Pesca Deportiva & Marina</option>
                                    <option value="VEHICULOS">Alquiler Vehículos 4x4</option>
                                    <option value="EVENTOS">Salón de Eventos & Bodas</option>
                                    <option value="OTHER">Otro Servicio Especial</option>
                                </select>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSaveDept">Activar Área</button>
                    `
                });

                document.getElementById('btnSaveDept').onclick = async () => {
                    const name = document.getElementById('deptName').value;
                    const type = document.getElementById('deptType').value;
                    if (!name) {
                        UI.showToast('Ingrese el nombre del área.', 'warning');
                        return;
                    }

                    try {
                        await API.post('/departments', { name, type });
                        UI.showToast('Área activada exitosamente.', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderAreas(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };

            // Modal Create Staff
            container.querySelector('#btnCreateStaff').onclick = () => {
                let deptOptions = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
                const serviceCheckboxes = [
                    { type: 'RESTAURANT', label: 'Restaurante' },
                    { type: 'BAR', label: 'Bar & Coctelería' },
                    { type: 'SPA', label: 'Spa' },
                    { type: 'PELUQUERIA', label: 'Peluquería' },
                    { type: 'GALERIA', label: 'Galería' },
                    { type: 'GUIA_TURISTICA', label: 'Tours' },
                    { type: 'TAXIS', label: 'Taxis' },
                    { type: 'LANCHAS', label: 'Lanchas' },
                    { type: 'TINTORERIA', label: 'Tintorería' },
                    { type: 'ZAPATERIA', label: 'Zapatería' },
                    { type: 'MANICURISTA', label: 'Manicurista' },
                    { type: 'PEDICURISTA', label: 'Pedicurista' },
                    { type: 'TECNOLOGIA', label: 'Tecnología' },
                    { type: 'ALQUILER_ESPACIOS', label: 'Espacios' },
                    { type: 'ALQUILER_EQUIPOS', label: 'Equipos' },
                    { type: 'GIMNASIO', label: 'Gimnasio' },
                    { type: 'PADEL', label: 'Pádel' },
                    { type: 'GUARDERIA', label: 'Guardería' },
                    { type: 'CINE', label: 'Cine' },
                    { type: 'PISCINA', label: 'Piscina' },
                    { type: 'PLAYA', label: 'Playa' },
                    { type: 'HOUSEKEEPING', label: 'Mucamas' },
                    { type: 'SUBSCRIPCION', label: '⭐ Membresía / Suscripción' },
                    { type: 'FACTURACION_ADMIN', label: '🧾 Facturación (Anulación/Devolución)' }
                ].map(s => `
                    <div class="col-6 col-md-4">
                        <div class="form-check">
                            <input class="form-check-input chk-perm" type="checkbox" value="${s.type}" id="perm_${s.type}">
                            <label class="form-check-label small" for="perm_${s.type}">${s.label}</label>
                        </div>
                    </div>
                `).join('');

                UI.showModal({
                    title: 'Crear Usuario de Personal (Staff)',
                    bodyHtml: `
                        <form id="formStaff">
                            <div class="mb-3">
                                <label class="form-label">Nombre Completo</label>
                                <input type="text" class="form-control" id="stName" placeholder="Ej: María Pérez, Juan Barman" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Correo Electrónico (Para Login)</label>
                                <input type="email" class="form-control" id="stEmail" placeholder="personal@posada.com" required>
                            </div>
                            <div class="row g-2 mb-3">
                                <div class="col-6">
                                    <label class="form-label">Teléfono / WhatsApp</label>
                                    <input type="text" class="form-control" id="stPhone" placeholder="0414-1234567">
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Contraseña</label>
                                    <input type="password" class="form-control" id="stPassword" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Área Principal</label>
                                <select class="form-select" id="stDept">
                                    <option value="">Recepción / General</option>
                                    ${deptOptions}
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="form-label fw-bold text-primary">Servicios Permitidos (Acceso a POS / Gestión)</label>
                                <div class="row g-2 p-2 bg-light rounded border custom-scroll" style="max-height: 220px; overflow-y: auto;">
                                    ${serviceCheckboxes}
                                </div>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSaveStaff">Crear Usuario Staff</button>
                    `
                });

                document.getElementById('btnSaveStaff').onclick = async () => {
                    const staffName = document.getElementById('stName').value;
                    const staffEmail = document.getElementById('stEmail').value;
                    const staffPhone = document.getElementById('stPhone').value;
                    const staffPassword = document.getElementById('stPassword').value;
                    const departmentId = document.getElementById('stDept').value;
                    const permissions = Array.from(document.querySelectorAll('.chk-perm:checked')).map(cb => cb.value);

                    if (!staffName || !staffEmail || !staffPassword) {
                        UI.showToast('Debe ingresar nombre, correo y contraseña.', 'warning');
                        return;
                    }

                    try {
                        await API.post('/departments', {
                            action: 'create_staff',
                            staffName,
                            staffEmail,
                            staffPhone,
                            staffPassword,
                            departmentId,
                            permissions
                        });
                        UI.showToast('Usuario de personal creado exitosamente con sus permisos.', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderAreas(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    showEditDeptModal(container, dept) {
        UI.showModal({
            title: `Editar Área: ${dept.name}`,
            bodyHtml: `
                <form id="formEditDept">
                    <div class="mb-3">
                        <label class="form-label">Nombre del Área</label>
                        <input type="text" class="form-control" id="deptEditName" value="${dept.name}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Tipo de Departamento</label>
                        <select class="form-select" id="deptEditType">
                            <option value="RESTAURANT" ${dept.type === 'RESTAURANT' ? 'selected' : ''}>Restaurante / Comedor</option>
                            <option value="BAR" ${dept.type === 'BAR' ? 'selected' : ''}>Bar / Coctelería</option>
                            <option value="HOUSEKEEPING" ${dept.type === 'HOUSEKEEPING' ? 'selected' : ''}>Limpieza / Mucamas</option>
                            <option value="SPA" ${dept.type === 'SPA' ? 'selected' : ''}>Spa & Masajes</option>
                            <option value="PELUQUERIA" ${dept.type === 'PELUQUERIA' ? 'selected' : ''}>Peluquería & Barbería</option>
                            <option value="GALERIA" ${dept.type === 'GALERIA' ? 'selected' : ''}>Galería & Arte</option>
                            <option value="GUIA_TURISTICA" ${dept.type === 'GUIA_TURISTICA' ? 'selected' : ''}>Guía Turística & Tours</option>
                            <option value="TAXIS" ${dept.type === 'TAXIS' ? 'selected' : ''}>Servicio de Taxis</option>
                            <option value="LANCHAS" ${dept.type === 'LANCHAS' ? 'selected' : ''}>Viajes en Lancha</option>
                            <option value="TINTORERIA" ${dept.type === 'TINTORERIA' ? 'selected' : ''}>Tintorería & Lavandería</option>
                            <option value="ZAPATERIA" ${dept.type === 'ZAPATERIA' ? 'selected' : ''}>Zapatería & Calzado</option>
                            <option value="MANICURISTA" ${dept.type === 'MANICURISTA' ? 'selected' : ''}>Manicurista</option>
                            <option value="PEDICURISTA" ${dept.type === 'PEDICURISTA' ? 'selected' : ''}>Pedicurista</option>
                            <option value="TECNOLOGIA" ${dept.type === 'TECNOLOGIA' ? 'selected' : ''}>Servicios de Tecnología & WiFi</option>
                            <option value="ALQUILER_ESPACIOS" ${dept.type === 'ALQUILER_ESPACIOS' ? 'selected' : ''}>Alquiler de Espacios del Hotel</option>
                            <option value="ALQUILER_EQUIPOS" ${dept.type === 'ALQUILER_EQUIPOS' ? 'selected' : ''}>Alquiler de Equipos Tecnológicos</option>
                            <option value="GIMNASIO" ${dept.type === 'GIMNASIO' ? 'selected' : ''}>Gimnasio & Fitness Center</option>
                            <option value="PADEL" ${dept.type === 'PADEL' ? 'selected' : ''}>Canchas de Pádel</option>
                            <option value="GUARDERIA" ${dept.type === 'GUARDERIA' ? 'selected' : ''}>Guardería & Kids Club</option>
                            <option value="CINE" ${dept.type === 'CINE' ? 'selected' : ''}>Cine & Sala Proyecciones</option>
                            <option value="PISCINA" ${dept.type === 'PISCINA' ? 'selected' : ''}>Piscina & Daypass</option>
                            <option value="PLAYA" ${dept.type === 'PLAYA' ? 'selected' : ''}>Playa & Club de Playa</option>
                            <option value="GOLF" ${dept.type === 'GOLF' ? 'selected' : ''}>Campo de Golf & Minigolf</option>
                            <option value="LENCERIA" ${dept.type === 'LENCERIA' ? 'selected' : ''}>Lencería & Toallas Extra</option>
                            <option value="TENIS" ${dept.type === 'TENIS' ? 'selected' : ''}>Canchas de Tenis</option>
                            <option value="SURF" ${dept.type === 'SURF' ? 'selected' : ''}>Surf & Deportes Acuáticos</option>
                            <option value="CABALLOS" ${dept.type === 'CABALLOS' ? 'selected' : ''}>Paseos a Caballo</option>
                            <option value="CUATRIMOTOS" ${dept.type === 'CUATRIMOTOS' ? 'selected' : ''}>Cuatrimotos & ATVs 4x4</option>
                            <option value="HELADERIA" ${dept.type === 'HELADERIA' ? 'selected' : ''}>Heladería & Postres</option>
                            <option value="BODEGON" ${dept.type === 'BODEGON' ? 'selected' : ''}>Bodegón & Licorería VIP</option>
                            <option value="TIENDA" ${dept.type === 'TIENDA' ? 'selected' : ''}>Tienda & Souvenirs</option>
                            <option value="BUCEO" ${dept.type === 'BUCEO' ? 'selected' : ''}>Snorkeling & Buceo PADI</option>
                            <option value="PARAPENTE" ${dept.type === 'PARAPENTE' ? 'selected' : ''}>Parapente & Aventura</option>
                            <option value="PESCA" ${dept.type === 'PESCA' ? 'selected' : ''}>Pesca Deportiva & Marina</option>
                            <option value="VEHICULOS" ${dept.type === 'VEHICULOS' ? 'selected' : ''}>Alquiler Vehículos 4x4</option>
                            <option value="EVENTOS" ${dept.type === 'EVENTOS' ? 'selected' : ''}>Salón de Eventos & Bodas</option>
                            <option value="OTHER" ${dept.type === 'OTHER' ? 'selected' : ''}>Otro Servicio Especial</option>
                        </select>
                    </div>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" id="deptEditStatus" ${dept.is_active !== 0 ? 'checked' : ''}>
                        <label class="form-check-label fw-bold" for="deptEditStatus">Área Activa en el Sistema</label>
                    </div>
                </form>
            `,
            footerHtml: `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" id="btnUpdateDept">Guardar Cambios</button>
            `
        });

        document.getElementById('btnUpdateDept').onclick = async () => {
            const name = document.getElementById('deptEditName').value;
            const type = document.getElementById('deptEditType').value;
            const is_active = document.getElementById('deptEditStatus').checked;

            if (!name) {
                UI.showToast('El nombre del área es requerido.', 'warning');
                return;
            }

            try {
                await API.put('/departments', { deptId: dept.id, name, type, is_active });
                UI.showToast('Área actualizada exitosamente.', 'success');
                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                this.renderAreas(container);
            } catch (e) {
                UI.showToast(e.message, 'danger');
            }
        };
    },

    showEditStaffModal(container, staffMember, depts) {
        let deptOptions = depts.map(d => `<option value="${d.id}" ${d.id === staffMember.department_id ? 'selected' : ''}>${d.name}</option>`).join('');

        const currentPerms = staffMember.permissions || [];
        const serviceCheckboxes = [
            { type: 'RESTAURANT', label: 'Restaurante' },
            { type: 'BAR', label: 'Bar & Coctelería' },
            { type: 'SPA', label: 'Spa' },
            { type: 'PELUQUERIA', label: 'Peluquería' },
            { type: 'GALERIA', label: 'Galería' },
            { type: 'GUIA_TURISTICA', label: 'Tours' },
            { type: 'TAXIS', label: 'Taxis' },
            { type: 'LANCHAS', label: 'Lanchas' },
            { type: 'TINTORERIA', label: 'Tintorería' },
            { type: 'ZAPATERIA', label: 'Zapatería' },
            { type: 'MANICURISTA', label: 'Manicurista' },
            { type: 'PEDICURISTA', label: 'Pedicurista' },
            { type: 'TECNOLOGIA', label: 'Tecnología' },
            { type: 'ALQUILER_ESPACIOS', label: 'Espacios' },
            { type: 'ALQUILER_EQUIPOS', label: 'Equipos' },
            { type: 'GIMNASIO', label: 'Gimnasio' },
            { type: 'PADEL', label: 'Pádel' },
            { type: 'GUARDERIA', label: 'Guardería' },
            { type: 'CINE', label: 'Cine' },
            { type: 'PISCINA', label: 'Piscina' },
            { type: 'PLAYA', label: 'Playa' },
            { type: 'GOLF', label: 'Golf' },
            { type: 'LENCERIA', label: 'Lencería' },
            { type: 'TENIS', label: 'Tenis' },
            { type: 'SURF', label: 'Surf' },
            { type: 'CABALLOS', label: 'Caballos' },
            { type: 'CUATRIMOTOS', label: 'Cuatrimotos' },
            { type: 'HELADERIA', label: 'Heladería' },
            { type: 'BODEGON', label: 'Bodegón' },
            { type: 'TIENDA', label: 'Tienda' },
            { type: 'BUCEO', label: 'Buceo' },
            { type: 'PARAPENTE', label: 'Parapente' },
            { type: 'PESCA', label: 'Pesca' },
            { type: 'VEHICULOS', label: 'Rústicos 4x4' },
            { type: 'EVENTOS', label: 'Eventos' },
            { type: 'HOUSEKEEPING', label: 'Mucamas' },
            { type: 'SUBSCRIPCION', label: '⭐ Membresía / Suscripción' },
            { type: 'FACTURACION_ADMIN', label: '🧾 Facturación (Anulación/Devolución)' }
        ].map(s => `
            <div class="col-6 col-md-4">
                <div class="form-check">
                    <input class="form-check-input chk-edit-perm" type="checkbox" value="${s.type}" id="edit_perm_${s.type}" ${currentPerms.includes(s.type) ? 'checked' : ''}>
                    <label class="form-check-label small" for="edit_perm_${s.type}">${s.label}</label>
                </div>
            </div>
        `).join('');

        UI.showModal({
            title: `Editar Personal: ${staffMember.name}`,
            bodyHtml: `
                <form id="formEditStaff">
                    <div class="mb-3">
                        <label class="form-label">Nombre Completo</label>
                        <input type="text" class="form-control" id="stEditName" value="${staffMember.name || ''}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Correo Electrónico (Login)</label>
                        <input type="email" class="form-control" id="stEditEmail" value="${staffMember.email || ''}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Teléfono / WhatsApp</label>
                        <input type="text" class="form-control" id="stEditPhone" value="${staffMember.phone || ''}">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Área Principal</label>
                        <select class="form-select" id="stEditDept">
                            <option value="">Recepción / General</option>
                            ${deptOptions}
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label fw-bold text-primary">Servicios Permitidos (Acceso a POS / Gestión)</label>
                        <div class="row g-2 p-2 bg-light rounded border">
                            ${serviceCheckboxes}
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Nueva Contraseña (Opcional)</label>
                        <input type="password" class="form-control" id="stEditPassword" placeholder="Dejar en blanco para mantener la contraseña actual">
                    </div>
                </form>
            `,
            footerHtml: `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-primary" id="btnUpdateStaff">Guardar Cambios</button>
            `
        });

        document.getElementById('btnUpdateStaff').onclick = async () => {
            const staffName = document.getElementById('stEditName').value;
            const staffEmail = document.getElementById('stEditEmail').value;
            const staffPhone = document.getElementById('stEditPhone').value;
            const departmentId = document.getElementById('stEditDept').value;
            const newPassword = document.getElementById('stEditPassword').value;
            const permissions = Array.from(document.querySelectorAll('.chk-edit-perm:checked')).map(cb => cb.value);

            if (!staffName || !staffEmail) {
                UI.showToast('Nombre y correo son requeridos.', 'warning');
                return;
            }

            try {
                await API.put('/departments', {
                    action: 'update_staff',
                    staffId: staffMember.id,
                    staffName,
                    staffEmail,
                    staffPhone,
                    departmentId,
                    newPassword,
                    permissions
                });
                UI.showToast('Usuario de personal actualizado exitosamente.', 'success');
                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                this.renderAreas(container);
            } catch (e) {
                UI.showToast(e.message, 'danger');
            }
        };
    },

    // 7. CONFIGURACIÓN DEL PERFIL Y MARCA DEL HOTEL
    async renderAjustes(container) {
        const hotel = State.getHotel();

        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 class="fw-bold mb-1"><i class="bi bi-gear-wide-connected text-primary me-2"></i>Perfil y Marca del Hotel</h2>
                    <p class="text-muted mb-0">Carga de logotipo corporativo a Cloudflare R2, RIF y paleta de colores</p>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-md-4">
                    <div class="card border-0 shadow-sm text-center p-4">
                        <div class="mb-3">
                            <img id="hotelLogoPreview" src="${hotel.logo_url || 'img/logo.png'}" class="img-fluid rounded border p-2" style="max-height: 150px; object-fit: contain;">
                        </div>
                        <label class="btn btn-outline-primary w-100">
                            <i class="bi bi-cloud-upload me-1"></i>Cambiar Logo (Cloudflare R2)
                            <input type="file" id="inputLogoFile" accept="image/*" class="d-none">
                        </label>
                        <small class="text-muted d-block mt-2">Compresión automática en canvas y subida directa por PUT a R2.</small>
                    </div>
                </div>

                <div class="col-md-8">
                    <div class="card border-0 shadow-sm p-4">
                        <form id="formHotelProfile">
                            <div class="mb-3">
                                <label class="form-label">Nombre Comercial del Hotel / Posada</label>
                                <input type="text" class="form-control" id="profName" value="${hotel.name || ''}" required>
                            </div>
                            <div class="row g-2 mb-3">
                                <div class="col-6">
                                    <label class="form-label">RIF Fiscal</label>
                                    <input type="text" class="form-control" id="profRif" value="${hotel.rif || ''}" required>
                                </div>
                                <div class="col-6">
                                    <label class="form-label">Teléfono de Contacto</label>
                                    <input type="text" class="form-control" id="profPhone" value="${hotel.phone || ''}">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Dirección Física</label>
                                <input type="text" class="form-control" id="profAddress" value="${hotel.address || ''}">
                            </div>
                            <div class="row g-2 mb-3">
                                <div class="col-6">
                                    <label class="form-label"><i class="bi bi-clock me-1 text-primary"></i>Hora Específica de Check-In</label>
                                    <input type="time" class="form-control" id="profCheckIn" value="${hotel.check_in_time || '15:00'}" required>
                                </div>
                                <div class="col-6">
                                    <label class="form-label"><i class="bi bi-clock-history me-1 text-danger"></i>Hora Específica de Check-Out</label>
                                    <input type="time" class="form-control" id="profCheckOut" value="${hotel.check_out_time || '12:00'}" required>
                                </div>
                            </div>
                            <div class="row g-2 mb-3">
                                <div class="col-6">
                                    <label class="form-label">Color Primario de Marca</label>
                                    <input type="color" class="form-control form-control-color w-100" id="profColor" value="${hotel.primary_color || '#0d6efd'}">
                                </div>
                                <div class="col-6 d-flex align-items-end">
                                    <div class="form-check form-switch mb-2">
                                        <input class="form-check-input" type="checkbox" id="profDarkMode" ${hotel.dark_mode ? 'checked' : ''}>
                                        <label class="form-check-label fw-bold" for="profDarkMode">Modo Oscuro</label>
                                    </div>
                                </div>
                            </div>

                            <hr class="my-4">
                            <h5 class="fw-bold text-primary mb-3"><i class="bi bi-file-earmark-pdf-fill me-2"></i>Configuración de Comprobantes, Serialización y Cabecera PDF</h5>
                            
                            <div class="row g-2 mb-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Serie / Prefijo de Facturación</label>
                                    <input type="text" class="form-control" id="profInvPrefix" value="${hotel.invoice_prefix || 'FAC-'}" placeholder="Ej: FAC-, SER-A, NE-">
                                    <small class="text-muted">Prefijo impreso al inicio del número de cada comprobante.</small>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Próximo Número / Correlativo</label>
                                    <input type="number" class="form-control" id="profInvNextNum" value="${hotel.invoice_next_number || 1}" min="1">
                                    <small class="text-muted">Próximo número a asignar automáticamente.</small>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Cabecera / Subtítulo del PDF</label>
                                <input type="text" class="form-control" id="profInvHeader" value="${hotel.invoice_header_notes || ''}" placeholder="Ej: COMPROBANTE DE HOSPEDAJE Y FACTURA DE CONSUMOS">
                                <small class="text-muted">Texto o leyenda superior al lado del logo del hotel.</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Nota al Pie / Leyenda Tributaria o Legal</label>
                                <textarea class="form-control" id="profInvFooter" rows="2" placeholder="Ej: Valores liquidados a la Tasa Oficial de Cambio emitida por el Banco Central de Venezuela (BCV). Gracias por su preferencia.">${hotel.invoice_footer_notes || ''}</textarea>
                                <small class="text-muted">Nota impresa en la parte inferior de todas las facturas PDF descargadas.</small>
                            </div>

                            <button type="submit" class="btn btn-primary btn-lg mt-3"><i class="bi bi-save me-1"></i>Guardar Todos los Ajustes</button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        let currentLogoUrl = hotel.logo_url;

        // Handle Logo File Upload to R2
        container.querySelector('#inputLogoFile').onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                UI.showToast('Comprimiendo e iniciando subida directa a Cloudflare R2...', 'info');
                const destPath = `clients/${hotel.id}/logos/logo_${Date.now()}.${file.name.split('.').pop()}`;
                const publicUrl = await Uploader.uploadToR2(file, destPath);

                currentLogoUrl = publicUrl;
                document.getElementById('hotelLogoPreview').src = publicUrl;
                UI.showToast('Logotipo subido exitosamente a Cloudflare R2 ✨', 'success');
            } catch (err) {
                UI.showToast(`Error al subir imagen: ${err.message}`, 'danger');
            }
        };

        // Form Submit
        container.querySelector('#formHotelProfile').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('profName').value;
            const rif = document.getElementById('profRif').value;
            const phone = document.getElementById('profPhone').value;
            const address = document.getElementById('profAddress').value;
            const check_in_time = document.getElementById('profCheckIn').value;
            const check_out_time = document.getElementById('profCheckOut').value;
            const primary_color = document.getElementById('profColor').value;
            const dark_mode = document.getElementById('profDarkMode').checked;
            const invoice_prefix = document.getElementById('profInvPrefix').value;
            const invoice_next_number = document.getElementById('profInvNextNum').value;
            const invoice_header_notes = document.getElementById('profInvHeader').value;
            const invoice_footer_notes = document.getElementById('profInvFooter').value;

            try {
                const updatedHotel = await API.put('/hotels', {
                    name, rif, phone, address, logo_url: currentLogoUrl, primary_color, dark_mode, check_in_time, check_out_time,
                    invoice_prefix, invoice_next_number, invoice_header_notes, invoice_footer_notes
                });
                State.setHotel(updatedHotel);
                State.toggleDarkMode(dark_mode);

                // Real-time Navbar Brand Logo & Text Update
                const brandLogo = document.getElementById('navBrandLogo');
                const brandText = document.getElementById('navBrandText');
                if (brandLogo && updatedHotel.logo_url) brandLogo.src = updatedHotel.logo_url;
                if (brandText && updatedHotel.name) brandText.textContent = updatedHotel.name;

                UI.showToast('Perfil y marca del hotel actualizados en tiempo real ✨', 'success');
            } catch (err) {
                UI.showToast(err.message, 'danger');
            }
        };
    },

    // 8. PAGOS DE MEMBRESÍA SAAS POR EL HOTEL
    async renderPagos(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const payments = await API.get('/admin/payments');
            const methods = await API.get('/admin/payment-methods');
            const settings = await API.get('/admin/settings');

            const hotel = State.getHotel();
            const monthlyFee = settings.monthly_fee_usd || '20.00';

            const now = new Date();
            const licType = hotel.license_type === 'COURTESY' ? 'COURTESY' : 'COMMERCIAL';
            const licNameText = licType === 'COURTESY' ? 'Licencia de Cortesía' : 'Licencia Comercial';
            const licBadge = licType === 'COURTESY' 
                ? '<span class="badge bg-purple text-white fs-6 ms-2"><i class="bi bi-gift-fill me-1"></i>Licencia de Cortesía</span>'
                : '<span class="badge bg-primary fs-6 ms-2"><i class="bi bi-award-fill me-1"></i>Licencia Comercial</span>';

            const dueDate = hotel.subscription_due_date ? new Date(hotel.subscription_due_date) : (hotel.trial_ends_at ? new Date(hotel.trial_ends_at) : null);
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

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-credit-card-2-front-fill text-primary me-2"></i>Estado de Membresía SaaS</h2>
                        <p class="text-muted mb-0">Gestión de suscripción (${licNameText}) y reporte de comprobantes</p>
                    </div>
                    <button class="btn btn-primary" id="btnReportPayment"><i class="bi bi-upload me-1"></i>Reportar Pago de Membresía</button>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-4 h-100">
                            <h5 class="fw-bold text-primary mb-3">Estatus de la Licencia de Uso</h5>
                            <div class="mb-3 d-flex align-items-center flex-wrap gap-2">
                                <span class="text-muted">Tipo de Licencia:</span>
                                ${licBadge}
                            </div>
                            <div class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="text-muted">Tiempo de Uso Disponible:</span>
                                    <span class="fw-bold ${daysLeft <= 5 ? 'text-danger' : 'text-success'} fs-6">${daysLeft} días restantes</span>
                                </div>
                                <div class="progress" style="height: 10px;">
                                    <div class="progress-bar ${progressColor} progress-bar-striped progress-bar-animated" role="progressbar" style="width: ${progressPercent}%;"></div>
                                </div>
                            </div>
                            <div class="mb-2">
                                <span class="text-muted">Estado Actual:</span>
                                <span class="badge ${hotel.status === 'ACTIVE' ? 'bg-success' : 'bg-warning text-dark'} fs-6 ms-2">${hotel.status}</span>
                            </div>
                            <div>
                                <span class="text-muted">Próximo Vencimiento:</span>
                                <strong>${dueDate ? new Date(dueDate).toLocaleDateString('es-VE') : 'N/A'}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-4 h-100">
                            <h5 class="fw-bold text-primary mb-3">Cuentas de Pago Disponibles</h5>
                            <ul class="list-group list-group-flush">
            `;

            methods.forEach(m => {
                html += `
                    <li class="list-group-item px-0">
                        <div class="fw-bold text-dark">${m.name} (${m.currency})</div>
                        <small class="text-muted d-block">${m.details}</small>
                    </li>
                `;
            });

            html += `
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-header bg-white fw-bold py-3"><i class="bi bi-clock-history me-2 text-primary"></i>Historial de Pagos Reportados</div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>N° Referencia</th>
                                        <th>Método</th>
                                        <th>Monto ($USD)</th>
                                        <th>Comprobante R2</th>
                                        <th>Estado</th>
                                        <th>Fecha Reporte</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            if (payments.length === 0) {
                html += `<tr><td colspan="6" class="text-center py-4 text-muted">No ha reportado pagos de membresía aún.</td></tr>`;
            } else {
                payments.forEach(p => {
                    const stBadge = p.status === 'APPROVED' ? '<span class="badge bg-success">Aprobado</span>' :
                                    p.status === 'PENDING' ? '<span class="badge bg-warning text-dark">En Verificación</span>' : '<span class="badge bg-danger">Rechazado</span>';

                    html += `
                        <tr>
                            <td><strong class="text-primary">${p.reference_number}</strong></td>
                            <td>${p.method_name}</td>
                            <td class="fw-bold">$${Number(p.amount_usd).toFixed(2)} USD</td>
                            <td>${p.proof_url ? `<a href="${p.proof_url}" target="_blank" class="btn btn-sm btn-outline-info"><i class="bi bi-eye me-1"></i>Ver Comprobante</a>` : 'Sin imagen'}</td>
                            <td>${stBadge}</td>
                            <td class="small text-muted">${new Date(p.created_at).toLocaleDateString('es-VE')}</td>
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

            // Report Payment Modal
            container.querySelector('#btnReportPayment').onclick = () => {
                let mOpts = methods.map(m => `<option value="${m.id}">${m.name} (${m.currency})</option>`).join('');

                UI.showModal({
                    title: 'Reportar Pago de Membresía SaaS',
                    bodyHtml: `
                        <form id="formReportPayment">
                            <div class="mb-3">
                                <label class="form-label">Método de Pago Utilizado</label>
                                <select class="form-select" id="payMethodId" required>
                                    ${mOpts}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Número de Referencia</label>
                                <input type="text" class="form-control" id="payRef" required placeholder="Ej: 12345678">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Monto Reportado ($USD)</label>
                                <input type="number" step="0.01" class="form-control" id="payAmount" value="${monthlyFee}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Captura / Comprobante de Pago (Cloudflare R2)</label>
                                <input type="file" class="form-control" id="payProofFile" accept="image/*" required>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSubmitPayment">Enviar Reporte</button>
                    `
                });

                document.getElementById('btnSubmitPayment').onclick = async () => {
                    const methodId = document.getElementById('payMethodId').value;
                    const referenceNumber = document.getElementById('payRef').value;
                    const amountUsd = document.getElementById('payAmount').value;
                    const fileInput = document.getElementById('payProofFile');

                    if (!referenceNumber || !fileInput.files[0]) {
                        UI.showToast('Por favor ingrese la referencia y adjunte la captura.', 'warning');
                        return;
                    }

                    try {
                        const file = fileInput.files[0];
                        const userId = State.getUser() ? State.getUser().id : 'user';
                        const destPath = `clients/${userId}/payments/proof_${Date.now()}.${file.name.split('.').pop()}`;

                        UI.showToast('Subiendo comprobante a Cloudflare R2...', 'info');
                        const proofUrl = await Uploader.uploadToR2(file, destPath);

                        await API.post('/admin/payments', {
                            methodId,
                            referenceNumber,
                            amountUsd,
                            proofUrl
                        });

                        UI.showToast('Reporte de pago enviado a verificación exitosamente.', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderPagos(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    // 9. VISTA DINÁMICA DE CATÁLOGO Y POS MULTI-DEPARTAMENTO (Restaurante, Bar, Spa, Peluquería, Taxis, Lanchas, etc.)
    async renderServicioPOS(container, serviceType, title, subtitle, iconClass) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const catalog = await API.get('/catalog?type=' + serviceType);
            const bookings = await API.get('/bookings?status=CHECKED_IN');
            const user = State.getUser();
            const isAdmin = user && (user.role === 'HOTEL_ADMIN' || user.role === 'SUPERADMIN');

            let catalogHtml = '';
            if (catalog.length === 0) {
                catalogHtml = `<div class="p-4 text-center text-muted"><i class="bi ${iconClass} fs-1 d-block mb-2 text-secondary"></i>No se han registrado productos o servicios en este catálogo.</div>`;
            } else {
                catalogHtml = catalog.map(item => `
                    <div class="card border mb-2 shadow-sm rounded-3">
                        <div class="card-body p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                            <div>
                                <h6 class="fw-bold mb-1 text-dark">${item.name}</h6>
                                ${item.description ? `<p class="small text-muted mb-1">${item.description}</p>` : ''}
                                <span class="badge ${item.is_available ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary border'}">
                                    ${item.is_available ? 'Disponible' : 'Agotado'}
                                </span>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <span class="fs-5 fw-bold text-primary">$${Number(item.price_usd).toFixed(2)} USD</span>
                                ${item.is_available && bookings.length > 0 ? `
                                    <button class="btn btn-sm btn-outline-primary btn-quick-charge" data-id="${item.id}">
                                        <i class="bi bi-cart-plus me-1"></i>Cargar
                                    </button>
                                ` : ''}
                                ${isAdmin ? `
                                    <button class="btn btn-sm btn-outline-secondary btn-edit-catalog" data-id="${item.id}">
                                        <i class="bi bi-pencil-fill"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            let bookingOptionsHtml = bookings.map(b => `<option value="${b.id}">Hab. ${b.room_number} - ${b.guest_name}</option>`).join('');
            let catalogOptionsHtml = catalog.filter(c => c.is_available).map(c => `<option value="${c.id}">[${c.department_type}] ${c.name} ($${Number(c.price_usd).toFixed(2)})</option>`).join('');

            container.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi ${iconClass} text-primary me-2"></i>${title}</h2>
                        <p class="text-muted mb-0">${subtitle}</p>
                    </div>
                    ${isAdmin ? `
                        <button class="btn btn-primary shadow-sm" id="btnAddCatalogItem">
                            <i class="bi bi-plus-lg me-1"></i>Nuevo Producto / Servicio
                        </button>
                    ` : ''}
                </div>

                <div class="row g-4">
                    <!-- Catálogo de Servicios / Menú de Precios -->
                    <div class="col-lg-7">
                        <div class="card border-0 shadow-sm rounded-3">
                            <div class="card-header bg-white py-3 border-0 d-flex justify-content-between align-items-center">
                                <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-list-stars me-2 text-primary"></i>Catálogo & Lista de Precios</h5>
                                <span class="badge bg-primary rounded-pill">${catalog.length} ítems</span>
                            </div>
                            <div class="card-body pt-0 custom-scroll" style="max-height: 540px; overflow-y: auto;">
                                ${catalogHtml}
                            </div>
                        </div>
                    </div>

                    <!-- Punto de Venta POS - Carga Directa a Habitación -->
                    <div class="col-lg-5">
                        <div class="card border-0 shadow-sm rounded-3">
                            <div class="card-header bg-white py-3 border-0">
                                <h5 class="fw-bold mb-0 text-dark"><i class="bi bi-credit-card-2-back me-2 text-primary"></i>Cobro Rápido a Habitación</h5>
                            </div>
                            <div class="card-body pt-0">
                                ${bookings.length === 0 ? `
                                    <div class="alert alert-warning py-3 small mb-0">
                                        <i class="bi bi-exclamation-triangle me-1"></i>No hay habitaciones ocupadas (CHECKED_IN) en este momento para cargar consumos.
                                    </div>
                                ` : `
                                    <form id="formPosCharge">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Habitación / Huésped Ocupante</label>
                                            <select class="form-select" id="posBookingId" required>
                                                <option value="">Seleccione habitación...</option>
                                                ${bookingOptionsHtml}
                                            </select>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Producto / Servicio del Catálogo</label>
                                            <select class="form-select" id="posItemId" required>
                                                <option value="">Seleccione producto o servicio...</option>
                                                ${catalogOptionsHtml}
                                            </select>
                                        </div>
                                        <div class="row g-2 mb-3">
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Cantidad</label>
                                                <input type="number" class="form-control" id="posQuantity" value="1" min="1" required>
                                            </div>
                                            <div class="col-6">
                                                <label class="form-label fw-semibold">Notas / Detalles</label>
                                                <input type="text" class="form-control" id="posNotes" placeholder="Ej: Mesa 3, Sin picante">
                                            </div>
                                        </div>
                                        <button type="submit" class="btn btn-primary w-100 btn-lg shadow-sm mt-2">
                                            <i class="bi bi-check-circle me-1"></i>Confirmar y Cargar a Cuenta
                                        </button>
                                    </form>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add catalog item (Admin)
            const btnAddCat = container.querySelector('#btnAddCatalogItem');
            if (btnAddCat) {
                btnAddCat.onclick = () => {
                    UI.showModal({
                        title: `Agregar Nuevo Ítem a ${title}`,
                        bodyHtml: `
                            <ul class="nav nav-tabs nav-fill mb-3" id="catModalTabs" role="tablist">
                                <li class="nav-item">
                                    <button class="nav-link active fw-bold" id="single-tab" data-bs-toggle="tab" data-bs-target="#tab-single" type="button"><i class="bi bi-plus-circle me-1"></i>Ítem Individual</button>
                                </li>
                                <li class="nav-item">
                                    <button class="nav-link fw-bold text-success" id="csv-tab" data-bs-toggle="tab" data-bs-target="#tab-csv" type="button"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Carga Masiva (CSV)</button>
                                </li>
                            </ul>
                            <div class="tab-content" id="catModalTabContent">
                                <div class="tab-pane fade show active" id="tab-single">
                                    <form id="formNewCatItem">
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Nombre del Producto / Servicio</label>
                                            <input type="text" class="form-control" id="catItemName" placeholder="Ej: Hamburguesa Gourmet, Masaje Terapéutico, Traslado Aeropuerto" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Descripción / Detalle</label>
                                            <input type="text" class="form-control" id="catItemDesc" placeholder="Ej: Incluye bebidas / Duración 45 min...">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label fw-semibold">Precio ($USD)</label>
                                            <input type="number" step="0.01" class="form-control" id="catItemPrice" required placeholder="15.00">
                                        </div>
                                        <button type="button" class="btn btn-primary w-100 py-2 shadow-sm" id="btnSaveCatItem"><i class="bi bi-check-circle me-1"></i>Guardar en Catálogo</button>
                                    </form>
                                </div>
                                <div class="tab-pane fade" id="tab-csv">
                                    <div class="card border-0 bg-light p-3 mb-3 rounded-3">
                                        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                                            <div>
                                                <h6 class="fw-bold mb-1 text-dark"><i class="bi bi-download text-success me-1"></i>Paso 1: Descarga la plantilla CSV</h6>
                                                <p class="small text-muted mb-0">Editable en Excel / Bloc de notas (Headers: <code>nombre, descripcion, precio_usd</code>)</p>
                                            </div>
                                            <button type="button" class="btn btn-sm btn-outline-success fw-bold" id="btnDownloadTemplateCsv"><i class="bi bi-file-earmark-arrow-down me-1"></i>Descargar Plantilla</button>
                                        </div>
                                        <hr class="my-2">
                                        <div>
                                            <h6 class="fw-bold mb-1 text-dark"><i class="bi bi-upload text-primary me-1"></i>Paso 2: Selecciona tu archivo CSV editado</h6>
                                            <input type="file" class="form-control form-control-sm mt-1" id="catCsvFileInput" accept=".csv,text/csv">
                                        </div>
                                    </div>
                                    <div id="csvPreviewSection" style="display: none;">
                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                            <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-eye me-1 text-primary"></i>Previsualización en Vivo</h6>
                                            <span id="csvParsedCountBadge" class="badge bg-primary">0 ítems</span>
                                        </div>
                                        <div class="table-responsive border rounded custom-scroll" style="max-height: 200px; overflow-y: auto;">
                                            <table class="table table-sm table-hover align-middle mb-0 small">
                                                <thead class="table-light sticky-top">
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Nombre</th>
                                                        <th>Descripción</th>
                                                        <th>Precio ($USD)</th>
                                                        <th>Estado</th>
                                                    </tr>
                                                </thead>
                                                <tbody id="csvPreviewTbody"></tbody>
                                            </table>
                                        </div>
                                        <button type="button" class="btn btn-success w-100 py-2 shadow-sm mt-3" id="btnUploadBulkCsv" disabled><i class="bi bi-cloud-arrow-up-fill me-1"></i>Confirmar y Subir Masivamente</button>
                                    </div>
                                </div>
                            </div>
                        `,
                        footerHtml: `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`
                    });

                    // Save single item
                    const btnSaveSingle = document.getElementById('btnSaveCatItem');
                    if (btnSaveSingle) {
                        btnSaveSingle.onclick = async () => {
                            const name = document.getElementById('catItemName').value;
                            const description = document.getElementById('catItemDesc').value;
                            const priceUsd = document.getElementById('catItemPrice').value;

                            if (!name || priceUsd === undefined || priceUsd === '') {
                                UI.showToast('Nombre y precio son requeridos.', 'warning');
                                return;
                            }

                            try {
                                await API.post('/catalog', { name, description, priceUsd, departmentType: serviceType });
                                UI.showToast('Ítem agregado exitosamente al catálogo.', 'success');
                                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                this.renderServicioPOS(container, serviceType, title, subtitle, iconClass);
                            } catch (e) {
                                UI.showToast(e.message, 'danger');
                            }
                        };
                    }

                    // CSV template download
                    const btnDlCsv = document.getElementById('btnDownloadTemplateCsv');
                    if (btnDlCsv) {
                        btnDlCsv.onclick = () => {
                            const sampleCsv = `nombre,descripcion,precio_usd\n"Ejemplo Producto 1","Descripción detallada del producto",12.50\n"Ejemplo Servicio 2","Servicio ofrecido por el hotel",25.00\n`;
                            CSVUtil.downloadTemplate(`plantilla_catalogo_${serviceType.toLowerCase()}.csv`, sampleCsv);
                        };
                    }

                    // CSV file parsing & live preview
                    const csvInput = document.getElementById('catCsvFileInput');
                    const previewSec = document.getElementById('csvPreviewSection');
                    const tbody = document.getElementById('csvPreviewTbody');
                    const countBadge = document.getElementById('csvParsedCountBadge');
                    const btnUploadBulk = document.getElementById('btnUploadBulkCsv');

                    let currentParsedItems = [];

                    if (csvInput) {
                        csvInput.onchange = (evt) => {
                            const file = evt.target.files[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const text = e.target.result;
                                const parsed = CSVUtil.parse(text);

                                currentParsedItems = parsed.map(item => ({
                                    ...item,
                                    departmentType: serviceType
                                }));

                                if (currentParsedItems.length === 0) {
                                    UI.showToast('El archivo CSV está vacío o no tiene el formato correcto.', 'warning');
                                    previewSec.style.display = 'none';
                                    if (btnUploadBulk) btnUploadBulk.disabled = true;
                                    return;
                                }

                                const validItems = currentParsedItems.filter(x => x.isValid);
                                if (countBadge) countBadge.textContent = `${validItems.length} de ${currentParsedItems.length} ítems válidos`;

                                if (tbody) {
                                    tbody.innerHTML = currentParsedItems.map((item, idx) => `
                                        <tr class="${item.isValid ? '' : 'table-danger'}">
                                            <td>${idx + 1}</td>
                                            <td class="fw-bold">${item.name || '<span class="text-danger">Falta nombre</span>'}</td>
                                            <td class="text-muted small">${item.description || '-'}</td>
                                            <td class="fw-bold text-primary">$${Number(item.priceUsd || 0).toFixed(2)}</td>
                                            <td>
                                                ${item.isValid ? 
                                                    `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-circle me-1"></i>Listo</span>` :
                                                    `<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-x-circle me-1"></i>Inválido</span>`
                                                }
                                            </td>
                                        </tr>
                                    `).join('');
                                }

                                if (previewSec) previewSec.style.display = 'block';
                                if (btnUploadBulk) btnUploadBulk.disabled = validItems.length === 0;
                            };
                            reader.readAsText(file);
                        };
                    }

                    // Bulk CSV upload handler
                    if (btnUploadBulk) {
                        btnUploadBulk.onclick = async () => {
                            const validItems = currentParsedItems.filter(x => x.isValid);
                            if (validItems.length === 0) return;

                            try {
                                btnUploadBulk.disabled = true;
                                btnUploadBulk.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Subiendo productos...';

                                const res = await API.post('/catalog/bulk', { items: validItems });
                                UI.showToast(res.message || 'Ítems cargados exitosamente.', 'success');

                                bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                                this.renderServicioPOS(container, serviceType, title, subtitle, iconClass);
                            } catch (err) {
                                UI.showToast(err.message, 'danger');
                                btnUploadBulk.disabled = false;
                                btnUploadBulk.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i>Confirmar y Subir Masivamente';
                            }
                        };
                    }
                };
            }

            // Edit catalog item (Admin)
            container.querySelectorAll('.btn-edit-catalog').forEach(btn => {
                btn.onclick = () => {
                    const itemId = btn.dataset.id;
                    const item = catalog.find(x => x.id === itemId);
                    if (!item) return;

                    UI.showModal({
                        title: `Editar Ítem: ${item.name}`,
                        bodyHtml: `
                            <form id="formEditCatItem">
                                <div class="mb-3">
                                    <label class="form-label">Nombre</label>
                                    <input type="text" class="form-control" id="catEditName" value="${item.name}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Descripción</label>
                                    <input type="text" class="form-control" id="catEditDesc" value="${item.description || ''}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Precio ($USD)</label>
                                    <input type="number" step="0.01" class="form-control" id="catEditPrice" value="${item.price_usd}" required>
                                </div>
                                <div class="form-check form-switch mb-3">
                                    <input class="form-check-input" type="checkbox" id="catEditAvailable" ${item.is_available ? 'checked' : ''}>
                                    <label class="form-check-label fw-bold" for="catEditAvailable">Disponible para Venta</label>
                                </div>
                            </form>
                        `,
                        footerHtml: `
                            <div class="d-flex justify-content-between w-100">
                                <button type="button" class="btn btn-outline-danger" id="btnDeleteCatItem"><i class="bi bi-trash me-1"></i>Eliminar</button>
                                <div>
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="button" class="btn btn-primary" id="btnUpdateCatItem">Guardar Cambios</button>
                                </div>
                            </div>
                        `
                    });

                    document.getElementById('btnDeleteCatItem').onclick = async () => {
                        try {
                            await API.delete('/catalog?id=' + item.id);
                            UI.showToast('Ítem eliminado.', 'info');
                            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                            this.renderServicioPOS(container, serviceType, title, subtitle, iconClass);
                        } catch (e) {
                            UI.showToast(e.message, 'danger');
                        }
                    };

                    document.getElementById('btnUpdateCatItem').onclick = async () => {
                        const name = document.getElementById('catEditName').value;
                        const description = document.getElementById('catEditDesc').value;
                        const priceUsd = document.getElementById('catEditPrice').value;
                        const isAvailable = document.getElementById('catEditAvailable').checked;

                        try {
                            await API.put('/catalog', { itemId: item.id, name, description, priceUsd, isAvailable });
                            UI.showToast('Ítem actualizado.', 'success');
                            bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                            this.renderServicioPOS(container, serviceType, title, subtitle, iconClass);
                        } catch (e) {
                            UI.showToast(e.message, 'danger');
                        }
                    };
                };
            });

            // Quick charge button from list
            container.querySelectorAll('.btn-quick-charge').forEach(btn => {
                btn.onclick = () => {
                    const itemId = btn.dataset.id;
                    const posSelect = container.querySelector('#posItemId');
                    if (posSelect) posSelect.value = itemId;
                };
            });

            // Submit POS charge
            const formPos = container.querySelector('#formPosCharge');
            if (formPos) {
                formPos.onsubmit = async (e) => {
                    e.preventDefault();
                    const bookingId = document.getElementById('posBookingId').value;
                    const itemId = document.getElementById('posItemId').value;
                    const quantity = document.getElementById('posQuantity').value;
                    const notes = document.getElementById('posNotes').value;

                    if (!bookingId || !itemId) {
                        UI.showToast('Seleccione la habitación y el producto del catálogo.', 'warning');
                        return;
                    }

                    try {
                        const res = await API.post('/catalog/charge', { bookingId, itemId, quantity, notes });
                        UI.showToast(res.message, 'success');
                        formPos.reset();
                    } catch (err) {
                        UI.showToast(err.message, 'danger');
                    }
                };
            }
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    }
};
