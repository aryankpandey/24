// auth-client.js – Frontend Client Authentication Library for Project 24
// Communicates with /api/auth endpoints, manages session state,
// enforces authentication gates and single-device session integrity.

(function () {
    const TOKEN_KEY = 'p24_session_token';
    const USER_KEY = 'p24_user_data';

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
            return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
        },

        getUser() {
            try {
                const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },

        isAuthenticated() {
            return Boolean(this.getToken() && this.getUser());
        },

        setSession(token, user, remember = true) {
            const storage = remember ? localStorage : sessionStorage;
            // Clear other storage
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);

            storage.setItem(TOKEN_KEY, token);
            storage.setItem(USER_KEY, JSON.stringify(user));
        },

        clearSession() {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            sessionStorage.removeItem(TOKEN_KEY);
            sessionStorage.removeItem(USER_KEY);
        },

        // API: Send OTP
        async sendOtp(email) {
            const deviceId = this.getDeviceId();
            const res = await fetch('/api/auth?action=send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': deviceId
                },
                body: JSON.stringify({ email, deviceId })
            });

            const data = await res.json();
            if (!res.ok) {
                const err = new Error(data.error || 'Failed to send verification code');
                err.conflict = Boolean(data.conflict);
                throw err;
            }
            return data;
        },

        // API: Verify OTP & Login
        async verifyOtp(email, otp) {
            const deviceId = this.getDeviceId();
            const res = await fetch('/api/auth?action=verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': deviceId
                },
                body: JSON.stringify({ email, otp, deviceId })
            });

            const data = await res.json();
            if (!res.ok) {
                const err = new Error(data.error || 'Failed to verify code');
                err.conflict = Boolean(data.conflict);
                throw err;
            }

            // Save active session
            this.setSession(data.sessionToken, data.user, true);
            return data;
        },

        // API: Validate Session with Backend
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

                if (!res.ok) {
                    this.clearSession();
                    return null;
                }

                const data = await res.json();
                if (data.authenticated && data.user) {
                    // Refresh stored user info
                    this.setSession(token, data.user, true);
                    return data.user;
                } else {
                    this.clearSession();
                    return null;
                }
            } catch (e) {
                // Network failure: in offline mode, return cached user
                return this.getUser();
            }
        },

        // API: Logout
        async logout() {
            const token = this.getToken();
            if (token) {
                try {
                    await fetch('/api/auth?action=logout', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                } catch (e) {
                    console.warn('Backend logout sync deferred:', e);
                }
            }
            this.clearSession();
            window.location.href = 'login.html';
        },

        // Authentication Gate for Protected Pages
        async requireAuth() {
            const isLoginPage = window.location.pathname.endsWith('login.html');
            if (isLoginPage) return;

            const user = this.getUser();
            const token = this.getToken();

            if (!user || !token) {
                const current = window.location.pathname.split('/').pop() || 'index.html';
                window.location.replace(`login.html?redirect=${encodeURIComponent(current)}`);
                return;
            }

            // Asynchronously verify with backend
            this.validateSession().then(validUser => {
                if (!validUser) {
                    window.location.replace('login.html?reason=session_expired');
                }
            });
        }
    };

    window.AuthClient = AuthClient;
})();
