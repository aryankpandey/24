// tools.js – Implements Hours Left and Year Progress tools
import {
  getTimeDifference,
  formatDateLong,
  getStartOfYear,
  getStartOfNextYear,
  isLeapYear
} from './utils.js';

// =============================================
// HOURS LEFT (COUNTDOWN)
// =============================================
const targetDateInput = document.getElementById('targetDate');
const targetTimeInput = document.getElementById('targetTime');
const hoursResultEl   = document.getElementById('hoursResult');
const resetBtn        = document.getElementById('resetHours');
const presetButtons   = document.querySelectorAll('.preset-btn');

let hoursAnimId = null;
let lastHoursRender = '';

/**
 * Builds a local Date from separate date and time input values.
 * Avoids ambiguous Date.parse by using component constructor.
 */
function buildTargetDate() {
  if (!targetDateInput) return null;
  const dateVal = targetDateInput.value; // "YYYY-MM-DD"
  if (!dateVal) return null;

  const [y, mo, d] = dateVal.split('-').map(Number);
  const timeVal = targetTimeInput ? targetTimeInput.value : ''; // "HH:MM" or ""
  let h = 0, mi = 0;
  if (timeVal) {
    const parts = timeVal.split(':').map(Number);
    h = parts[0];
    mi = parts[1];
  }
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function renderHoursCountdown() {
  if (!hoursResultEl) return;
  const target = buildTargetDate();
  if (!target) {
    hoursResultEl.textContent = '--';
    hoursResultEl.classList.remove('past');
    lastHoursRender = '--';
    return;
  }

  const diff = getTimeDifference(target);

  if (diff.totalMs === 0) {
    if (lastHoursRender !== 'past') {
      hoursResultEl.textContent = 'This moment has passed.';
      hoursResultEl.classList.add('past');
      lastHoursRender = 'past';
    }
    return;
  }

  hoursResultEl.classList.remove('past');
  const { days, hours, minutes, seconds, totalHours } = diff;
  const pad = n => String(n).padStart(2, '0');
  const str = `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s · ${totalHours.toFixed(2)}h`;
  if (str !== lastHoursRender) {
    hoursResultEl.textContent = str;
    lastHoursRender = str;
  }
}

function hoursLoop() {
  if (!hoursResultEl) return;
  renderHoursCountdown();
  hoursAnimId = requestAnimationFrame(hoursLoop);
}

function startHoursLoop() {
  lastHoursRender = '';
  renderHoursCountdown();
  if (!hoursAnimId) {
    hoursLoop();
  }
}

if (targetDateInput && hoursResultEl) {
  // Preset buttons set date and kick off the loop
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const offset = Number(btn.dataset.offset);
      const now = new Date();
      const future = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 0, 0);
      const yyyy = future.getFullYear();
      const mm = String(future.getMonth() + 1).padStart(2, '0');
      const dd = String(future.getDate()).padStart(2, '0');
      targetDateInput.value = `${yyyy}-${mm}-${dd}`;
      if (targetTimeInput) targetTimeInput.value = '';
      startHoursLoop();
    });
  });

  targetDateInput.addEventListener('change', startHoursLoop);
  if (targetTimeInput) targetTimeInput.addEventListener('change', startHoursLoop);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      targetDateInput.value = '';
      if (targetTimeInput) targetTimeInput.value = '';
      hoursResultEl.textContent = '--';
      hoursResultEl.classList.remove('past');
      lastHoursRender = '--';
    });
  }

  // Start hours loop if element is present
  hoursLoop();
}

// =============================================
// YEAR PROGRESS (YEAR TRACKER)
// =============================================
const yearPercentEl = document.getElementById('yearPercent');
const yearBarEl     = document.getElementById('yearBar');
const yearInfoEl    = document.getElementById('yearInfo');
const yearDetailsEl = document.getElementById('yearDetails');

let lastYearRender = '';

function updateYearProgress() {
  if (!yearPercentEl || !yearBarEl) return;
  const now   = new Date();
  const year  = now.getFullYear();
  const start = getStartOfYear(now);
  const next  = getStartOfNextYear(now);

  const totalMs   = next - start;
  const elapsedMs = now - start;
  const percent   = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

  const daysTotal     = isLeapYear(year) ? 366 : 365;
  const daysElapsed   = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = daysTotal - daysElapsed;

  const key = `${year}-${percent.toFixed(2)}`;
  if (key === lastYearRender) return;
  lastYearRender = key;

  yearPercentEl.textContent = `${percent.toFixed(1)}%`;
  yearBarEl.style.width = `${percent}%`;

  if (yearInfoEl) {
    yearInfoEl.textContent = `${formatDateLong(now)} · ${year}${isLeapYear(year) ? ' (LEAP)' : ''}`;
  }
  if (yearDetailsEl) {
    yearDetailsEl.textContent = `${daysElapsed} days elapsed · ${daysRemaining} days remaining`;
  }
}

function yearLoop() {
  if (!yearPercentEl) return;
  updateYearProgress();
  requestAnimationFrame(yearLoop);
}

if (yearPercentEl && yearBarEl) {
  // Start year loop if element is present
  yearLoop();
}

// Handle visibility change – force re-render on tab return
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastHoursRender = '';
    lastYearRender = '';
  }
});
