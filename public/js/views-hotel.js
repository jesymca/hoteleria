// Hotel Views Module (Rack, Housekeeping/Mucamas, Bookings, Guests, Consumos, Billing, Departments, Settings, Payments)
import { API } from './api.js';
import { State } from './state.js';
import { UI } from './ui.js';
import { Uploader } from './uploader.js';
import { PDFService } from './pdf-service.js';

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
                        <p class="text-muted mb-0">Estado en tiempo real de la capacidad del establecimiento</p>
                    </div>
                    <div class="d-flex gap-2">
                        ${!isStaff ? `
                            <button class="btn btn-outline-primary" id="btnCreateRoomType"><i class="bi bi-tags-fill me-1"></i>Nuevo Estilo/Tipo</button>
                            <button class="btn btn-primary" id="btnCreateRoom"><i class="bi bi-plus-lg me-1"></i>Nueva Habitación</button>
                        ` : ''}
                        <button class="btn btn-success" id="btnQuickCleaningView"><i class="bi bi-stars me-1"></i>Vista Mucamas / Limpieza</button>
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
                                <div class="text-muted small">En Limpieza (Mucamas)</div>
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
                                <div class="mt-auto d-flex flex-wrap gap-1">
                                    ${room.status === 'CLEANING' ? `
                                        <button class="btn btn-sm btn-success w-100 btn-mark-clean" data-id="${room.id}">
                                            <i class="bi bi-stars me-1"></i>Marcar Limpia y Lista
                                        </button>
                                    ` : room.status === 'AVAILABLE' ? `
                                        <button class="btn btn-sm btn-outline-danger btn-set-status" data-id="${room.id}" data-status="CLEANING">
                                            <i class="bi bi-brush me-1"></i>Enviar a Limpieza
                                        </button>
                                        <button class="btn btn-sm btn-outline-warning btn-set-status" data-id="${room.id}" data-status="MAINTENANCE">
                                            <i class="bi bi-tools me-1"></i>Mantenimiento
                                        </button>
                                    ` : room.status === 'MAINTENANCE' ? `
                                        <button class="btn btn-sm btn-outline-success btn-set-status" data-id="${room.id}" data-status="AVAILABLE">
                                            <i class="bi bi-check-circle me-1"></i>Habilitar Disponible
                                        </button>
                                    ` : `
                                        <span class="badge bg-secondary w-100 py-2">En ocupación por huésped</span>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            html += `</div>`;
            container.innerHTML = html;

            // Bind Action Listeners
            this.bindRackEvents(container, types);
        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
        }
    },

    bindRackEvents(container, types) {
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

        // Create Room Type
        const btnCreateType = container.querySelector('#btnCreateRoomType');
        if (btnCreateType) {
            btnCreateType.onclick = () => {
                UI.showModal({
                    title: 'Crear Nuevo Tipo/Estilo de Habitación',
                    bodyHtml: `
                        <form id="formRoomType">
                            <div class="mb-3">
                                <label class="form-label">Nombre del Estilo/Tipo (Libre)</label>
                                <input type="text" class="form-control" id="rtName" placeholder="Ej: Suite VIP Vista al Mar, Cabaña Marina, Matrimonial Deluxe" required>
                            </div>
                            <div class="row">
                                <div class="col-6 mb-3">
                                    <label class="form-label">Precio Base por Noche ($USD)</label>
                                    <input type="number" step="0.01" class="form-control" id="rtPrice" placeholder="50.00" required>
                                </div>
                                <div class="col-6 mb-3">
                                    <label class="form-label">Capacidad de Huéspedes</label>
                                    <input type="number" class="form-control" id="rtCap" value="2" required>
                                </div>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSaveRoomType">Guardar Estilo</button>
                    `
                });

                document.getElementById('btnSaveRoomType').onclick = async () => {
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
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderRack(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };
        }

        // Create Room
        const btnCreateRoom = container.querySelector('#btnCreateRoom');
        if (btnCreateRoom) {
            btnCreateRoom.onclick = () => {
                let typeOptions = types.map(t => `<option value="${t.id}">${t.name} ($${t.base_price_usd}/noche)</option>`).join('');
                UI.showModal({
                    title: 'Agregar Nueva Habitación al Rack',
                    bodyHtml: `
                        <form id="formRoom">
                            <div class="mb-3">
                                <label class="form-label">Número de Habitación / Identificador</label>
                                <input type="text" class="form-control" id="rmNumber" placeholder="Ej: 101, 202-B, Cabaña 3" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Tipo / Estilo</label>
                                <select class="form-select" id="rmType" required>
                                    ${typeOptions}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Observaciones / Detalles</label>
                                <textarea class="form-control" id="rmNotes" rows="2" placeholder="Ej: Vista a la piscina, cama King"></textarea>
                            </div>
                        </form>
                    `,
                    footerHtml: `
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnSaveRoom">Guardar Habitación</button>
                    `
                });

                document.getElementById('btnSaveRoom').onclick = async () => {
                    const roomNumber = document.getElementById('rmNumber').value;
                    const roomTypeId = document.getElementById('rmType').value;
                    const notes = document.getElementById('rmNotes').value;

                    if (!roomNumber) {
                        UI.showToast('Debe ingresar el número de habitación.', 'warning');
                        return;
                    }

                    try {
                        await API.post('/rooms', { roomNumber, roomTypeId, notes });
                        UI.showToast('Habitación registrada exitosamente.', 'success');
                        bootstrap.Modal.getInstance(document.getElementById('dynamicModal')).hide();
                        this.renderRack(container);
                    } catch (e) {
                        UI.showToast(e.message, 'danger');
                    }
                };
            };
        }
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

    // 5. FACTURACIÓN E IMPRESIÓN PDF CON TASA BCV
    async renderFacturacion(container) {
        container.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>`;

        try {
            const invoices = await API.get('/billing/invoices');
            const hotel = State.getHotel();

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-file-earmark-pdf-fill text-primary me-2"></i>Facturación e Historial</h2>
                        <p class="text-muted mb-0">Emisión formal de comprobantes en PDF con Tasa Oficial BCV</p>
                    </div>
                </div>

                <div class="card border-0 shadow-sm rounded-3">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>N° Factura</th>
                                        <th>Huésped</th>
                                        <th>Habitación</th>
                                        <th>Total USD</th>
                                        <th>Tasa BCV</th>
                                        <th>Total VES</th>
                                        <th>Fecha</th>
                                        <th class="text-end">Descargar</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;

            if (invoices.length === 0) {
                html += `<tr><td colspan="8" class="text-center py-4 text-muted">No hay facturas emitidas aún. Realice un Check-out para generar un comprobante.</td></tr>`;
            } else {
                invoices.forEach(inv => {
                    html += `
                        <tr>
                            <td><strong class="text-primary">${inv.invoice_number}</strong></td>
                            <td>${inv.guest_name}</td>
                            <td>Hab. ${inv.room_number}</td>
                            <td class="fw-bold">$${Number(inv.total_usd).toFixed(2)} USD</td>
                            <td>Bs. ${Number(inv.bcv_rate).toFixed(4)}</td>
                            <td class="fw-bold text-success">Bs. ${Number(inv.total_ves).toFixed(2)}</td>
                            <td class="small text-muted">${new Date(inv.created_at).toLocaleDateString('es-VE')}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-primary btn-download-pdf" data-inv='${JSON.stringify(inv)}'>
                                    <i class="bi bi-file-earmark-pdf me-1"></i>PDF Comprobante
                                </button>
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

            container.querySelectorAll('.btn-download-pdf').forEach(btn => {
                btn.onclick = async () => {
                    const inv = JSON.parse(btn.getAttribute('data-inv'));
                    const expenses = await API.get(`/expenses?bookingId=${inv.booking_id}`);
                    const booking = {
                        guest_name: inv.guest_name,
                        document_type: inv.document_type,
                        document_id: inv.document_id,
                        room_number: inv.room_number,
                        check_in_date: inv.check_in_date,
                        check_out_date: inv.check_out_date
                    };
                    await PDFService.generateInvoicePDF(hotel, booking, inv, expenses);
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
                    <div class="d-flex gap-2">
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

                staffListContainer.innerHTML = filteredStaff.map(s => `
                    <div class="list-group-item d-flex justify-content-between align-items-center px-2 py-3 border-bottom">
                        <div class="d-flex align-items-center gap-3">
                            <div class="avatar-circle bg-primary-subtle text-primary fw-bold rounded-circle d-flex align-items-center justify-content-center" style="width: 42px; height: 42px; font-size: 1.1rem;">
                                ${(s.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="fw-bold text-dark mb-0">${s.name}</div>
                                <div class="small text-muted mb-1">
                                    <i class="bi bi-envelope me-1"></i>${s.email}
                                    ${s.phone ? `<span class="ms-2"><i class="bi bi-whatsapp me-1 text-success"></i>${s.phone}</span>` : ''}
                                </div>
                                <span class="badge bg-info text-dark">${s.department_name || 'Sin área fija (General)'}</span>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-primary btn-edit-staff px-2" data-id="${s.id}" title="Editar usuario staff">
                            <i class="bi bi-pencil-fill me-1"></i>Editar
                        </button>
                    </div>
                `).join('');

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
                                    <option value="SPA">Spa / Peluquería</option>
                                    <option value="EXCURSION">Excursiones / Turismo</option>
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
                UI.showModal({
                    title: 'Crear Usuario de Personal (Staff)',
                    bodyHtml: `
                        <form id="formStaff">
                            <div class="mb-3">
                                <label class="form-label">Nombre Completo</label>
                                <input type="text" class="form-control" id="stName" placeholder="Ej: María Pérez (Mucama), Juan Barman" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Correo Electrónico (Para Login)</label>
                                <input type="email" class="form-control" id="stEmail" placeholder="mucama@posada.com" required>
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
                                <label class="form-label">Área / Departamento Asignado</label>
                                <select class="form-select" id="stDept">
                                    <option value="">Recepción / General</option>
                                    ${deptOptions}
                                </select>
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
                            departmentId
                        });
                        UI.showToast('Usuario de personal creado exitosamente.', 'success');
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
                            <option value="SPA" ${dept.type === 'SPA' ? 'selected' : ''}>Spa / Peluquería</option>
                            <option value="EXCURSION" ${dept.type === 'EXCURSION' ? 'selected' : ''}>Excursiones / Turismo</option>
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
                        <label class="form-label">Área / Departamento Asignado</label>
                        <select class="form-select" id="stEditDept">
                            <option value="">Recepción / General</option>
                            ${deptOptions}
                        </select>
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
                    newPassword
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
                            <button type="submit" class="btn btn-primary btn-lg mt-3"><i class="bi bi-save me-1"></i>Guardar Ajustes</button>
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
            const primary_color = document.getElementById('profColor').value;
            const dark_mode = document.getElementById('profDarkMode').checked;

            try {
                const updatedHotel = await API.put('/hotels', {
                    name, rif, phone, address, logo_url: currentLogoUrl, primary_color, dark_mode
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

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                    <div>
                        <h2 class="fw-bold mb-1"><i class="bi bi-credit-card-2-front-fill text-primary me-2"></i>Estado de Membresía SaaS</h2>
                        <p class="text-muted mb-0">Gestión de suscripción mensual ($${monthlyFee} USD/mes) y reporte de comprobantes</p>
                    </div>
                    <button class="btn btn-primary" id="btnReportPayment"><i class="bi bi-upload me-1"></i>Reportar Pago de Membresía</button>
                </div>

                <div class="row g-4 mb-4">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-4 h-100">
                            <h5 class="fw-bold text-primary mb-3">Estatus de la Licencia de Uso</h5>
                            <div class="mb-2">
                                <span class="text-muted">Estado Actual:</span>
                                <span class="badge ${hotel.status === 'ACTIVE' ? 'bg-success' : 'bg-warning text-dark'} fs-6 ms-2">${hotel.status}</span>
                            </div>
                            <div class="mb-2">
                                <span class="text-muted">Días de Prueba Hasta:</span>
                                <strong>${hotel.trial_ends_at ? new Date(hotel.trial_ends_at).toLocaleDateString('es-VE') : 'N/A'}</strong>
                            </div>
                            <div>
                                <span class="text-muted">Próximo Vencimiento:</span>
                                <strong>${hotel.subscription_due_date ? new Date(hotel.subscription_due_date).toLocaleDateString('es-VE') : 'Al finalizar el periodo de prueba'}</strong>
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
    }
};
