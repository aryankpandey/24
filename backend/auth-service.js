// backend/auth-service.js
// Core Server-Side Authentication Engine for Project 24
// Enforces Email OTP verification, permanent User ID generation,
// rate limiting, OTP expiry, and strict Single Device Session restrictions.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'auth-db.json');

// Ensure database directory and file exist
function initDb() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [],
            otps: {},
            rateLimits: {}
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
}

function readDb() {
    initDb();
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return { users: [], otps: {}, rateLimits: {} };
    }
}

function writeDb(data) {
    initDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Generate permanent, unique User ID
function generatePermanentUserId(existingUsers) {
    let userId = '';
    let isUnique = false;
    while (!isUnique) {
        const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
        userId = `P24-USR-${rand}`;
        isUnique = !existingUsers.some(u => u.userId === userId);
    }
    return userId;
}

// Mock/Real Email Sender helper
async function sendEmailOtp(email, otp) {
    // If SMTP credentials or Resend API key exist in environment, send real email
    const resendKey = process.env.RESEND_API_KEY;
    const smtpHost = process.env.SMTP_HOST;

    if (resendKey) {
        try {
            const res = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${resendKey}`
                },
                body: JSON.stringify({
                    from: process.env.EMAIL_FROM || 'Project 24 <auth@project24.app>',
                    to: [email],
                    subject: `${otp} is your Project 24 verification code`,
                    text: `Your verification code for Project 24 is: ${otp}. It will expire in 10 minutes.\n\nIf you did not request this code, please ignore this email.`
                })
            });
            return res.ok;
        } catch (e) {
            console.error('[AUTH EMAIL] Resend delivery error:', e.message);
        }
    }

    // Default secure server log (visible in server stdout/logs for verification)
    console.log(`\n======================================================`);
    console.log(`[AUTH SERVICE] Email sent to: ${email}`);
    console.log(`[AUTH SERVICE] Verification OTP: ${otp}`);
    console.log(`[AUTH SERVICE] Valid for: 10 minutes`);
    console.log(`======================================================\n`);
    return true;
}

const AuthService = {
    // 1. Send OTP
    async sendOtp({ email, deviceId }) {
        if (!email || typeof email !== 'string') {
            throw new Error('Valid email address is required');
        }
        const cleanEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            throw new Error('Please enter a valid email address');
        }
        if (!deviceId) {
            throw new Error('Device identifier is required');
        }

        const db = readDb();
        const now = Date.now();

        // Check if user already exists and has an ACTIVE session on another device
        const existingUser = db.users.find(u => u.email === cleanEmail);
        if (existingUser && existingUser.activeSession) {
            const sess = existingUser.activeSession;
            // If active session belongs to a different device
            if (sess.deviceId && sess.deviceId !== deviceId) {
                // Calculate if session is still within active timeout (30 days)
                const sessionAge = now - new Date(sess.createdAt).getTime();
                const maxSessionAge = 30 * 24 * 60 * 60 * 1000;
                if (sessionAge < maxSessionAge) {
                    const err = new Error('ACTIVE_SESSION_CONFLICT');
                    err.conflict = true;
                    err.message = 'This account is currently active on another device. Project 24 allows only one active device session at a time. Please log out from your other device first.';
                    throw err;
                }
            }
        }

        // Rate limiting check: max 5 requests per hour, cooldown 60 seconds
        const rateInfo = db.rateLimits[cleanEmail] || { count: 0, firstReq: now, lastReq: 0 };
        if (rateInfo.lastReq && (now - rateInfo.lastReq) < 60 * 1000) {
            const waitSec = Math.ceil((60 * 1000 - (now - rateInfo.lastReq)) / 1000);
            throw new Error(`Please wait ${waitSec} seconds before requesting another code`);
        }
        if ((now - rateInfo.firstReq) < 60 * 60 * 1000 && rateInfo.count >= 5) {
            throw new Error('Too many requests. Please try again after 1 hour.');
        }

        // Generate 6-digit numeric OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expiresAt = now + 10 * 60 * 1000; // 10 minutes

        // Update rate limits
        if ((now - rateInfo.firstReq) >= 60 * 60 * 1000) {
            db.rateLimits[cleanEmail] = { count: 1, firstReq: now, lastReq: now };
        } else {
            db.rateLimits[cleanEmail] = { count: rateInfo.count + 1, firstReq: rateInfo.firstReq, lastReq: now };
        }

        // Save pending OTP securely on backend
        db.otps[cleanEmail] = {
            otp,
            expiresAt,
            attempts: 0,
            deviceId
        };
        writeDb(db);

        // Send email (or log in dev)
        await sendEmailOtp(cleanEmail, otp);

        return {
            success: true,
            message: `Verification code sent to ${cleanEmail}`
        };
    },

    // 2. Verify OTP & Authenticate
    async verifyOtp({ email, otp, deviceId, userAgent }) {
        if (!email || !otp) {
            throw new Error('Email and verification code are required');
        }
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = String(otp).trim();
        const db = readDb();
        const now = Date.now();

        const pendingOtp = db.otps[cleanEmail];
        if (!pendingOtp) {
            throw new Error('No pending verification code found. Please request a new code.');
        }

        if (now > pendingOtp.expiresAt) {
            delete db.otps[cleanEmail];
            writeDb(db);
            throw new Error('Verification code has expired. Please request a new code.');
        }

        pendingOtp.attempts = (pendingOtp.attempts || 0) + 1;
        if (pendingOtp.attempts > 5) {
            delete db.otps[cleanEmail];
            writeDb(db);
            throw new Error('Too many invalid attempts. This code has been invalidated. Please request a new code.');
        }

        if (pendingOtp.otp !== cleanOtp) {
            writeDb(db);
            throw new Error('Invalid verification code. Please check and try again.');
        }

        // Check Single Device restriction again
        let user = db.users.find(u => u.email === cleanEmail);
        if (user && user.activeSession) {
            const sess = user.activeSession;
            if (sess.deviceId && sess.deviceId !== deviceId) {
                const sessionAge = now - new Date(sess.createdAt).getTime();
                const maxSessionAge = 30 * 24 * 60 * 60 * 1000;
                if (sessionAge < maxSessionAge) {
                    const err = new Error('ACTIVE_SESSION_CONFLICT');
                    err.conflict = true;
                    err.message = 'This account is currently active on another device. Please log out from that device first.';
                    throw err;
                }
            }
        }

        // Code is valid! Create account if new, or load existing
        if (!user) {
            const nameFromEmail = cleanEmail.split('@')[0].replace(/[._-]/g, ' ');
            const formattedName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
            user = {
                id: crypto.randomUUID ? crypto.randomUUID() : 'u_' + Date.now(),
                userId: generatePermanentUserId(db.users),
                email: cleanEmail,
                name: formattedName,
                createdAt: new Date().toISOString(),
                activeSession: null
            };
            db.users.push(user);
        }

        // Generate cryptographically secure session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        user.activeSession = {
            token: sessionToken,
            deviceId: deviceId || 'unknown',
            userAgent: userAgent || 'Unknown Browser',
            createdAt: new Date().toISOString(),
            lastActive: new Date().toISOString()
        };

        // Invalidate used OTP
        delete db.otps[cleanEmail];
        writeDb(db);

        return {
            success: true,
            sessionToken,
            user: {
                userId: user.userId,
                email: user.email,
                name: user.name
            }
        };
    },

    // 3. Validate Session
    async validateSession({ token, deviceId }) {
        if (!token) return null;
        const db = readDb();
        const user = db.users.find(u => u.activeSession && u.activeSession.token === token);
        if (!user || !user.activeSession) {
            return null;
        }

        // If device ID was provided and does not match active session device
        if (deviceId && user.activeSession.deviceId && user.activeSession.deviceId !== deviceId) {
            return null;
        }

        // Update lastActive
        user.activeSession.lastActive = new Date().toISOString();
        writeDb(db);

        return {
            userId: user.userId,
            email: user.email,
            name: user.name,
            deviceId: user.activeSession.deviceId,
            sessionCreatedAt: user.activeSession.createdAt
        };
    },

    // 4. Logout (terminates active session on backend)
    async logout({ token }) {
        if (!token) return { success: true };
        const db = readDb();
        const user = db.users.find(u => u.activeSession && u.activeSession.token === token);
        if (user) {
            user.activeSession = null;
            writeDb(db);
        }
        return { success: true, message: 'Logged out successfully' };
    },

    // 5. Update Profile
    async updateProfile({ token, name }) {
        if (!token || !name) throw new Error('Token and name required');
        const db = readDb();
        const user = db.users.find(u => u.activeSession && u.activeSession.token === token);
        if (!user) throw new Error('Unauthorized');

        user.name = String(name).trim().slice(0, 50);
        writeDb(db);
        return {
            success: true,
            user: {
                userId: user.userId,
                email: user.email,
                name: user.name
            }
        };
    },

    // Helper for testing/dev: get active users count
    getUsersCount() {
        const db = readDb();
        return db.users.length;
    }
};

module.exports = AuthService;
