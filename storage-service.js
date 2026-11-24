// storage-service.js – Unified Client and Cloud Storage & Entitlement Service
// Handles Device Registration, Payment Requests, Screenshot Storage,
// Entitlements, Device Transfers, and Audit Logging.

(function () {
    const DEVICE_KEY = 'p24_device_id';
    const DB_NAME = 'p24_monetization_db';
    const DB_VERSION = 1;

    // 1. Device ID Management
    function getOrCreateDeviceId() {
        let id = localStorage.getItem(DEVICE_KEY);
        if (!id) {
            // Generate clean, persistent installation identifier
            const randPart = Array.from(crypto.getRandomValues(new Uint8Array(8)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            id = `P24-${randPart.toUpperCase()}`;
            localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    }

    // 2. Local IndexedDB Setup for Offline & Standalone Persistence
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('payment_requests')) {
                    const store = db.createObjectStore('payment_requests', { keyPath: 'id' });
                    store.createIndex('utr', 'utr', { unique: true });
                    store.createIndex('deviceId', 'deviceId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
                if (!db.objectStoreNames.contains('entitlements')) {
                    const store = db.createObjectStore('entitlements', { keyPath: 'id' });
                    store.createIndex('deviceId', 'deviceId', { unique: false });
                    store.createIndex('themeId', 'themeId', { unique: false });
                }
                if (!db.objectStoreNames.contains('transfer_requests')) {
                    db.createObjectStore('transfer_requests', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('audit_logs')) {
                    db.createObjectStore('audit_logs', { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function dbOperation(storeName, mode, callback) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const req = callback(store);
            tx.oncomplete = () => resolve(req ? req.result : undefined);
            tx.onerror = () => reject(tx.error);
        });
    }

    // 3. Storage Service Implementation
    const StorageService = {
        getDeviceId() {
            return getOrCreateDeviceId();
        },

        // --- PAYMENT REQUESTS ---
        async submitPaymentRequest({ themeId, utr, screenshotDataUrl }) {
            const deviceId = this.getDeviceId();
            const cleanUtr = String(utr || '').trim().toUpperCase();

            if (!themeId) throw new Error('Theme is required');
            if (!cleanUtr || cleanUtr.length < 6) throw new Error('Valid UTR / reference number (min 6 characters) is required');
            if (!screenshotDataUrl) throw new Error('Payment screenshot is required');

            // Check duplicate UTR locally
            const existing = await this.getPaymentRequestByUtr(cleanUtr);
            if (existing) {
                throw new Error(`Transaction reference ${cleanUtr} has already been submitted.`);
            }

            const user = window.AuthClient ? window.AuthClient.getUser() : null;
            const token = window.AuthClient ? window.AuthClient.getToken() : null;
            const userId = user ? user.userId : deviceId;

            const request = {
                id: 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                deviceId,
                userId,
                themeId,
                amount: 29,
                utr: cleanUtr,
                screenshot: screenshotDataUrl,
                status: 'pending', // 'pending' | 'approved' | 'rejected'
                rejectionReason: null,
                submittedAt: new Date().toISOString(),
                reviewedAt: null,
                reviewedBy: null
            };

            await dbOperation('payment_requests', 'readwrite', store => store.add(request));

            // Sync with Server API
            try {
                await fetch('/api/auth?action=payment-request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        userId,
                        themeId,
                        amount: 29,
                        utr: cleanUtr,
                        screenshot: screenshotDataUrl
                    })
                });
            } catch (e) {
                // Offline fallback - will be maintained in IndexedDB
            }

            // Sync with Supabase if configured
            if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.isConfigured()) {
                try {
                    await fetch(`${window.SUPABASE_CONFIG.url}/rest/v1/payment_requests`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': window.SUPABASE_CONFIG.anonKey,
                            'Authorization': `Bearer ${window.SUPABASE_CONFIG.anonKey}`
                        },
                        body: JSON.stringify({
                            id: request.id,
                            device_id: deviceId,
                            theme_id: themeId,
                            amount: 29,
                            utr: cleanUtr,
                            screenshot_url: screenshotDataUrl,
                            status: 'pending'
                        })
                    });
                } catch (err) {
                    console.warn('Supabase sync skipped / deferred:', err);
                }
            }

            return request;
        },

        async getPaymentRequests(filter = {}) {
            return new Promise(async (resolve, reject) => {
                const db = await openDB();
                const tx = db.transaction('payment_requests', 'readonly');
                const store = tx.objectStore('payment_requests');
                const req = store.getAll();
                req.onsuccess = () => {
                    let results = req.result || [];
                    if (filter.deviceId) {
                        results = results.filter(r => r.deviceId === filter.deviceId);
                    }
                    if (filter.status) {
                        results = results.filter(r => r.status === filter.status);
                    }
                    // Sort descending by date
                    results.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                    resolve(results);
                };
                req.onerror = () => reject(req.error);
            });
        },

        async getPaymentRequestByUtr(utr) {
            const clean = String(utr || '').trim().toUpperCase();
            return new Promise(async (resolve, reject) => {
                const db = await openDB();
                const tx = db.transaction('payment_requests', 'readonly');
                const store = tx.objectStore('payment_requests');
                const index = store.index('utr');
                const req = index.get(clean);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        },

        // --- ENTITLEMENTS ---
        async hasActiveEntitlement(themeId) {
            const deviceId = this.getDeviceId();
            const entitlements = await this.getEntitlements(deviceId);
            const now = new Date();
            const match = entitlements.find(e => 
                e.themeId === themeId &&
                e.status === 'active' &&
                new Date(e.expiresAt) > now
            );
            return Boolean(match);
        },

        async getEntitlements(deviceId = null) {
            const targetDevice = deviceId || this.getDeviceId();
            return new Promise(async (resolve, reject) => {
                const db = await openDB();
                const tx = db.transaction('entitlements', 'readonly');
                const store = tx.objectStore('entitlements');
                const req = store.getAll();
                req.onsuccess = () => {
                    let list = req.result || [];
                    if (targetDevice) {
                        list = list.filter(e => e.deviceId === targetDevice);
                    }
                    resolve(list);
                };
                req.onerror = () => reject(req.error);
            });
        },

        async getAllEntitlements() {
            return new Promise(async (resolve, reject) => {
                const db = await openDB();
                const tx = db.transaction('entitlements', 'readonly');
                const store = tx.objectStore('entitlements');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        },

        // --- ADMIN ACTIONS ---
        async approvePaymentRequest(requestId, adminId = 'admin') {
            const db = await openDB();
            const tx = db.transaction(['payment_requests', 'entitlements', 'audit_logs'], 'readwrite');
            const reqStore = tx.objectStore('payment_requests');
            const entStore = tx.objectStore('entitlements');
            const auditStore = tx.objectStore('audit_logs');

            return new Promise((resolve, reject) => {
                const getReq = reqStore.get(requestId);
                getReq.onsuccess = () => {
                    const request = getReq.result;
                    if (!request) {
                        reject(new Error('Request not found'));
                        return;
                    }

                    // 1. Update request status
                    const now = new Date();
                    request.status = 'approved';
                    request.reviewedAt = now.toISOString();
                    request.reviewedBy = adminId;
                    reqStore.put(request);

                    // 2. Create 1-year entitlement associated with the device
                    const expires = new Date(now);
                    expires.setFullYear(expires.getFullYear() + 1);

                    const entitlement = {
                        id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        deviceId: request.deviceId,
                        themeId: request.themeId,
                        paymentRequestId: request.id,
                        status: 'active',
                        activatedAt: now.toISOString(),
                        expiresAt: expires.toISOString(),
                        createdAt: now.toISOString()
                    };
                    entStore.put(entitlement);

                    // 3. Log admin action
                    const log = {
                        id: 'log_' + Date.now(),
                        action: 'APPROVE_PAYMENT',
                        targetType: 'payment_request',
                        targetId: requestId,
                        details: {
                            themeId: request.themeId,
                            deviceId: request.deviceId,
                            utr: request.utr,
                            expiresAt: expires.toISOString()
                        },
                        performedBy: adminId,
                        timestamp: now.toISOString()
                    };
                    auditStore.put(log);

                    tx.oncomplete = () => {
                        window.dispatchEvent(new CustomEvent('p24-entitlements-updated'));
                        resolve({ request, entitlement });
                    };
                    tx.onerror = () => reject(tx.error);
                };
            });
        },

        async rejectPaymentRequest(requestId, reason = 'Payment verification failed', adminId = 'admin') {
            const db = await openDB();
            const tx = db.transaction(['payment_requests', 'audit_logs'], 'readwrite');
            const reqStore = tx.objectStore('payment_requests');
            const auditStore = tx.objectStore('audit_logs');

            return new Promise((resolve, reject) => {
                const getReq = reqStore.get(requestId);
                getReq.onsuccess = () => {
                    const request = getReq.result;
                    if (!request) {
                        reject(new Error('Request not found'));
                        return;
                    }

                    const now = new Date();
                    request.status = 'rejected';
                    request.rejectionReason = reason;
                    request.reviewedAt = now.toISOString();
                    request.reviewedBy = adminId;
                    reqStore.put(request);

                    const log = {
                        id: 'log_' + Date.now(),
                        action: 'REJECT_PAYMENT',
                        targetType: 'payment_request',
                        targetId: requestId,
                        details: {
                            themeId: request.themeId,
                            deviceId: request.deviceId,
                            utr: request.utr,
                            reason
                        },
                        performedBy: adminId,
                        timestamp: now.toISOString()
                    };
                    auditStore.put(log);

                    tx.oncomplete = () => {
                        window.dispatchEvent(new CustomEvent('p24-entitlements-updated'));
                        resolve(request);
                    };
                    tx.onerror = () => reject(tx.error);
                };
            });
        },

        // --- DEVICE TRANSFER ---
        async submitTransferRequest({ entitlementId, oldDeviceId, newDeviceId, themeId }) {
            if (!entitlementId || !oldDeviceId || !newDeviceId) {
                throw new Error('All transfer fields are required');
            }
            if (oldDeviceId === newDeviceId) {
                throw new Error('Old device ID and New device ID cannot be identical');
            }

            const transfer = {
                id: 'trf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                entitlementId,
                oldDeviceId,
                newDeviceId,
                themeId,
                status: 'pending', // 'pending' | 'approved' | 'rejected'
                requestedAt: new Date().toISOString(),
                reviewedAt: null,
                reviewedBy: null
            };

            await dbOperation('transfer_requests', 'readwrite', store => store.add(transfer));
            return transfer;
        },

        async getTransferRequests() {
            return new Promise(async (resolve, reject) => {
                const db = await openDB();
                const tx = db.transaction('transfer_requests', 'readonly');
                const store = tx.objectStore('transfer_requests');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        },

        async approveTransferRequest(transferId, adminId = 'admin') {
            const db = await openDB();
            const tx = db.transaction(['transfer_requests', 'entitlements', 'audit_logs'], 'readwrite');
            const trfStore = tx.objectStore('transfer_requests');
            const entStore = tx.objectStore('entitlements');
            const auditStore = tx.objectStore('audit_logs');

            return new Promise((resolve, reject) => {
                const getTrf = trfStore.get(transferId);
                getTrf.onsuccess = () => {
                    const transfer = getTrf.result;
                    if (!transfer) {
                        reject(new Error('Transfer request not found'));
                        return;
                    }

                    const getEnt = entStore.get(transfer.entitlementId);
                    getEnt.onsuccess = () => {
                        const entitlement = getEnt.result;
                        if (!entitlement) {
                            reject(new Error('Associated entitlement not found'));
                            return;
                        }

                        const now = new Date();
                        // 1. Mark transfer approved
                        transfer.status = 'approved';
                        transfer.reviewedAt = now.toISOString();
                        transfer.reviewedBy = adminId;
                        trfStore.put(transfer);

                        // 2. Revoke old device entitlement
                        entitlement.status = 'revoked';
                        entStore.put(entitlement);

                        // 3. Create entitlement for new device PRESERVING original expiration!
                        const newEntitlement = {
                            id: 'ent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                            deviceId: transfer.newDeviceId,
                            themeId: transfer.themeId,
                            paymentRequestId: entitlement.paymentRequestId,
                            status: 'active',
                            activatedAt: entitlement.activatedAt,
                            expiresAt: entitlement.expiresAt, // PRESERVES EXACT EXPIRATION
                            createdAt: now.toISOString(),
                            transferredFrom: transfer.oldDeviceId
                        };
                        entStore.put(newEntitlement);

                        // 4. Audit log
                        const log = {
                            id: 'log_' + Date.now(),
                            action: 'APPROVE_DEVICE_TRANSFER',
                            targetType: 'device_transfer',
                            targetId: transferId,
                            details: {
                                themeId: transfer.themeId,
                                oldDeviceId: transfer.oldDeviceId,
                                newDeviceId: transfer.newDeviceId,
                                originalExpiresAt: entitlement.expiresAt
                            },
                            performedBy: adminId,
                            timestamp: now.toISOString()
                        };
                        auditStore.put(log);

                        tx.oncomplete = () => {
                            window.dispatchEvent(new CustomEvent('p24-entitlements-updated'));
                            resolve({ transfer, newEntitlement });
                        };
                        tx.onerror = () => reject(tx.error);
                    };
                };
            });
        },

        // --- AUDIT LOGS ---
        async getAuditLogs() {
            return new Promise(async (resolve, reject) => {
                const db = await openDB();
                const tx = db.transaction('audit_logs', 'readonly');
                const store = tx.objectStore('audit_logs');
                const req = store.getAll();
                req.onsuccess = () => {
                    const list = req.result || [];
                    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    resolve(list);
                };
                req.onerror = () => reject(req.error);
            });
        }
    };

    window.StorageService = StorageService;
})();
