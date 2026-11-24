// admin.js – Super Administrator Dashboard Controller for Project 24
// Handles Super Admin Authentication, User Management, Payment Verification,
// 1-Year Entitlement Grants, Rejection Audits, and Immutable Logging.

document.addEventListener('DOMContentLoaded', () => {
    const authOverlay = document.getElementById('adminAuthOverlay');
    const authForm = document.getElementById('adminAuthForm');
    const adminEmailInput = document.getElementById('adminEmailInput');
    const adminPassInput = document.getElementById('adminPassInput');
    const adminAuthAlert = document.getElementById('adminAuthAlert');
    const adminMain = document.getElementById('adminMain');
    const logoutBtn = document.getElementById('adminLogoutBtn');

    // Metrics
    const metricUsersEl = document.getElementById('metricUsers');
    const metricTotalEl = document.getElementById('metricTotal');
    const metricPendingEl = document.getElementById('metricPending');
    const metricApprovedEl = document.getElementById('metricApproved');
    const metricRejectedEl = document.getElementById('metricRejected');

    // Tabs
    const tabUsers = document.getElementById('tabUsers');
    const tabRequests = document.getElementById('tabRequests');
    const tabEntitlements = document.getElementById('tabEntitlements');
    const tabLogs = document.getElementById('tabLogs');

    const viewUsers = document.getElementById('viewUsers');
    const viewRequests = document.getElementById('viewRequests');
    const viewEntitlements = document.getElementById('viewEntitlements');
    const viewLogs = document.getElementById('viewLogs');

    // Filter Buttons
    const filterAllBtn = document.getElementById('filterAllBtn');
    const filterPendingBtn = document.getElementById('filterPendingBtn');
    const filterApprovedBtn = document.getElementById('filterApprovedBtn');
    const filterRejectedBtn = document.getElementById('filterRejectedBtn');

    // Lists
    const usersListEl = document.getElementById('usersList');
    const requestsListEl = document.getElementById('requestsList');
    const entitlementsListEl = document.getElementById('entitlementsList');
    const logsListEl = document.getElementById('logsList');

    // Zoom Lightbox
    const zoomModal = document.getElementById('imgZoomModal');
    const zoomImg = document.getElementById('imgZoomTarget');

    // Rejection Modal
    const rejectModal = document.getElementById('rejectModal');
    const rejectReasonInput = document.getElementById('rejectReasonInput');
    const cancelRejectBtn = document.getElementById('cancelRejectBtn');
    const confirmRejectBtn = document.getElementById('confirmRejectBtn');
    let pendingRejectRequestId = null;

    let currentFilter = 'all';

    function getAdminToken() {
        return window.AuthClient ? window.AuthClient.getAdminToken() : sessionStorage.getItem('p24_admin_token');
    }

    // Check if already authenticated as Super Admin
    if (window.AuthClient && window.AuthClient.isSuperAdmin()) {
        unlockDashboard();
    } else if (sessionStorage.getItem('p24_admin_auth') === 'true' && getAdminToken()) {
        unlockDashboard();
    }

    // Admin Login Form Submit
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            adminAuthAlert.style.display = 'none';

            const email = adminEmailInput.value.trim().toLowerCase();
            const password = adminPassInput.value.trim();

            if (email !== 'aryanpandey7161@gmail.com') {
                adminAuthAlert.textContent = 'Unauthorized: Only aryanpandey7161@gmail.com has Super Admin access';
                adminAuthAlert.style.display = 'block';
                return;
            }

            try {
                if (window.AuthClient) {
                    await window.AuthClient.loginAdmin({ email, password });
                    unlockDashboard();
                } else {
                    // Fallback local check
                    if (password === '24admin') {
                        sessionStorage.setItem('p24_admin_auth', 'true');
                        unlockDashboard();
                    } else {
                        throw new Error('Invalid administrator passcode');
                    }
                }
            } catch (err) {
                adminAuthAlert.textContent = err.message || 'Invalid credentials';
                adminAuthAlert.style.display = 'block';
                adminPassInput.value = '';
            }
        });
    }

    // Admin Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (window.AuthClient) {
                await window.AuthClient.logoutAdmin();
            }
            sessionStorage.removeItem('p24_admin_auth');
            location.reload();
        });
    }

    function unlockDashboard() {
        if (authOverlay) authOverlay.style.display = 'none';
        if (adminMain) adminMain.style.display = 'block';
        loadDashboardData();
    }

    // Tab Navigation
    function setTab(activeTab, activeView) {
        [tabUsers, tabRequests, tabEntitlements, tabLogs].forEach(t => t && t.classList.remove('active'));
        [viewUsers, viewRequests, viewEntitlements, viewLogs].forEach(v => v && (v.style.display = 'none'));
        activeTab.classList.add('active');
        activeView.style.display = 'block';
    }

    if (tabUsers) tabUsers.addEventListener('click', () => { setTab(tabUsers, viewUsers); loadUsers(); });
    if (tabRequests) tabRequests.addEventListener('click', () => { setTab(tabRequests, viewRequests); loadRequests(); });
    if (tabEntitlements) tabEntitlements.addEventListener('click', () => { setTab(tabEntitlements, viewEntitlements); loadEntitlements(); });
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

    async function loadDashboardData() {
        await Promise.all([
            loadMetrics(),
            loadUsers(),
            loadRequests()
        ]);
    }

    // 1. Load Metrics
    async function loadMetrics() {
        const token = getAdminToken();
        try {
            const [usersRes, reqRes] = await Promise.all([
                fetch('/api/auth?action=users', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/auth?action=payment-requests&status=all', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const usersData = await usersRes.json();
            const reqData = await reqRes.json();

            const users = usersData.users || [];
            const requests = reqData.requests || [];

            const pending = requests.filter(r => r.status === 'pending').length;
            const approved = requests.filter(r => r.status === 'approved').length;
            const rejected = requests.filter(r => r.status === 'rejected').length;

            if (metricUsersEl) metricUsersEl.textContent = users.length;
            if (metricTotalEl) metricTotalEl.textContent = requests.length;
            if (metricPendingEl) metricPendingEl.textContent = pending;
            if (metricApprovedEl) metricApprovedEl.textContent = approved;
            if (metricRejectedEl) metricRejectedEl.textContent = rejected;
        } catch (e) {
            console.error('Failed to load metrics:', e);
        }
    }

    // 2. Load Registered Users List
    async function loadUsers() {
        if (!usersListEl) return;
        const token = getAdminToken();
        try {
            const res = await fetch('/api/auth?action=users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const users = data.users || [];

            if (users.length === 0) {
                usersListEl.innerHTML = '<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 24px;">No users registered yet.</div>';
                return;
            }

            usersListEl.innerHTML = '';
            users.forEach(u => {
                const card = document.createElement('div');
                card.className = 'admin-card';

                const regDate = u.createdAt ? new Date(u.createdAt).toLocaleString() : '-';
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <div style="font-size: 16px; font-weight: 700; color: var(--text-primary);">${escapeHtml(u.fullName)}</div>
                            <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">${escapeHtml(u.email)}</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Mobile: ${escapeHtml(u.mobileNumber || '-')}</div>
                        </div>
                        <div style="text-align: right;">
                            <span class="profile-value-mono" style="font-size: 12px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 3px 8px; border-radius: 4px;">
                                ${escapeHtml(u.userId)}
                            </span>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px;">Joined: ${regDate}</div>
                        </div>
                    </div>
                `;
                usersListEl.appendChild(card);
            });
        } catch (e) {
            usersListEl.innerHTML = '<div class="admin-card" style="color: #f87171; padding: 16px;">Failed to load user directory.</div>';
        }
    }

    // 3. Load Payment Requests
    async function loadRequests() {
        if (!requestsListEl) return;
        const token = getAdminToken();
        try {
            const res = await fetch(`/api/auth?action=payment-requests&status=${currentFilter}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const requests = data.requests || [];

            if (requests.length === 0) {
                requestsListEl.innerHTML = `<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No ${currentFilter === 'all' ? '' : currentFilter} payment requests found.</div>`;
                return;
            }

            requestsListEl.innerHTML = '';
            requests.forEach(req => {
                const card = document.createElement('div');
                card.className = 'admin-card';

                let statusBadge = '';
                if (req.status === 'pending') {
                    statusBadge = '<span class="theme-badge" style="color: #fbbf24; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3);">PENDING</span>';
                } else if (req.status === 'approved') {
                    statusBadge = '<span class="theme-badge" style="color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3);">APPROVED</span>';
                } else {
                    statusBadge = '<span class="theme-badge" style="color: #f87171; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3);">REJECTED</span>';
                }

                const themeName = window.ThemeManager ? (window.ThemeManager.getTheme(req.themeId)?.name || req.themeId) : req.themeId;

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${escapeHtml(themeName)} Theme</div>
                            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                User: <strong>${escapeHtml(req.userName || req.userId)}</strong> &bull; User ID: <code style="font-family: var(--font-mono); color: #38bdf8;">${escapeHtml(req.userId)}</code>
                            </div>
                            ${req.userEmail ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 1px;">Email: ${escapeHtml(req.userEmail)}</div>` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">₹${req.amount || 29}</span>
                            ${statusBadge}
                        </div>
                    </div>

                    <div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 200px; font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                            <div>UTR: <strong style="color: var(--text-primary); font-family: var(--font-mono);">${escapeHtml(req.utr)}</strong></div>
                            <div>Submitted: ${new Date(req.submittedAt).toLocaleString()}</div>
                            ${req.reviewedAt ? `<div>Reviewed: ${new Date(req.reviewedAt).toLocaleString()} by ${escapeHtml(req.reviewedBy || 'Admin')}</div>` : ''}
                            ${req.rejectionReason ? `<div style="color: #f87171; margin-top: 4px;"><strong>Rejection Reason:</strong> ${escapeHtml(req.rejectionReason)}</div>` : ''}
                        </div>

                        ${req.screenshot ? `
                            <div>
                                <img src="${req.screenshot}" alt="Payment Proof" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid var(--card-border); cursor: pointer;" class="screenshot-thumb" data-full="${req.screenshot}" title="Click to view full screenshot" />
                            </div>
                        ` : ''}
                    </div>

                    ${req.status === 'pending' ? `
                        <div style="display: flex; gap: 10px; margin-top: 16px; border-top: 1px solid var(--card-border); padding-top: 12px;">
                            <button class="btn-theme-action btn-approve" data-id="${req.id}" style="background: #15803d; color: #fff; flex: 1;">
                                Approve & Grant 1-Year Access
                            </button>
                            <button class="btn-theme-action btn-reject" data-id="${req.id}" style="background: transparent; border: 1px solid #ef4444; color: #f87171; flex: 1;">
                                Reject with Reason
                            </button>
                        </div>
                    ` : ''}
                `;

                requestsListEl.appendChild(card);
            });

            // Wire up Approve buttons
            document.querySelectorAll('.btn-approve').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('Approve this payment request and grant 1-year theme access?')) {
                        await approveRequest(id);
                    }
                });
            });

            // Wire up Reject buttons
            document.querySelectorAll('.btn-reject').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    pendingRejectRequestId = id;
                    rejectReasonInput.value = '';
                    rejectModal.style.display = 'flex';
                });
            });

            // Wire up screenshot thumbnails zoom
            document.querySelectorAll('.screenshot-thumb').forEach(img => {
                img.addEventListener('click', (e) => {
                    const full = e.currentTarget.getAttribute('data-full');
                    zoomImg.src = full;
                    zoomModal.style.display = 'flex';
                });
            });

        } catch (e) {
            requestsListEl.innerHTML = '<div class="admin-card" style="color: #f87171; padding: 16px;">Failed to load payment requests.</div>';
        }
    }

    // 4. Approve Payment
    async function approveRequest(requestId) {
        const token = getAdminToken();
        try {
            const res = await fetch('/api/auth?action=approve-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ requestId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to approve payment');

            alert('Payment approved successfully! 1-year entitlement granted.');
            await Promise.all([loadMetrics(), loadRequests()]);
        } catch (err) {
            alert('Approval failed: ' + err.message);
        }
    }

    // 5. Reject Payment (with required reason)
    if (confirmRejectBtn) {
        confirmRejectBtn.addEventListener('click', async () => {
            const reason = rejectReasonInput.value.trim();
            if (!reason) {
                alert('A clear rejection reason is strictly required.');
                rejectReasonInput.focus();
                return;
            }

            const token = getAdminToken();
            try {
                const res = await fetch('/api/auth?action=reject-payment', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        requestId: pendingRejectRequestId,
                        reason
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to reject payment');

                rejectModal.style.display = 'none';
                pendingRejectRequestId = null;
                alert('Payment request rejected and recorded in audit log.');
                await Promise.all([loadMetrics(), loadRequests()]);
            } catch (err) {
                alert('Rejection failed: ' + err.message);
            }
        });
    }

    if (cancelRejectBtn) {
        cancelRejectBtn.addEventListener('click', () => {
            rejectModal.style.display = 'none';
            pendingRejectRequestId = null;
        });
    }

    // 6. Load Entitlements
    async function loadEntitlements() {
        if (!entitlementsListEl) return;
        // In this view, we read from requests or entitlements endpoint
        const token = getAdminToken();
        try {
            const res = await fetch('/api/auth?action=payment-requests&status=approved', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const approved = data.requests || [];

            if (approved.length === 0) {
                entitlementsListEl.innerHTML = '<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No active entitlements found.</div>';
                return;
            }

            entitlementsListEl.innerHTML = '';
            approved.forEach(req => {
                const card = document.createElement('div');
                card.className = 'admin-card';
                const themeName = window.ThemeManager ? (window.ThemeManager.getTheme(req.themeId)?.name || req.themeId) : req.themeId;

                const actDate = req.reviewedAt ? new Date(req.reviewedAt) : new Date(req.submittedAt);
                const expDate = new Date(actDate);
                expDate.setFullYear(expDate.getFullYear() + 1);

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${escapeHtml(themeName)} Theme</span>
                        <span class="theme-badge" style="color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3);">ACTIVE</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
                        <div>User ID: <code style="font-family: var(--font-mono); color: #38bdf8;">${escapeHtml(req.userId)}</code></div>
                        <div>User: <strong>${escapeHtml(req.userName || req.userId)}</strong> (${escapeHtml(req.userEmail || '-')})</div>
                        <div>Activated: ${actDate.toLocaleDateString()}</div>
                        <div>Expires: <strong style="color: var(--text-primary);">${expDate.toLocaleDateString()}</strong> (1-Year Access)</div>
                    </div>
                `;
                entitlementsListEl.appendChild(card);
            });
        } catch (e) {
            entitlementsListEl.innerHTML = '<div class="admin-card" style="color: #f87171; padding: 16px;">Failed to load active entitlements.</div>';
        }
    }

    // 7. Load Audit Logs
    async function loadLogs() {
        if (!logsListEl) return;
        const token = getAdminToken();
        try {
            const res = await fetch('/api/auth?action=audit-logs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            const logs = data.logs || [];

            if (logs.length === 0) {
                logsListEl.innerHTML = '<div class="admin-card" style="text-align: center; color: var(--text-secondary); padding: 32px;">No audit events logged yet.</div>';
                return;
            }

            logsListEl.innerHTML = '';
            logs.forEach(log => {
                const card = document.createElement('div');
                card.className = 'admin-card';

                const isApprove = log.action === 'APPROVE_PAYMENT';
                const actionBadge = isApprove
                    ? '<span class="theme-badge" style="color: #4ade80; background: rgba(74, 222, 128, 0.1); border: 1px solid rgba(74, 222, 128, 0.3);">APPROVED</span>'
                    : '<span class="theme-badge" style="color: #f87171; background: rgba(248, 113, 113, 0.1); border: 1px solid rgba(248, 113, 113, 0.3);">REJECTED</span>';

                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-size: 13px; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono);">${escapeHtml(log.action)}</span>
                        ${actionBadge}
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                        <div>Admin: <strong>${escapeHtml(log.superAdmin)}</strong></div>
                        <div>User ID: <code style="font-family: var(--font-mono); color: #38bdf8;">${escapeHtml(log.userId)}</code></div>
                        <div>Timestamp: ${new Date(log.timestamp).toLocaleString()}</div>
                        ${log.rejectionReason ? `<div style="color: #f87171; margin-top: 4px;">Reason: ${escapeHtml(log.rejectionReason)}</div>` : ''}
                    </div>
                `;
                logsListEl.appendChild(card);
            });
        } catch (e) {
            logsListEl.innerHTML = '<div class="admin-card" style="color: #f87171; padding: 16px;">Failed to load audit logs.</div>';
        }
    }

    // Screenshot Zoom Lightbox click-to-close
    if (zoomModal) {
        zoomModal.addEventListener('click', () => {
            zoomModal.style.display = 'none';
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});
