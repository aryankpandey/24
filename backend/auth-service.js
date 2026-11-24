// backend/auth-service.js
// Core Server-Side Authentication & Super Admin Engine for Project 24
// Enforces No-OTP User Registration, Permanent P24-XXXXXXXX User IDs,
// Persistent Sessions, Exclusive Super Admin Authorization, and Audited Payment Workflows.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'auth-db.json');

const SUPER_ADMIN_EMAIL = 'aryanpandey7161@gmail.com';
const SUPER_ADMIN_DEFAULT_PASS = process.env.SUPER_ADMIN_PASSWORD || '24admin';

// Initialize JSON database if not present
function initDb() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [],
            adminSessions: {},
            paymentRequests: [],
            entitlements: [],
            auditLogs: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    }
}

function readDb() {
    initDb();
    try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (!data.users) data.users = [];
        if (!data.adminSessions) data.adminSessions = {};
        if (!data.paymentRequests) data.paymentRequests = [];
        if (!data.entitlements) data.entitlements = [];
        if (!data.auditLogs) data.auditLogs = [];
        return data;
    } catch (e) {
        return { users: [], adminSessions: {}, paymentRequests: [], entitlements: [], auditLogs: [] };
    }
}

function writeDb(data) {
    initDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Generate permanent, unique Project 24 User ID: P24-XXXXXXXX
function generatePermanentUserId(existingUsers) {
    let userId = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 100) {
        attempts++;
        const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
        userId = `P24-${rand}`;
        isUnique = !existingUsers.some(u => u.userId === userId);
    }
    return userId;
}

const AuthService = {
    getSuperAdminEmail() {
        return SUPER_ADMIN_EMAIL;
    },

    // 1. NO-OTP User Registration
    async registerUser({ fullName, mobileNumber, email, deviceId }) {
        if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
            throw new Error('Please enter your full name (minimum 2 characters)');
        }
        if (!mobileNumber || typeof mobileNumber !== 'string') {
            throw new Error('Please enter a valid mobile number');
        }
        const cleanMobile = mobileNumber.replace(/\D/g, '');
        if (cleanMobile.length < 10) {
            throw new Error('Please enter a valid 10-digit mobile number');
        }
        if (!email || typeof email !== 'string') {
            throw new Error('Please enter a valid email address');
        }
        const cleanEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            throw new Error('Please enter a valid email address');
        }

        const db = readDb();
        const cleanName = fullName.trim();
        const now = new Date().toISOString();

        // Check if an account already exists with this email
        let user = db.users.find(u => u.email === cleanEmail);

        if (user) {
            // Restore existing account seamlessly to prevent duplicate accounts
            user.fullName = cleanName;
            user.mobileNumber = cleanMobile;
            user.updatedAt = now;
            if (deviceId) {
                user.lastDeviceId = deviceId;
            }
        } else {
            // Check if mobile number is already used under a different email
            const existingMobileUser = db.users.find(u => u.mobileNumber === cleanMobile);
            if (existingMobileUser) {
                throw new Error('This mobile number is already registered with another account.');
            }

            // Create new user profile with permanent User ID
            const newUserId = generatePermanentUserId(db.users);
            user = {
                id: crypto.randomUUID(),
                userId: newUserId,
                fullName: cleanName,
                mobileNumber: cleanMobile,
                email: cleanEmail,
                emailVerified: false, // Strict requirement: unverified contact info
                mobileVerified: false, // Strict requirement: unverified contact info
                role: 'user', // Normal user registration NEVER grants admin privileges
                createdAt: now,
                updatedAt: now,
                lastDeviceId: deviceId || null
            };
            db.users.push(user);
        }

        // Establish secure authenticated session token
        const token = crypto.randomBytes(32).toString('hex');
        user.sessionToken = token;
        user.lastActive = now;

        writeDb(db);

        // Sanitize return object
        const sanitizedUser = {
            id: user.id,
            userId: user.userId,
            fullName: user.fullName,
            mobileNumber: user.mobileNumber,
            email: user.email,
            emailVerified: user.emailVerified,
            mobileVerified: user.mobileVerified,
            role: user.role,
            createdAt: user.createdAt
        };

        return {
            success: true,
            token,
            user: sanitizedUser
        };
    },

    // 2. Super Admin Authentication (Separately Secured with Password)
    async loginSuperAdmin({ email, password }) {
        if (!email || !password) {
            throw new Error('Email and password are required');
        }
        const cleanEmail = email.trim().toLowerCase();

        // Strict Super Admin Identity Check
        if (cleanEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
            throw new Error('Unauthorized: This email does not have Super Admin privileges');
        }

        if (password !== SUPER_ADMIN_DEFAULT_PASS) {
            throw new Error('Invalid Super Admin credentials');
        }

        const db = readDb();
        const token = crypto.randomBytes(32).toString('hex');
        const now = new Date().toISOString();

        db.adminSessions[token] = {
            email: SUPER_ADMIN_EMAIL,
            role: 'super_admin',
            createdAt: now,
            lastActive: now
        };

        writeDb(db);

        return {
            success: true,
            token,
            user: {
                email: SUPER_ADMIN_EMAIL,
                role: 'super_admin',
                fullName: 'Super Administrator'
            }
        };
    },

    // 3. Validate Session (Normal User or Super Admin)
    async validateSession({ token, deviceId }) {
        if (!token) return null;
        const db = readDb();

        // Check if admin session
        if (db.adminSessions && db.adminSessions[token]) {
            const admin = db.adminSessions[token];
            admin.lastActive = new Date().toISOString();
            writeDb(db);
            return {
                email: admin.email,
                role: 'super_admin',
                fullName: 'Super Administrator'
            };
        }

        // Check normal user session
        const user = db.users.find(u => u.sessionToken === token);
        if (!user) return null;

        user.lastActive = new Date().toISOString();
        if (deviceId) user.lastDeviceId = deviceId;
        writeDb(db);

        return {
            id: user.id,
            userId: user.userId,
            fullName: user.fullName,
            mobileNumber: user.mobileNumber,
            email: user.email,
            emailVerified: user.emailVerified,
            mobileVerified: user.mobileVerified,
            role: user.role || 'user',
            createdAt: user.createdAt
        };
    },

    // 4. Verify Super Admin Token
    verifySuperAdmin(token) {
        if (!token) return false;
        const db = readDb();
        const admin = db.adminSessions[token];
        return Boolean(admin && admin.role === 'super_admin' && admin.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    },

    // 5. Admin: Get All Registered Users
    async getAllUsers({ token }) {
        if (!this.verifySuperAdmin(token)) {
            throw new Error('Unauthorized: Super Admin privileges required');
        }
        const db = readDb();
        return db.users.map(u => ({
            id: u.id,
            userId: u.userId,
            fullName: u.fullName,
            mobileNumber: u.mobileNumber,
            email: u.email,
            emailVerified: u.emailVerified,
            mobileVerified: u.mobileVerified,
            createdAt: u.createdAt,
            lastActive: u.lastActive
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // 6. Payment Requests
    async createPaymentRequest({ token, userId, themeId, amount, utr, screenshot }) {
        const cleanUtr = String(utr || '').trim().toUpperCase();
        if (!cleanUtr || cleanUtr.length < 6) {
            throw new Error('Valid UTR / reference number (min 6 characters) is required');
        }
        if (!themeId) {
            throw new Error('Theme identifier is required');
        }
        if (!screenshot) {
            throw new Error('Payment confirmation screenshot is required');
        }

        const db = readDb();

        // Check for duplicate UTR
        const duplicate = db.paymentRequests.find(r => r.utr === cleanUtr);
        if (duplicate) {
            throw new Error(`Transaction reference ${cleanUtr} has already been submitted.`);
        }

        // Get user details
        let user = null;
        if (token) {
            user = await this.validateSession({ token });
        }
        if (!user && userId) {
            user = db.users.find(u => u.userId === userId);
        }

        const effectiveUserId = user ? user.userId : (userId || 'GUEST');
        const effectiveUserName = user ? user.fullName : 'Guest User';
        const effectiveUserEmail = user ? user.email : '';

        const request = {
            id: 'req_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
            userId: effectiveUserId,
            userName: effectiveUserName,
            userEmail: effectiveUserEmail,
            themeId,
            amount: Number(amount) || 29,
            utr: cleanUtr,
            screenshot,
            status: 'pending', // 'pending' | 'approved' | 'rejected'
            rejectionReason: null,
            submittedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedBy: null
        };

        db.paymentRequests.push(request);
        writeDb(db);

        return request;
    },

    async getPaymentRequests({ token, filter = {} }) {
        const db = readDb();
        const isAdmin = this.verifySuperAdmin(token);

        let list = [...db.paymentRequests];

        if (!isAdmin) {
            // Normal user: filter by own userId
            const user = await this.validateSession({ token });
            if (!user) return [];
            list = list.filter(r => r.userId === user.userId);
        } else if (filter.status && filter.status !== 'all') {
            list = list.filter(r => r.status === filter.status);
        }

        return list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    },

    // 7. Admin: Approve Payment
    async approvePayment({ token, requestId }) {
        if (!this.verifySuperAdmin(token)) {
            throw new Error('Unauthorized: Super Admin privileges required');
        }
        const db = readDb();
        const request = db.paymentRequests.find(r => r.id === requestId);
        if (!request) {
            throw new Error('Payment request not found');
        }
        if (request.status === 'approved') {
            throw new Error('This payment request has already been approved');
        }

        const now = new Date();
        const previousStatus = request.status;
        request.status = 'approved';
        request.reviewedAt = now.toISOString();
        request.reviewedBy = SUPER_ADMIN_EMAIL;

        // Calculate 1-year entitlement
        const expiresAt = new Date(now);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        const entitlement = {
            id: 'ent_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex'),
            userId: request.userId,
            themeId: request.themeId,
            paymentRequestId: request.id,
            status: 'active',
            activatedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            createdAt: now.toISOString()
        };
        db.entitlements.push(entitlement);

        // Immutable Audit Log
        db.auditLogs.push({
            id: 'log_' + Date.now(),
            action: 'APPROVE_PAYMENT',
            paymentRequestId: request.id,
            userId: request.userId,
            superAdmin: SUPER_ADMIN_EMAIL,
            previousStatus,
            newStatus: 'approved',
            timestamp: now.toISOString(),
            details: {
                themeId: request.themeId,
                amount: request.amount,
                utr: request.utr,
                expiresAt: expiresAt.toISOString()
            }
        });

        writeDb(db);

        return { request, entitlement };
    },

    // 8. Admin: Reject Payment
    async rejectPayment({ token, requestId, reason }) {
        if (!this.verifySuperAdmin(token)) {
            throw new Error('Unauthorized: Super Admin privileges required');
        }
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            throw new Error('A rejection reason is strictly required');
        }

        const db = readDb();
        const request = db.paymentRequests.find(r => r.id === requestId);
        if (!request) {
            throw new Error('Payment request not found');
        }

        const now = new Date();
        const previousStatus = request.status;
        request.status = 'rejected';
        request.rejectionReason = reason.trim();
        request.reviewedAt = now.toISOString();
        request.reviewedBy = SUPER_ADMIN_EMAIL;

        // Immutable Audit Log
        db.auditLogs.push({
            id: 'log_' + Date.now(),
            action: 'REJECT_PAYMENT',
            paymentRequestId: request.id,
            userId: request.userId,
            superAdmin: SUPER_ADMIN_EMAIL,
            previousStatus,
            newStatus: 'rejected',
            rejectionReason: reason.trim(),
            timestamp: now.toISOString(),
            details: {
                themeId: request.themeId,
                amount: request.amount,
                utr: request.utr
            }
        });

        writeDb(db);

        return request;
    },

    // 9. Admin: Get Audit Logs
    async getAuditLogs({ token }) {
        if (!this.verifySuperAdmin(token)) {
            throw new Error('Unauthorized: Super Admin privileges required');
        }
        const db = readDb();
        return db.auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // 10. Get Active Entitlements for User
    async getUserEntitlements(userId) {
        const db = readDb();
        const now = new Date();
        return db.entitlements.filter(e => 
            e.userId === userId &&
            e.status === 'active' &&
            new Date(e.expiresAt) > now
        );
    },

    // 11. Admin Logout
    async logoutAdmin(token) {
        if (!token) return { success: true };
        const db = readDb();
        if (db.adminSessions[token]) {
            delete db.adminSessions[token];
            writeDb(db);
        }
        return { success: true };
    }
};

module.exports = AuthService;
