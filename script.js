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

// Start loop
requestAnimationFrame(update);
