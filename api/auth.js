// api/auth.js – Serverless Function Endpoint for Project 24 Auth & Super Admin
const AuthService = require('../backend/auth-service.js');

module.exports = async (req, res) => {
    // Enable CORS for client requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Parse URL & action
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let action = url.searchParams.get('action');
    if (!action) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length > 2) {
            action = parts[2];
        }
    }

    // Extract body if POST
    let body = req.body || {};
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const deviceId = req.headers['x-device-id'] || body.deviceId || url.searchParams.get('deviceId');
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || body.token || url.searchParams.get('token');

    try {
        switch (action) {
            // 1. No-OTP User Registration
            case 'register': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.registerUser({
                    fullName: body.fullName,
                    mobileNumber: body.mobileNumber,
                    email: body.email,
                    deviceId
                });
                return res.status(200).json(result);
            }

            // 2. Super Admin Login
            case 'admin-login': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.loginSuperAdmin({
                    email: body.email,
                    password: body.password
                });
                return res.status(200).json(result);
            }

            // 3. Session Validation
            case 'session': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const user = await AuthService.validateSession({ token, deviceId });
                if (!user) {
                    return res.status(401).json({ authenticated: false, message: 'Invalid or expired session' });
                }
                return res.status(200).json({ authenticated: true, user });
            }

            // 4. Admin: Get Registered Users
            case 'users': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const users = await AuthService.getAllUsers({ token });
                return res.status(200).json({ success: true, users });
            }

            // 5. Submit Payment Request
            case 'payment-request': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.createPaymentRequest({
                    token,
                    userId: body.userId,
                    themeId: body.themeId,
                    amount: body.amount,
                    utr: body.utr,
                    screenshot: body.screenshot
                });
                return res.status(200).json({ success: true, request: result });
            }

            // 6. Get Payment Requests
            case 'payment-requests': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const status = url.searchParams.get('status') || 'all';
                const requests = await AuthService.getPaymentRequests({ token, filter: { status } });
                return res.status(200).json({ success: true, requests });
            }

            // 7. Admin: Approve Payment
            case 'approve-payment': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.approvePayment({
                    token,
                    requestId: body.requestId
                });
                return res.status(200).json({ success: true, ...result });
            }

            // 8. Admin: Reject Payment
            case 'reject-payment': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.rejectPayment({
                    token,
                    requestId: body.requestId,
                    reason: body.reason
                });
                return res.status(200).json({ success: true, request: result });
            }

            // 9. Admin: Audit Logs
            case 'audit-logs': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const logs = await AuthService.getAuditLogs({ token });
                return res.status(200).json({ success: true, logs });
            }

            // 10. User Entitlements
            case 'entitlements': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const userId = url.searchParams.get('userId');
                const entitlements = await AuthService.getUserEntitlements(userId);
                return res.status(200).json({ success: true, entitlements });
            }

            // 11. Super Admin Logout
            case 'admin-logout': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.logoutAdmin(token);
                return res.status(200).json(result);
            }

            default:
                return res.status(400).json({ error: 'Invalid auth action specified' });
        }
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
};
