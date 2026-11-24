// auth-client.js – Frontend Client Authentication Library for Project 24
// Enforces No-OTP User Registration, Session Persistence across reloads,
// Automatic Session Restoration, and Super Admin Security Isolation.

(function () {
    const TOKEN_KEY = 'p24_session_token';
    const USER_KEY = 'p24_user_data';
    const ADMIN_TOKEN_KEY = 'p24_admin_token';
    const ADMIN_USER_KEY = 'p24_admin_data';

    function getDeviceId() {
        if (window.StorageService && typeof window.StorageService.getDeviceId === 'function') {
            return window.StorageService.getDeviceId();
        }
        let id = localStorage.getItem('p24_device_id');
        if (!id) {
            const randPart = Array.from(crypto.getRandomValues(new Uint8Array(8)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            id = `P24-${randPart.toUpperCase()}`;
            localStorage.setItem('p24_device_id', id);
        }
        return id;
    }

    const AuthClient = {
        getDeviceId() {
            return getDeviceId();
        },

        getToken() {
            return localStorage.getItem(TOKEN_KEY) || null;
        },

        getUser() {
            try {
                const raw = localStorage.getItem(USER_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        getUserId() {
            const user = this.getUser();
            return user ? user.userId : null;
        },

        isAuthenticated() {
            return Boolean(this.getToken() && this.getUser());
        },

        setSession(token, user) {
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(USER_KEY, JSON.stringify(user));
        },

        clearSession() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        },

        // Super Admin Tokens
        getAdminToken() {
            return sessionStorage.getItem(ADMIN_TOKEN_KEY) || null;
        },

        isSuperAdmin() {
            return Boolean(sessionStorage.getItem(ADMIN_TOKEN_KEY) && sessionStorage.getItem('p24_admin_auth') === 'true');
        },

        setAdminSession(token, user) {
            sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
            sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
            sessionStorage.setItem('p24_admin_auth', 'true');
        },

        clearAdminSession() {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            sessionStorage.removeItem(ADMIN_USER_KEY);
            sessionStorage.removeItem('p24_admin_auth');
        },

        // 1. NO-OTP User Registration
        async register({ fullName, mobileNumber, email }) {
            const deviceId = this.getDeviceId();
            const res = await fetch('/api/auth?action=register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': deviceId
                },
                body: JSON.stringify({ fullName, mobileNumber, email, deviceId })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to complete registration');
            }

            // Persist session
            this.setSession(data.token, data.user);
            return data;
        },

        // 2. Super Admin Login (Dedicated Passcode/Password Authentication)
        async loginAdmin({ email, password }) {
            const res = await fetch('/api/auth?action=admin-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Invalid administrator credentials');
            }

            this.setAdminSession(data.token, data.user);
            return data;
        },

        // 3. Validate Session with Backend
        async validateSession() {
            const token = this.getToken();
            if (!token) return null;

            try {
                const deviceId = this.getDeviceId();
                const res = await fetch('/api/auth?action=session', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Device-Id': deviceId
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
                        this.setSession(token, data.user);
                        return data.user;
                    }
                }
                // If invalid or revoked session
                this.clearSession();
                return null;
            } catch (err) {
                // Network failure: preserve local session for offline PWA continuity
                return this.getUser();
            }
        },

        // 4. Require Authentication Gate for Protected Pages
        async requireAuth(options = {}) {
            const user = this.getUser();
            const token = this.getToken();

            if (!token || !user) {
                const currentPath = window.location.pathname.split('/').pop() || 'index.html';
                window.location.replace(`login.html?redirect=${encodeURIComponent(currentPath)}`);
                return null;
            }

            // Validate in background if online
            if (navigator.onLine) {
                this.validateSession().catch(() => {});
            }

            return user;
        },

        // 5. Admin: Logout
        async logoutAdmin() {
            const token = this.getAdminToken();
            try {
                if (token) {
                    await fetch('/api/auth?action=admin-logout', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            } catch (e) {}
            this.clearAdminSession();
        }
    };

    window.AuthClient = AuthClient;
})();
