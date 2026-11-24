const countdownEl = document.getElementById('countdown');
const dateEl = document.getElementById('date');
const timezoneEl = document.getElementById('timezone');

function padZero(num) {
    return num.toString().padStart(2, '0');
}

function getLocalMidnight(now) {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Sets to next local midnight
    return midnight;
}

function updateState(hoursRemaining) {
    document.body.className = '';
    
    if (hoursRemaining < (10 / 60)) {
        // < 10 minutes
        document.body.classList.add('state-warning');
    } else if (hoursRemaining < 1) {
        // < 1 hour
        document.body.classList.add('state-strong-urgency');
    } else if (hoursRemaining < 6) {
        // 1-6 hours
        document.body.classList.add('state-urgency');
    } else if (hoursRemaining < 12) {
        // 6-12 hours
        document.body.classList.add('state-tense');
    }
}

function formatDate(date) {
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options).toUpperCase();
}

let lastRenderedTime = '';

function update() {
    const now = new Date();
    const midnight = getLocalMidnight(now);
    
    let remainingMs = midnight.getTime() - now.getTime();
    
    // Prevent negative time just in case
    if (remainingMs <= 0) {
        remainingMs = 0;
    }
    
    // Calculate h, m, s
    const totalSeconds = Math.floor(remainingMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    const timeString = `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
    
    if (timeString !== lastRenderedTime) {
        countdownEl.textContent = timeString;
        lastRenderedTime = timeString;
        
        const hoursRemaining = totalSeconds / 3600;
        updateState(hoursRemaining);
        
        dateEl.textContent = formatDate(now);
        
        let tz = 'UNKNOWN';
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch (e) {
            // fallback
        }
        timezoneEl.textContent = `LOCAL · ${tz.toUpperCase()}`;
    }
    
    requestAnimationFrame(update);
}

// Handle visibility change to force immediate update when resuming from sleep
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        lastRenderedTime = ''; // Force DOM update on next frame
    }
});

// Start loop only on pages with the countdown element
if (countdownEl) {
    requestAnimationFrame(update);
}

// Enforce Authentication Gate
if (window.AuthClient && !window.location.pathname.endsWith('login.html')) {
    window.AuthClient.requireAuth();
}

// Menu & Navigation Interaction Logic
const menuBtn = document.getElementById('menuBtn');
const menuOverlay = document.getElementById('menuOverlay');
const closeBtn = document.getElementById('closeBtn');
const backBtn = document.getElementById('backBtn');

function openMenu() {
    if (menuOverlay) {
        menuOverlay.classList.add('active');
        // Push state for Android native back button handling
        try {
            history.pushState({ menuOpen: true }, '');
        } catch (e) {
            // fallback if pushState is restricted
        }
    }
}

function closeMenu(skipHistory = false) {
    if (menuOverlay && menuOverlay.classList.contains('active')) {
        menuOverlay.classList.remove('active');
        if (!skipHistory && history.state && history.state.menuOpen) {
            history.back();
        }
    }
}

if (menuBtn) {
    menuBtn.addEventListener('click', openMenu);
}

if (closeBtn) {
    closeBtn.addEventListener('click', () => closeMenu());
}

// Close overlay when clicking outside the content box
if (menuOverlay) {
    menuOverlay.addEventListener('click', (e) => {
        if (e.target === menuOverlay) {
            closeMenu();
        }
    });
}

// Android native back button & browser back navigation handling
window.addEventListener('popstate', (e) => {
    if (menuOverlay && menuOverlay.classList.contains('active')) {
        menuOverlay.classList.remove('active');
    }
});

// Close menu on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOverlay && menuOverlay.classList.contains('active')) {
        closeMenu();
    }
});

// Back navigation button handling
if (backBtn) {
    backBtn.addEventListener('click', (e) => {
        if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
            e.preventDefault();
            window.history.back();
        }
    });
}

// Menu links navigation handling
document.querySelectorAll('.menu-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        const currentPath = window.location.pathname;
        const currentPage = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';
        
        // If clicking current page, close menu without unnecessary reload
        if (href === currentPage || (href === 'index.html' && (currentPage === '' || currentPage === 'index.html'))) {
            e.preventDefault();
            closeMenu();
        } else {
            // Closing menu state before navigating
            if (menuOverlay) {
                menuOverlay.classList.remove('active');
            }
        }
    });
});

// Enforce Persistent Session on Protected Application Pages
if (window.AuthClient && typeof window.AuthClient.requireAuth === 'function') {
    const isAuthPage = document.body.classList.contains('auth-page') || document.body.classList.contains('admin-page');
    if (!isAuthPage) {
        window.AuthClient.requireAuth();
    }
}


