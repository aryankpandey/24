// admin.js – Private Administrator Dashboard Logic
// Handles Secure Authentication, Payment Verification, Approvals, Rejections,
// Entitlement Management, Device Transfers, and Audit Logging.

document.addEventListener('DOMContentLoaded', () => {
    const authOverlay = document.getElementById('adminAuthOverlay');
    const authForm = document.getElementById('adminAuthForm');
    const authPassInput = document.getElementById('adminPassInput');
    const authAlert = document.getElementById('adminAuthAlert');
    const adminMain = document.getElementById('adminMain');
    const logoutBtn = document.getElementById('adminLogoutBtn');

    // Metrics elements
    const metricTotalEl = document.getElementById('metricTotal');
    const metricPendingEl = document.getElementById('metricPending');
    const metricApprovedEl = document.getElementById('metricApproved');
    const metricRejectedEl = document.getElementById('metricRejected');

    // Tabs
    const tabRequests = document.getElementById('tabRequests');
    const tabEntitlements = document.getElementById('tabEntitlements');
    const tabTransfers = document.getElementById('tabTransfers');
    const tabLogs = document.getElementById('tabLogs');

    const viewRequests = document.getElementById('viewRequests');
    const viewEntitlements = document.getElementById('viewEntitlements');
    const viewTransfers = document.getElementById('viewTransfers');
    const viewLogs = document.getElementById('viewLogs');

    // Request filter buttons
    const filterAllBtn = document.getElementById('filterAllBtn');
    const filterPendingBtn = document.getElementById('filterPendingBtn');
    const filterApprovedBtn = document.getElementById('filterApprovedBtn');
    const filterRejectedBtn = document.getElementById('filterRejectedBtn');

    // List containers
    const requestsListEl = document.getElementById('requestsList');
    const entitlementsListEl = document.getElementById('entitlementsList');
    const transfersListEl = document.getElementById('transfersList');
    const logsListEl = document.getElementById('logsList');

    // Screenshot Zoom Modal
    const zoomModal = document.getElementById('imgZoomModal');
    const zoomImg = document.getElementById('imgZoomTarget');

    let currentFilter = 'all';
    const ADMIN_PASS_HASH = '24admin'; // Default administrator passcode

    // Check existing session
    if (sessionStorage.getItem('p24_admin_auth') === 'true') {
        unlockDashboard();
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pass = authPassInput.value.trim();
            if (pass === ADMIN_PASS_HASH) {
                sessionStorage.setItem('p24_admin_auth', 'true');
                unlockDashboard();
            } else {
                authAlert.textContent = 'Invalid administrator passcode';
                authAlert.style.display = 'block';
                authPassInput.value = '';
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('p24_admin_auth');
            location.reload();
        });
    }

    function unlockDashboard() {
        if (authOverlay) authOverlay.style.display = 'none';
        if (adminMain) adminMain.style.display = 'block';
        loadDashboardData();
    }

    // Tab Switching
    function setTab(activeTab, activeView) {
        [tabRequests, tabEntitlements, tabTransfers, tabLogs].forEach(t => t && t.classList.remove('active'));
        [viewRequests, viewEntitlements, viewTransfers, viewLogs].forEach(v => v && (v.style.display = 'none'));
        activeTab.classList.add('active');
        activeView.style.display = 'block';
    }

    if (tabRequests) tabRequests.addEventListener('click', () => { setTab(tabRequests, viewRequests); loadRequests(); });
    if (tabEntitlements) tabEntitlements.addEventListener('click', () => { setTab(tabEntitlements, viewEntitlements); loadEntitlements(); });
    if (tabTransfers) tabTransfers.addEventListener('click', () => { setTab(tabTransfers, viewTransfers); loadTransfers(); });
    if (tabLogs) tabLogs.addEventListener('click', () => { setTab(tabLogs, viewLogs); loadLogs(); });

    // Filter Buttons
    [
        { btn: filterAllBtn, filter: 'all' },
        { btn: filterPendingBtn, filter: 'pending' },
        { btn: filterApprovedBtn, filter: 'approved' },
        { btn: filterRejectedBtn, filter: 'rejected' }
    ].forEach(({ btn, filter }) => {
        if (btn) {
            btn.addEventListener('click', () => {
                [filterAllBtn, filterPendingBtn, filterApprovedBtn, filterRejectedBtn].forEach(b => b && b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = filter;
                loadRequests();
            });
        }
    });

    // Load Metrics
    async function loadMetrics() {
        const allRequests = await window.StorageService.getPaymentRequests();
        const pending = allRequests.filter(r => r.status === 'pending').length;
        const approved = allRequests.filter(r => r.status === 'approved').length;
        const rejected = allRequests.filter(r => r.status === 'rejected').length;

        if (metricTotalEl) metricTotalEl.textContent = allRequests.length;
        if (metricPendingEl) metricPendingEl.textContent = pending;
        if (metricApprovedEl) metricApprovedEl.textContent = approved;
        if (metricRejectedEl) metricRejectedEl.textContent = rejected;
    }

    // Load Payment Requests
    async function loadRequests() {
        if (!requestsListEl) return;
        const filter = currentFilter === 'all' ? {} : { status: currentFilter };
        const requests = await window.StorageService.getPaymentRequests(filter);

        if (requests.length === 0) {
            requestsListEl.innerHTML = `<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No ${currentFilter === 'all' ? '' : currentFilter} payment requests found.</div>`;
            return;
        }

        requestsListEl.innerHTML = '';
        requests.forEach(req => {
            const theme = window.ThemeManager.getTheme(req.themeId);
            const card = document.createElement('div');
            card.className = 'admin-card';

            let statusBadge = '';
            if (req.status === 'pending') {
                statusBadge = '<span class="theme-badge" style="color: #fbbf24; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3);">PENDING</span>';
            } else if (req.status === 'approved') {
                statusBadge = '<span class="theme-badge" style="color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3);">APPROVED</span>';
            } else {
                statusBadge = `<span class="theme-badge" style="color: #f87171; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3);">REJECTED</span>`;
            }

            let actionsHtml = '';
            if (req.status === 'pending') {
                actionsHtml = `
                    <button class="btn-admin-action approve" data-req-id="${req.id}">Approve (Unlock 1-Yr)</button>
                    <button class="btn-admin-action reject" data-req-id="${req.id}">Reject</button>
                `;
            }

            card.innerHTML = `
                <div class="admin-card-header">
                    <div>
                        <div class="admin-card-theme-title">${theme.name} Theme · ₹${req.amount}</div>
                        <div class="admin-card-utr">UTR / REF: <strong>${req.utr}</strong></div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <div class="admin-card-body">
                    ${req.screenshot ? `<img src="${req.screenshot}" class="admin-screenshot-thumb" alt="Payment Screenshot" title="Click to inspect full screenshot" />` : '<div style="font-size: 11px; color: #777;">No Image</div>'}
                    <div class="admin-card-meta-col">
                        <div><strong>Device:</strong> <code>${req.deviceId}</code></div>
                        <div><strong>Submitted:</strong> ${new Date(req.submittedAt).toLocaleString()}</div>
                        ${req.reviewedAt ? `<div><strong>Reviewed:</strong> ${new Date(req.reviewedAt).toLocaleString()} by ${req.reviewedBy}</div>` : ''}
                        ${req.rejectionReason ? `<div style="color: #f87171;"><strong>Reason:</strong> ${req.rejectionReason}</div>` : ''}
                    </div>
                </div>

                ${actionsHtml ? `<div class="admin-card-actions">${actionsHtml}</div>` : ''}
            `;

            // Screenshot click to zoom
            const thumb = card.querySelector('.admin-screenshot-thumb');
            if (thumb) {
                thumb.addEventListener('click', () => {
                    zoomImg.src = req.screenshot;
                    zoomModal.style.display = 'flex';
                });
            }

            requestsListEl.appendChild(card);
        });

        // Attach action handlers
        requestsListEl.querySelectorAll('.btn-admin-action.approve').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.reqId;
                if (confirm('Approve this payment and activate the 1-year theme entitlement for this device?')) {
                    btn.disabled = true;
                    btn.textContent = 'Activating...';
                    await window.StorageService.approvePaymentRequest(id);
                    loadDashboardData();
                }
            });
        });

        requestsListEl.querySelectorAll('.btn-admin-action.reject').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.reqId;
                const reason = prompt('Enter rejection reason (e.g. UTR not found in bank statement, amount mismatch):', 'Payment verification failed');
                if (reason) {
                    btn.disabled = true;
                    btn.textContent = 'Rejecting...';
                    await window.StorageService.rejectPaymentRequest(id, reason);
                    loadDashboardData();
                }
            });
        });
    }

    // Load Active Entitlements
    async function loadEntitlements() {
        if (!entitlementsListEl) return;
        const entitlements = await window.StorageService.getAllEntitlements();
        if (entitlements.length === 0) {
            entitlementsListEl.innerHTML = '<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No theme entitlements issued yet.</div>';
            return;
        }

        entitlementsListEl.innerHTML = '';
        const now = new Date();

        entitlements.forEach(ent => {
            const theme = window.ThemeManager.getTheme(ent.themeId);
            const expires = new Date(ent.expiresAt);
            const isExpired = expires <= now || ent.status === 'revoked';
            const daysLeft = Math.max(0, Math.ceil((expires - now) / (1000 * 60 * 60 * 24)));

            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div class="admin-card-header">
                    <div>
                        <div class="admin-card-theme-title">${theme.name} Theme</div>
                        <div class="admin-card-utr">Device: <code>${ent.deviceId}</code></div>
                    </div>
                    <div>
                        <span class="theme-badge" style="color: ${isExpired ? '#f87171' : '#4ade80'}; background: ${isExpired ? 'rgba(248,113,113,0.1)' : 'rgba(74,222,128,0.1)'};">
                            ${ent.status === 'revoked' ? 'REVOKED' : (isExpired ? 'EXPIRED' : 'ACTIVE')}
                        </span>
                    </div>
                </div>
                <div class="admin-card-meta-col">
                    <div><strong>Activated:</strong> ${new Date(ent.activatedAt).toLocaleString()}</div>
                    <div><strong>Expires:</strong> ${expires.toLocaleString()} (${daysLeft} days remaining)</div>
                    ${ent.transferredFrom ? `<div><strong>Transferred From:</strong> <code>${ent.transferredFrom}</code></div>` : ''}
                </div>
            `;
            entitlementsListEl.appendChild(card);
        });
    }

    // Load Device Transfers
    async function loadTransfers() {
        if (!transfersListEl) return;
        const transfers = await window.StorageService.getTransferRequests();
        if (transfers.length === 0) {
            transfersListEl.innerHTML = '<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No device transfer requests submitted.</div>';
            return;
        }

        transfersListEl.innerHTML = '';
        transfers.forEach(trf => {
            const theme = window.ThemeManager.getTheme(trf.themeId);
            const card = document.createElement('div');
            card.className = 'admin-card';

            let actionHtml = '';
            if (trf.status === 'pending') {
                actionHtml = `<button class="btn-admin-action approve" data-trf-id="${trf.id}">Approve Transfer</button>`;
            }

            card.innerHTML = `
                <div class="admin-card-header">
                    <div>
                        <div class="admin-card-theme-title">${theme.name} Theme Transfer</div>
                        <div class="admin-card-utr">Requested: ${new Date(trf.requestedAt).toLocaleString()}</div>
                    </div>
                    <div>
                        <span class="theme-badge" style="color: ${trf.status === 'pending' ? '#fbbf24' : '#4ade80'};">
                            ${trf.status.toUpperCase()}
                        </span>
                    </div>
                </div>
                <div class="admin-card-meta-col">
                    <div><strong>Source Device:</strong> <code>${trf.oldDeviceId}</code></div>
                    <div><strong>Target Device:</strong> <code>${trf.newDeviceId}</code></div>
                    ${trf.reviewedAt ? `<div><strong>Reviewed:</strong> ${new Date(trf.reviewedAt).toLocaleString()}</div>` : ''}
                </div>
                ${actionHtml ? `<div class="admin-card-actions">${actionHtml}</div>` : ''}
            `;
            transfersListEl.appendChild(card);
        });

        transfersListEl.querySelectorAll('.btn-admin-action.approve').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.trfId;
                if (confirm('Approve transfer? This will revoke entitlement on the old device and activate it on the new device, preserving the exact original expiration date.')) {
                    btn.disabled = true;
                    btn.textContent = 'Transferring...';
                    await window.StorageService.approveTransferRequest(id);
                    loadDashboardData();
                }
            });
        });
    }

    // Load Audit Logs
    async function loadLogs() {
        if (!logsListEl) return;
        const logs = await window.StorageService.getAuditLogs();
        if (logs.length === 0) {
            logsListEl.innerHTML = '<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No admin audit log entries recorded yet.</div>';
            return;
        }

        logsListEl.innerHTML = '';
        logs.forEach(log => {
            const card = document.createElement('div');
            card.className = 'admin-card';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <strong>${log.action}</strong>
                    <span style="color: var(--text-secondary); font-family: var(--font-mono); font-size: 11px;">${new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); background: var(--card-bg-elevated); padding: 8px 12px; border-radius: 6px; overflow-x: auto;">
                    ${JSON.stringify(log.details, null, 2)}
                </div>
                <div style="font-size: 11px; color: var(--text-secondary);">Performed by: ${log.performedBy}</div>
            `;
            logsListEl.appendChild(card);
        });
    }

    function loadDashboardData() {
        loadMetrics();
        loadRequests();
        loadEntitlements();
        loadTransfers();
        loadLogs();
    }

    // Zoom Modal close
    if (zoomModal) {
        zoomModal.addEventListener('click', () => {
            zoomModal.style.display = 'none';
        });
    }
});
