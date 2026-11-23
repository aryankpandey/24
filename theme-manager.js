// theme-manager.js – Central Theme Engine for Project 24
// Manages the 6 themes, dynamic CSS variable application, and entitlement checking.

(function () {
    const THEME_CATALOG = [
        {
            id: 'dark',
            name: 'Dark',
            type: 'free',
            price: 0,
            desc: 'The original stark, minimalist dark identity of Project 24.',
            colors: ['#050505', '#1a1a1a', '#e0e0e0']
        },
        {
            id: 'white',
            name: 'White',
            type: 'free',
            price: 0,
            desc: 'Clean, high-clarity bright white interface for daytime focus.',
            colors: ['#ffffff', '#f0f0f0', '#111111']
        },
        {
            id: 'purple',
            name: 'Purple',
            type: 'free',
            price: 0,
            desc: 'A rich, premium royal purple aesthetic with subtle lavender accents.',
            colors: ['#0d0714', '#221235', '#c77dff']
        },
        {
            id: 'neon',
            name: 'Neon',
            type: 'premium',
            price: 29,
            durationDays: 365,
            desc: 'High-contrast cyber-neon atmosphere with luminous cyan accents.',
            colors: ['#04080e', '#0f1f2e', '#00f0ff']
        },
        {
            id: 'deep-blue',
            name: 'Deep Blue',
            type: 'premium',
            price: 29,
            durationDays: 365,
            desc: 'Dark midnight navy canvas evoking deep night oceanic calm.',
            colors: ['#060b14', '#132036', '#4a9eff']
        },
        {
            id: 'light-blue',
            name: 'Light Blue',
            type: 'premium',
            price: 29,
            durationDays: 365,
            desc: 'Soft ethereal sky blue tones designed for calm, tranquil pacing.',
            colors: ['#0b151f', '#1a2e42', '#7dd3fc']
        }
    ];

    const STORAGE_KEY = 'p24_active_theme';

    // Synchronously apply active theme before first render to prevent FOUC
    function getStoredTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    function applyThemeToDOM(themeId) {
        const validIds = THEME_CATALOG.map(t => t.id);
        const resolved = validIds.includes(themeId) ? themeId : 'dark';
        document.documentElement.setAttribute('data-theme', resolved);
        
        // Also update meta theme-color for mobile address bars
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            const themeObj = THEME_CATALOG.find(t => t.id === resolved);
            if (themeObj && themeObj.colors && themeObj.colors[0]) {
                metaThemeColor.setAttribute('content', themeObj.colors[0]);
            }
        }
    }

    // Immediately run on script load
    applyThemeToDOM(getStoredTheme());

    // Public Theme Manager API
    window.ThemeManager = {
        getCatalog() {
            return [...THEME_CATALOG];
        },

        getTheme(themeId) {
            return THEME_CATALOG.find(t => t.id === themeId) || THEME_CATALOG[0];
        },

        getCurrentTheme() {
            return getStoredTheme();
        },

        async isUnlocked(themeId) {
            const theme = this.getTheme(themeId);
            if (!theme || theme.type === 'free') {
                return true;
            }
            if (window.StorageService) {
                return await window.StorageService.hasActiveEntitlement(themeId);
            }
            return false;
        },

        async setTheme(themeId) {
            const theme = this.getTheme(themeId);
            if (!theme) return false;

            // Free themes can be set immediately
            if (theme.type === 'free') {
                localStorage.setItem(STORAGE_KEY, theme.id);
                applyThemeToDOM(theme.id);
                window.dispatchEvent(new CustomEvent('p24-theme-changed', { detail: { themeId: theme.id } }));
                return true;
            }

            // Premium themes require entitlement check
            const unlocked = await this.isUnlocked(theme.id);
            if (!unlocked) {
                return false;
            }

            localStorage.setItem(STORAGE_KEY, theme.id);
            applyThemeToDOM(theme.id);
            window.dispatchEvent(new CustomEvent('p24-theme-changed', { detail: { themeId: theme.id } }));
            return true;
        },

        async validateActiveTheme() {
            const current = getStoredTheme();
            const theme = this.getTheme(current);
            if (theme.type === 'premium') {
                const unlocked = await this.isUnlocked(current);
                if (!unlocked) {
                    // Fallback to dark if entitlement expired or invalid
                    console.warn(`Entitlement for ${current} is not active. Falling back to Dark.`);
                    localStorage.setItem(STORAGE_KEY, 'dark');
                    applyThemeToDOM('dark');
                    window.dispatchEvent(new CustomEvent('p24-theme-changed', { detail: { themeId: 'dark' } }));
                }
            }
        }
    };

    // Validate theme validity on page load
    document.addEventListener('DOMContentLoaded', () => {
        window.ThemeManager.validateActiveTheme();
    });
})();
