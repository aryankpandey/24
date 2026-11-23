// supabase-config.js – Configuration for Supabase Backend
// Project 24 Premium Theme Monetization System

const SUPABASE_CONFIG = {
    // If you have a Supabase project, enter your Project URL and Anon/Public Key here.
    // If left blank, Project 24 automatically uses its built-in resilient local/indexedDB storage engine.
    url: '',
    anonKey: '',

    isConfigured() {
        return Boolean(this.url && this.anonKey && this.url.startsWith('https://'));
    }
};

window.SUPABASE_CONFIG = SUPABASE_CONFIG;
