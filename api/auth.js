// api/auth.js – Vercel Serverless Function Endpoint for Project 24 Auth
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
        // e.g. /api/auth/send-otp
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
            case 'send-otp': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.sendOtp({
                    email: body.email,
                    deviceId
                });
                return res.status(200).json(result);
            }

            case 'verify-otp': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.verifyOtp({
                    email: body.email,
                    otp: body.otp,
                    deviceId,
                    userAgent: req.headers['user-agent']
                });
                return res.status(200).json(result);
            }

            case 'session': {
                if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
                const user = await AuthService.validateSession({ token, deviceId });
                if (!user) {
                    return res.status(401).json({ authenticated: false, message: 'Invalid or expired session' });
                }
                return res.status(200).json({ authenticated: true, user });
            }

            case 'logout': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.logout({ token });
                return res.status(200).json(result);
            }

            case 'update-profile': {
                if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
                const result = await AuthService.updateProfile({ token, name: body.name });
                return res.status(200).json(result);
            }

            default:
                return res.status(400).json({ error: 'Invalid auth action specified' });
        }
    } catch (err) {
        const status = err.conflict ? 409 : 400;
        return res.status(status).json({
            error: err.message,
            conflict: Boolean(err.conflict)
        });
    }
};
