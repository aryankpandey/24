// tests/test-no-otp-auth.js
// Comprehensive End-to-End Test Suite for Project 24 No-OTP Auth & Super Admin Dashboard

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AuthService = require('../backend/auth-service.js');

async function runTests() {
    console.log('=== STARTING PROJECT 24 AUTH & MONETIZATION VERIFICATION ===\n');

    // 1. NO-OTP Registration Tests
    console.log('[TEST 1] No-OTP User Registration Validation');
    try {
        await AuthService.registerUser({ fullName: '', mobileNumber: '1234567890', email: 'test@example.com' });
        assert.fail('Should fail on empty name');
    } catch (e) {
        assert(e.message.includes('full name'), 'Validation error message for name');
    }

    try {
        await AuthService.registerUser({ fullName: 'John Doe', mobileNumber: '123', email: 'test@example.com' });
        assert.fail('Should fail on short mobile number');
    } catch (e) {
        assert(e.message.includes('10-digit mobile number'), 'Validation error message for mobile');
    }

    try {
        await AuthService.registerUser({ fullName: 'John Doe', mobileNumber: '9876543210', email: 'invalid-email' });
        assert.fail('Should fail on invalid email');
    } catch (e) {
        assert(e.message.includes('valid email'), 'Validation error message for email');
    }
    console.log('  -> Input validations PASSED\n');

    // 2. Successful Registration with Permanent User ID
    console.log('[TEST 2] Successful No-OTP User Account Creation & ID Format');
    const timestamp = Date.now();
    const testEmail = `user_${timestamp}@example.com`;
    const testMobile = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regResult = await AuthService.registerUser({
        fullName: 'Aryan Test User',
        mobileNumber: testMobile,
        email: testEmail
    });

    assert(regResult.success === true, 'Registration succeeded');
    assert(regResult.token, 'Session token issued');
    assert(regResult.user, 'User object returned');

    // Check P24-XXXXXXXX format (8 uppercase hex/alphanumeric chars)
    const userIdRegex = /^P24-[A-F0-9]{8}$/;
    assert(userIdRegex.test(regResult.user.userId), `User ID (${regResult.user.userId}) matches format P24-XXXXXXXX`);

    // Strict requirement: email and mobile must be unverified
    assert(regResult.user.emailVerified === false, 'emailVerified must be false (strictly no OTP)');
    assert(regResult.user.mobileVerified === false, 'mobileVerified must be false (strictly no OTP)');
    assert(regResult.user.role === 'user', 'Normal user role must be "user"');
    console.log(`  -> User ID: ${regResult.user.userId}`);
    console.log(`  -> emailVerified: ${regResult.user.emailVerified}, mobileVerified: ${regResult.user.mobileVerified}`);
    console.log('  -> Permanent User ID and unverified contact flags PASSED\n');

    // 3. Repeat Registration / Account Restoration (No Duplicate User IDs)
    console.log('[TEST 3] Account Restoration & Duplicate Prevention');
    const repeatResult = await AuthService.registerUser({
        fullName: 'Aryan Test User Updated',
        mobileNumber: testMobile,
        email: testEmail
    });
    assert.strictEqual(repeatResult.user.userId, regResult.user.userId, 'User ID remains permanent and identical across repeat registration');
    console.log('  -> Account restoration without duplicate accounts PASSED\n');

    // 4. Super Admin Security Isolation
    console.log('[TEST 4] Super Admin Security Isolation');
    const adminRegResult = await AuthService.registerUser({
        fullName: 'Aryan Impersonator',
        mobileNumber: '9998887776',
        email: 'aryanpandey7161@gmail.com'
    });
    // Entering Super Admin email in normal registration must NOT grant super_admin role
    assert.strictEqual(adminRegResult.user.role, 'user', 'Normal registration with admin email must NEVER grant super_admin role');

    // Super Admin login requires correct password
    try {
        await AuthService.loginSuperAdmin({ email: 'aryanpandey7161@gmail.com', password: 'wrongpassword' });
        assert.fail('Should fail on wrong admin password');
    } catch (e) {
        assert(e.message.includes('Invalid Super Admin credentials') || e.message.includes('credentials'));
    }

    // Unauthorized email cannot login as super admin even with password
    try {
        await AuthService.loginSuperAdmin({ email: 'hacker@example.com', password: '24admin' });
        assert.fail('Should fail for non-super-admin email');
    } catch (e) {
        assert(e.message.includes('Unauthorized'), 'Non-admin email rejected');
    }

    // Correct Super Admin Login
    const adminLogin = await AuthService.loginSuperAdmin({ email: 'aryanpandey7161@gmail.com', password: '24admin' });
    assert(adminLogin.success === true, 'Admin login succeeded');
    assert.strictEqual(adminLogin.user.role, 'super_admin');
    const adminToken = adminLogin.token;
    console.log('  -> Super Admin security isolation PASSED\n');

    // 5. Admin: Fetch Registered Users Directory
    console.log('[TEST 5] Super Admin User Directory');
    const users = await AuthService.getAllUsers({ token: adminToken });
    assert(Array.isArray(users), 'Users directory is an array');
    assert(users.length > 0, 'Registered users present');
    const foundUser = users.find(u => u.userId === regResult.user.userId);
    assert(foundUser, 'Registered user exists in directory');
    console.log(`  -> Successfully retrieved ${users.length} registered users`);
    console.log('  -> User directory access PASSED\n');

    // 6. Payment Request and Approval Workflow
    console.log('[TEST 6] Payment Request Submission & Super Admin Approval');
    const testUtr = 'UTR' + Date.now().toString().slice(-8);
    const paymentReq = await AuthService.createPaymentRequest({
        token: regResult.token,
        userId: regResult.user.userId,
        themeId: 'neon',
        amount: 29,
        utr: testUtr,
        screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    });
    assert.strictEqual(paymentReq.status, 'pending');
    assert.strictEqual(paymentReq.utr, testUtr);
    assert.strictEqual(paymentReq.userId, regResult.user.userId);

    // Approve Payment
    const approveResult = await AuthService.approvePayment({
        token: adminToken,
        requestId: paymentReq.id
    });
    assert.strictEqual(approveResult.request.status, 'approved');
    assert.strictEqual(approveResult.entitlement.userId, regResult.user.userId);
    assert.strictEqual(approveResult.entitlement.themeId, 'neon');

    // Verify 1-Year Expiration
    const activatedAt = new Date(approveResult.entitlement.activatedAt);
    const expiresAt = new Date(approveResult.entitlement.expiresAt);
    const diffDays = Math.round((expiresAt - activatedAt) / (1000 * 60 * 60 * 24));
    assert(diffDays >= 365 && diffDays <= 366, `Entitlement is 1 year (calculated ${diffDays} days)`);

    // Verify Audit Log
    const auditLogs = await AuthService.getAuditLogs({ token: adminToken });
    const logEntry = auditLogs.find(l => l.paymentRequestId === paymentReq.id);
    assert(logEntry, 'Audit log entry created');
    assert.strictEqual(logEntry.action, 'APPROVE_PAYMENT');
    assert.strictEqual(logEntry.superAdmin, 'aryanpandey7161@gmail.com');
    console.log('  -> Payment submission, approval, 1-year entitlement, and audit logging PASSED\n');

    // 7. Payment Rejection Workflow
    console.log('[TEST 7] Payment Rejection Workflow with Required Reason');
    const rejectUtr = 'UTR' + (Date.now() + 1).toString().slice(-8);
    const rejectPaymentReq = await AuthService.createPaymentRequest({
        userId: regResult.user.userId,
        themeId: 'deep-blue',
        amount: 29,
        utr: rejectUtr,
        screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    });

    try {
        await AuthService.rejectPayment({ token: adminToken, requestId: rejectPaymentReq.id, reason: '' });
        assert.fail('Rejection without reason must fail');
    } catch (e) {
        assert(e.message.includes('reason is strictly required'));
    }

    const rejectResult = await AuthService.rejectPayment({
        token: adminToken,
        requestId: rejectPaymentReq.id,
        reason: 'Invalid UPI reference / Screenshot blurry'
    });
    assert.strictEqual(rejectResult.status, 'rejected');
    assert.strictEqual(rejectResult.rejectionReason, 'Invalid UPI reference / Screenshot blurry');
    console.log('  -> Payment rejection with mandatory audit reason PASSED\n');

    // 8. Static Page Integrity Tests
    console.log('[TEST 8] HTML Page Navigation & Profile Integrity');
    const profileHtml = fs.readFileSync(path.join(__dirname, '..', 'profile.html'), 'utf8');
    assert(!profileHtml.includes('btn-logout'), 'Profile page must NOT have a normal user logout button');
    assert(profileHtml.includes('Unverified'), 'Profile page displays Unverified indicators');
    assert(profileHtml.includes('Permanent User ID'), 'Profile page displays Permanent User ID');

    // Check menu link order across all core pages
    const pagesToCheck = [
        'index.html', 'about.html', 'contact.html', 'tools.html',
        'year-tracker.html', 'countdown.html', 'goal-reminder.html',
        'focus-mode.html', 'life-moments.html', 'settings.html', 'profile.html'
    ];

    for (const page of pagesToCheck) {
        const content = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
        const navMatch = content.match(/<nav class="menu-nav">([\s\S]*?)<\/nav>/);
        assert(navMatch, `${page} contains <nav class="menu-nav">`);
        const navContent = navMatch[1];

        const pIdx = navContent.indexOf('profile.html');
        const aIdx = navContent.indexOf('about.html');
        const cIdx = navContent.indexOf('contact.html');
        const tIdx = navContent.indexOf('tools.html');
        const sIdx = navContent.indexOf('settings.html');

        assert(pIdx !== -1 && aIdx !== -1 && cIdx !== -1 && tIdx !== -1 && sIdx !== -1, `${page} contains all 5 menu links in nav`);
        assert(pIdx < aIdx && aIdx < cIdx && cIdx < tIdx && tIdx < sIdx, `${page} has exact menu order: Profile -> About -> Contact -> Tools -> Settings`);
    }
    console.log(`  -> Verified hamburger menu order on all ${pagesToCheck.length} pages: Profile -> About -> Contact -> Tools -> Settings`);
    console.log('  -> Page integrity & navigation checks PASSED\n');

    console.log('====================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (8/8)!');
    console.log('====================================================');
}

runTests().catch(err => {
    console.error('\nFAILED WITH ERROR:', err);
    process.exit(1);
});
