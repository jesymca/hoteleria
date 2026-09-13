// Bootstrap 5.3 UI Helper Module (Zero Alert / Zero Confirm Policy)

export const UI = {
    showToast(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastId = 'toast_' + Date.now();
        const bgClass = type === 'success' ? 'bg-success text-white' :
                        type === 'danger' ? 'bg-danger text-white' :
                        type === 'warning' ? 'bg-warning text-dark' : 'bg-info text-white';

        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body font-medium">
                        <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHtml);
        const toastEl = document.getElementById(toastId);
        const bsToast = new bootstrap.Toast(toastEl, { delay: duration });
        bsToast.show();

        toastEl.addEventListener('hidden.bs.toast', () => {
            toastEl.remove();
        });
    },

    confirm({ title, message, confirmText = 'Confirmar', confirmBtnClass = 'btn-primary', onConfirm }) {
        const modalEl = document.getElementById('dynamicModal');
        const modalTitle = document.getElementById('dynamicModalTitle');
        const modalBody = document.getElementById('dynamicModalBody');
        const modalFooter = document.getElementById('dynamicModalFooter');

        modalTitle.textContent = title || 'Confirmación';
        modalBody.innerHTML = `<p class="fs-5 mb-0">${message}</p>`;

        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn ${confirmBtnClass}" id="dynamicModalConfirmBtn">${confirmText}</button>
        `;

        const bsModal = new bootstrap.Modal(modalEl);
        bsModal.show();

        const confirmBtn = document.getElementById('dynamicModalConfirmBtn');
        confirmBtn.onclick = () => {
            bsModal.hide();
            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        };
    },

    showModal({ title, bodyHtml, footerHtml }) {
        const modalEl = document.getElementById('dynamicModal');
        const modalTitle = document.getElementById('dynamicModalTitle');
        const modalBody = document.getElementById('dynamicModalBody');
        const modalFooter = document.getElementById('dynamicModalFooter');

        modalTitle.textContent = title;
        modalBody.innerHTML = bodyHtml;
        modalFooter.innerHTML = footerHtml || `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>`;

        let bsModal = bootstrap.Modal.getInstance(modalEl);
        if (!bsModal) {
            bsModal = new bootstrap.Modal(modalEl);
        }
        bsModal.show();
        return bsModal;
    }
};

if (typeof document !== 'undefined') {
    document.addEventListener('hidden.bs.modal', () => {
        setTimeout(() => {
            const visibleModals = document.querySelectorAll('.modal.show');
            if (visibleModals.length === 0) {
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                document.body.style.removeProperty('overflow');
                document.body.style.removeProperty('padding-right');
            }
        }, 150);
    });
}
