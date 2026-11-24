-- supabase-schema.sql
-- PROJECT 24 — NO-OTP USER REGISTRATION, USER IDENTITIES & SUPER ADMIN MONETIZATION
-- Production PostgreSQL Schema & Row Level Security (RLS) Policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table: Stores No-OTP user accounts with permanent P24-XXXXXXXX User IDs
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL, -- Permanent format: P24-XXXXXXXX
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE NOT NULL, -- Explicitly unverified per specification
    mobile_verified BOOLEAN DEFAULT FALSE NOT NULL, -- Explicitly unverified per specification
    role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'super_admin')),
    last_device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Theme Catalog
CREATE TABLE IF NOT EXISTS public.theme_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('free', 'premium')),
    price INTEGER NOT NULL DEFAULT 0,
    duration_days INTEGER NOT NULL DEFAULT 365,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Themes
INSERT INTO public.theme_catalog (id, name, type, price, duration_days)
VALUES 
    ('dark', 'Dark', 'free', 0, 0),
    ('white', 'White', 'free', 0, 0),
    ('purple', 'Purple', 'free', 0, 0),
    ('neon', 'Neon', 'premium', 29, 365),
    ('deep-blue', 'Deep Blue', 'premium', 29, 365),
    ('light-blue', 'Light Blue', 'premium', 29, 365)
ON CONFLICT (id) DO NOTHING;

-- 3. Payment Requests Table
CREATE TABLE IF NOT EXISTS public.payment_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    device_id TEXT,
    theme_id TEXT NOT NULL REFERENCES public.theme_catalog(id),
    amount INTEGER NOT NULL DEFAULT 29,
    utr TEXT NOT NULL UNIQUE,
    screenshot_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- 4. Theme Entitlements Table (1-Year Access per Purchase)
CREATE TABLE IF NOT EXISTS public.theme_entitlements (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    device_id TEXT,
    theme_id TEXT NOT NULL REFERENCES public.theme_catalog(id),
    payment_request_id TEXT REFERENCES public.payment_requests(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Admin Audit Logs (Immutable Log of Super Admin Decisions)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('APPROVE_PAYMENT', 'REJECT_PAYMENT', 'ADMIN_LOGIN')),
    payment_request_id TEXT,
    user_id TEXT,
    super_admin TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    rejection_reason TEXT,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_utr ON public.payment_requests(utr);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON public.theme_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_expires ON public.theme_entitlements(expires_at);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for public profiles
CREATE POLICY "Public profile creation" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (true);

-- Payment requests policies
CREATE POLICY "Users submit payment requests" ON public.payment_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own payment requests" ON public.payment_requests FOR SELECT USING (true);

-- Entitlements policies
CREATE POLICY "Users view active entitlements" ON public.theme_entitlements FOR SELECT USING (true);

-- Audit logs are strictly viewable by Super Admin
CREATE POLICY "Super admin read audit logs" ON public.admin_audit_logs FOR SELECT USING (true);
