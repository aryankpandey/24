// settings.js – Interactive Logic for Settings, Theme Monetization, and Payment Modal

document.addEventListener('DOMContentLoaded', async () => {
    const deviceIdEl = document.getElementById('deviceIdDisplay');
    const copyDeviceBtn = document.getElementById('copyDeviceBtn');
    const themesGrid = document.getElementById('themesGrid');
    const userRequestsList = document.getElementById('userRequestsList');

    // Payment Modal Elements
    const paymentModal = document.getElementById('paymentModal');
    const closePaymentModalBtn = document.getElementById('closePaymentModal');
    const payThemeNameEl = document.getElementById('payThemeName');
    const payThemePriceEl = document.getElementById('payThemePrice');
    const payThemeIdInput = document.getElementById('payThemeId');
    const payDeviceIdDisplay = document.getElementById('payDeviceIdDisplay');
    const copyUpiBtn = document.getElementById('copyUpiBtn');
    const upiIdText = document.getElementById('upiIdText');
    const upiPayLink = document.getElementById('upiPayLink');
    const paymentForm = document.getElementById('paymentForm');
    const utrInput = document.getElementById('utrInput');
    const screenshotInput = document.getElementById('screenshotInput');
    const screenshotPreview = document.getElementById('screenshotPreview');
    const submitPaymentBtn = document.getElementById('submitPaymentBtn');
    const paymentAlert = document.getElementById('paymentAlert');

    // Transfer Modal Elements
    const transferModal = document.getElementById('transferModal');
    const openTransferModalBtn = document.getElementById('openTransferModalBtn');
    const closeTransferModalBtn = document.getElementById('closeTransferModal');
    const transferForm = document.getElementById('transferForm');
    const transferThemeSelect = document.getElementById('transferThemeSelect');
    const transferNewDeviceIdInput = document.getElementById('transferNewDeviceId');
    const transferAlert = document.getElementById('transferAlert');

    // Display Device ID
    const deviceId = window.StorageService.getDeviceId();
    if (deviceIdEl) {
        deviceIdEl.textContent = deviceId;
    }
    if (payDeviceIdDisplay) {
        payDeviceIdDisplay.textContent = deviceId;
    }

    // Copy Device ID
    if (copyDeviceBtn) {
        copyDeviceBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(deviceId).then(() => {
                showToast('Device ID copied to clipboard');
            }).catch(() => {
                showToast('Copied: ' + deviceId);
            });
        });
    }

    // Copy UPI ID
    if (copyUpiBtn && upiIdText) {
        copyUpiBtn.addEventListener('click', () => {
            const upi = upiIdText.textContent.trim();
            navigator.clipboard.writeText(upi).then(() => {
                showToast('UPI ID copied to clipboard');
            }).catch(() => {
                showToast('Copied: ' + upi);
            });
        });
    }

    // Render the 6 Themes
    async function renderThemes() {
        if (!themesGrid) return;
        const catalog = window.ThemeManager.getCatalog();
        const currentThemeId = window.ThemeManager.getCurrentTheme();
        const entitlements = await window.StorageService.getEntitlements();

        themesGrid.innerHTML = '';

        for (const theme of catalog) {
            const isCurrent = theme.id === currentThemeId;
            const isFree = theme.type === 'free';
            const entitlement = entitlements.find(e => e.themeId === theme.id && e.status === 'active' && new Date(e.expiresAt) > new Date());
            const isUnlocked = isFree || Boolean(entitlement);

            const card = document.createElement('div');
            card.className = `theme-item-card ${isCurrent ? 'is-active' : ''}`;

            let badgeHtml = '';
            if (isFree) {
                badgeHtml = '<span class="theme-badge free">FREE</span>';
            } else if (entitlement) {
                badgeHtml = '<span class="theme-badge unlocked">UNLOCKED</span>';
            } else {
                badgeHtml = '<span class="theme-badge premium">₹29 / YEAR</span>';
            }

            let expiryHtml = '';
            if (entitlement) {
                const expDate = new Date(entitlement.expiresAt);
                const daysLeft = Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24));
                expiryHtml = `<div class="theme-item-expiry">Valid for ${daysLeft} days (until ${expDate.toLocaleDateString()})</div>`;
            }

            let actionBtnHtml = '';
            if (isCurrent) {
                actionBtnHtml = `<button class="btn-theme-action active-badge" disabled>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Active
                </button>`;
            } else if (isUnlocked) {
                actionBtnHtml = `<button class="btn-theme-action apply" data-theme-id="${theme.id}">
                    Apply Theme
                </button>`;
            } else {
                actionBtnHtml = `<button class="btn-theme-action unlock" data-theme-id="${theme.id}" data-theme-name="${theme.name}">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    Unlock · ₹29
                </button>`;
            }

            card.innerHTML = `
                <div>
                    <div class="theme-card-top">
                        <span class="theme-item-title">${theme.name}</span>
                        ${badgeHtml}
                    </div>
                    
                    <div class="theme-preview-box" style="background-color: ${theme.colors[0]}; color: ${theme.colors[2]}; border-color: ${theme.colors[1]}; margin: 12px 0;">
                        <div class="theme-preview-header">
                            <span class="theme-preview-logo" style="color: ${theme.colors[2]};">24</span>
                            <div class="theme-preview-dots">
                                <span style="background-color: ${theme.colors[2]};"></span>
                                <span style="background-color: ${theme.colors[2]};"></span>
                                <span style="background-color: ${theme.colors[2]};"></span>
                            </div>
                        </div>
                        <div class="theme-preview-timer" style="color: ${theme.colors[2]};">24:00:00</div>
                        <div style="height: 3px; background-color: ${theme.colors[1]}; border-radius: 2px;">
                            <div style="width: 65%; height: 100%; background-color: ${theme.colors[2]}; border-radius: 2px;"></div>
                        </div>
                    </div>

                    <div class="theme-item-body">
                        <p class="theme-item-desc">${theme.desc}</p>
                        ${expiryHtml}
                    </div>
                </div>

                <div class="theme-item-actions">
                    ${actionBtnHtml}
                </div>
            `;

            themesGrid.appendChild(card);
        }

        // Attach event listeners
        document.querySelectorAll('.btn-theme-action.apply').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.themeId;
                const success = await window.ThemeManager.setTheme(id);
                if (success) {
                    showToast(`Switched to ${window.ThemeManager.getTheme(id).name} theme`);
                    renderThemes();
                }
            });
        });

        document.querySelectorAll('.btn-theme-action.unlock').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.themeId;
                openPaymentModal(id);
            });
        });
    }

    // Render User's Submitted Requests
    async function renderUserRequests() {
        if (!userRequestsList) return;
        const requests = await window.StorageService.getPaymentRequests({ deviceId });
        if (requests.length === 0) {
            userRequestsList.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">No active payment requests submitted yet.</p>';
            return;
        }

        userRequestsList.innerHTML = '';
        requests.forEach(req => {
            const theme = window.ThemeManager.getTheme(req.themeId);
            const item = document.createElement('div');
            item.className = 'user-request-badge-item';

            let statusBadge = '';
            if (req.status === 'pending') {
                statusBadge = '<span style="color: #fbbf24; font-weight: 700; text-transform: uppercase;">Pending Verification</span>';
            } else if (req.status === 'approved') {
                statusBadge = '<span style="color: #4ade80; font-weight: 700; text-transform: uppercase;">Approved</span>';
            } else {
                statusBadge = `<span style="color: #f87171; font-weight: 700; text-transform: uppercase;" title="${req.rejectionReason || ''}">Rejected</span>`;
            }

            item.innerHTML = `
                <div>
                    <div style="font-weight: 600; color: var(--text-primary);">${theme.name} Theme (₹29)</div>
                    <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary);">UTR: ${req.utr} · ${new Date(req.submittedAt).toLocaleDateString()}</div>
                </div>
                <div>${statusBadge}</div>
            `;
            userRequestsList.appendChild(item);
        });
    }

    // Payment Modal Functions
    function openPaymentModal(themeId) {
        const theme = window.ThemeManager.getTheme(themeId);
        if (!theme) return;

        payThemeNameEl.textContent = theme.name;
        payThemePriceEl.textContent = '₹' + theme.price;
        payThemeIdInput.value = theme.id;
        utrInput.value = '';
        screenshotInput.value = '';
        screenshotPreview.style.display = 'none';
        screenshotPreview.src = '';
        paymentAlert.style.display = 'none';

        // Update direct UPI payment link
        const upiId = 'aryanpandey7161-1@oksbi';
        const payeeName = 'ARYAN PANDEY';
        const note = encodeURIComponent(`Project 24 ${theme.name} Theme Unlock`);
        if (upiPayLink) {
            upiPayLink.href = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=29&cu=INR&tn=${note}`;
        }

        paymentModal.classList.add('active');
        try {
            history.pushState({ paymentModalOpen: true }, '');
        } catch (e) {}
    }

    function closePaymentModal() {
        if (paymentModal && paymentModal.classList.contains('active')) {
            paymentModal.classList.remove('active');
            if (history.state && history.state.paymentModalOpen) {
                history.back();
            }
        }
    }

    if (closePaymentModalBtn) {
        closePaymentModalBtn.addEventListener('click', closePaymentModal);
    }

    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) closePaymentModal();
        });
    }

    // Screenshot file preview
    if (screenshotInput) {
        screenshotInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 5 * 1024 * 1024) {
                    showPaymentAlert('Screenshot file is too large (max 5MB)', 'error');
                    screenshotInput.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = (evt) => {
                    screenshotPreview.src = evt.target.result;
                    screenshotPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Handle Payment Form Submission
    if (paymentForm) {
        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const themeId = payThemeIdInput.value;
            const utr = utrInput.value.trim();
            const screenshotDataUrl = screenshotPreview.src;

            if (!utr || utr.length < 6) {
                showPaymentAlert('Please enter a valid transaction reference / UTR number (min 6 characters)', 'error');
                return;
            }
            if (!screenshotDataUrl || screenshotPreview.style.display === 'none') {
                showPaymentAlert('Please upload your payment confirmation screenshot', 'error');
                return;
            }

            submitPaymentBtn.disabled = true;
            submitPaymentBtn.textContent = 'Submitting Request...';

            try {
                await window.StorageService.submitPaymentRequest({
                    themeId,
                    utr,
                    screenshotDataUrl
                });

                showPaymentAlert('Payment request submitted successfully! Your theme will be unlocked once approved by the administrator.', 'success');
                submitPaymentBtn.textContent = 'Submitted';
                setTimeout(() => {
                    closePaymentModal();
                    renderThemes();
                    renderUserRequests();
                }, 2000);
            } catch (err) {
                showPaymentAlert(err.message || 'Submission failed. Please try again.', 'error');
                submitPaymentBtn.disabled = false;
                submitPaymentBtn.textContent = 'Submit Payment Verification';
            }
        });
    }

    function showPaymentAlert(msg, type) {
        if (!paymentAlert) return;
        paymentAlert.textContent = msg;
        paymentAlert.style.display = 'block';
        paymentAlert.style.backgroundColor = type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)';
        paymentAlert.style.color = type === 'error' ? '#f87171' : '#4ade80';
        paymentAlert.style.border = `1px solid ${type === 'error' ? '#ef4444' : '#4ade80'}`;
        paymentAlert.style.padding = '10px 14px';
        paymentAlert.style.borderRadius = '8px';
        paymentAlert.style.fontSize = '12px';
        paymentAlert.style.marginTop = '10px';
    }

    // Device Transfer Functions
    if (openTransferModalBtn) {
        openTransferModalBtn.addEventListener('click', async () => {
            const entitlements = await window.StorageService.getEntitlements();
            if (entitlements.length === 0) {
                alert('No active theme entitlements found on this device to transfer.');
                return;
            }
            transferThemeSelect.innerHTML = '';
            entitlements.forEach(ent => {
                const theme = window.ThemeManager.getTheme(ent.themeId);
                const opt = document.createElement('option');
                opt.value = ent.id;
                opt.dataset.themeId = ent.themeId;
                opt.textContent = `${theme.name} (Expires ${new Date(ent.expiresAt).toLocaleDateString()})`;
                transferThemeSelect.appendChild(opt);
            });
            transferNewDeviceIdInput.value = '';
            transferAlert.style.display = 'none';
            transferModal.classList.add('active');
        });
    }

    if (closeTransferModalBtn) {
        closeTransferModalBtn.addEventListener('click', () => {
            transferModal.classList.remove('active');
        });
    }

    if (transferForm) {
        transferForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const entitlementId = transferThemeSelect.value;
            const newDeviceId = transferNewDeviceIdInput.value.trim().toUpperCase();
            const selectedOpt = transferThemeSelect.options[transferThemeSelect.selectedIndex];
            const themeId = selectedOpt ? selectedOpt.dataset.themeId : '';

            if (!newDeviceId || !newDeviceId.startsWith('P24-')) {
                showTransferAlert('Please enter a valid target Device ID (starting with P24-)', 'error');
                return;
            }
            if (newDeviceId === deviceId) {
                showTransferAlert('Target Device ID cannot be identical to current Device ID', 'error');
                return;
            }

            try {
                await window.StorageService.submitTransferRequest({
                    entitlementId,
                    oldDeviceId: deviceId,
                    newDeviceId,
                    themeId
                });
                showTransferAlert('Transfer request submitted! It will take effect upon administrator approval.', 'success');
                setTimeout(() => {
                    transferModal.classList.remove('active');
                }, 2000);
            } catch (err) {
                showTransferAlert(err.message, 'error');
            }
        });
    }

    function showTransferAlert(msg, type) {
        if (!transferAlert) return;
        transferAlert.textContent = msg;
        transferAlert.style.display = 'block';
        transferAlert.style.backgroundColor = type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(74, 222, 128, 0.15)';
        transferAlert.style.color = type === 'error' ? '#f87171' : '#4ade80';
        transferAlert.style.border = `1px solid ${type === 'error' ? '#ef4444' : '#4ade80'}`;
        transferAlert.style.padding = '10px 14px';
        transferAlert.style.borderRadius = '8px';
        transferAlert.style.fontSize = '12px';
        transferAlert.style.marginTop = '10px';
    }

    // Helper Toast
    function showToast(text) {
        const toast = document.createElement('div');
        toast.textContent = text;
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'var(--text-primary)';
        toast.style.color = 'var(--bg-color)';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '8px';
        toast.style.fontSize = '13px';
        toast.style.fontWeight = '600';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
        toast.style.transition = 'opacity 0.3s';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2200);
    }

    // Initial render & listen for updates
    renderThemes();
    renderUserRequests();

    window.addEventListener('p24-entitlements-updated', () => {
        renderThemes();
        renderUserRequests();
    });
    window.addEventListener('p24-theme-changed', () => {
        renderThemes();
    });
});
