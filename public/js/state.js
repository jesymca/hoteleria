// State Management Module for SPA
export const State = {
    tokenKey: 'saas_hotel_jwt',
    userKey: 'saas_hotel_user',
    hotelKey: 'saas_hotel_data',
    bcvKey: 'saas_bcv_rate',

    getToken() {
        return localStorage.getItem(this.tokenKey);
    },

    getUser() {
        const u = localStorage.getItem(this.userKey);
        return u ? JSON.parse(u) : null;
    },

    getHotel() {
        const h = localStorage.getItem(this.hotelKey);
        return h ? JSON.parse(h) : null;
    },

    getBcvRate() {
        const b = localStorage.getItem(this.bcvKey);
        return b ? JSON.parse(b) : { promedio: 40.0, fechaActualizacion: new Date().toISOString() };
    },

    setSession(token, user, hotel) {
        localStorage.setItem(this.tokenKey, token);
        localStorage.setItem(this.userKey, JSON.stringify(user));
        if (hotel) {
            localStorage.setItem(this.hotelKey, JSON.stringify(hotel));
        } else {
            localStorage.removeItem(this.hotelKey);
        }
    },

    setHotel(hotel) {
        if (hotel) {
            localStorage.setItem(this.hotelKey, JSON.stringify(hotel));
        }
    },

    setBcvRate(rateData) {
        localStorage.setItem(this.bcvKey, JSON.stringify(rateData));
    },

    clearSession() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.hotelKey);
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    isSuperAdmin() {
        const u = this.getUser();
        return u && u.role === 'SUPERADMIN';
    },

    isHotelAdmin() {
        const u = this.getUser();
        return u && u.role === 'HOTEL_ADMIN';
    },

    isStaff() {
        const u = this.getUser();
        return u && u.role === 'HOTEL_STAFF';
    },

    isRecepcionOnly() {
        const u = this.getUser();
        if (!u) return false;
        if (u.role === 'HOTEL_STAFF') return true;
        return localStorage.getItem('saas_recepcion_mode') === 'true';
    },

    toggleRecepcionMode() {
        const current = localStorage.getItem('saas_recepcion_mode') === 'true';
        localStorage.setItem('saas_recepcion_mode', (!current).toString());
        return !current;
    },

    toggleDarkMode(isDark) {
        if (isDark) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    },

    initTheme() {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
        }
    }
};
