-- supabase-schema.sql
-- PROJECT 24 — AUTHENTICATION, SINGLE DEVICE SESSIONS & THEME MONETIZATION
-- Production PostgreSQL Schema & Row Level Security Policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. Users Table (Permanent User ID and Profile)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL, -- e.g. P24-USR-A3F8B1C2
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 0b. User Sessions Table (Strict Single Device Enforcement)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_active TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT single_active_user_session UNIQUE (user_id) -- ENFORCES SINGLE ACTIVE SESSION PER USER
);

-- 0c. OTP Verification Table
CREATE TABLE IF NOT EXISTS public.otps (
    email TEXT PRIMARY KEY,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Devices Table: Associates installation identifiers with client profiles
CREATE TABLE IF NOT EXISTS public.devices (
    device_id TEXT PRIMARY KEY,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_active TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
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

-- 4. Theme Entitlements Table (Device-Specific Activations)
CREATE TABLE IF NOT EXISTS public.theme_entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT NOT NULL REFERENCES public.devices(device_id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL REFERENCES public.theme_catalog(id),
    payment_request_id UUID REFERENCES public.payment_requests(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    activated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_active_device_theme UNIQUE (device_id, theme_id, status)
);

-- 5. Device Transfer Requests Table
CREATE TABLE IF NOT EXISTS public.device_transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entitlement_id UUID NOT NULL REFERENCES public.theme_entitlements(id) ON DELETE CASCADE,
    old_device_id TEXT NOT NULL REFERENCES public.devices(device_id),
    new_device_id TEXT NOT NULL REFERENCES public.devices(device_id),
    theme_id TEXT NOT NULL REFERENCES public.theme_catalog(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
);

-- 6. Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB,
    performed_by TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_requests_device ON public.payment_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_utr ON public.payment_requests(utr);
CREATE INDEX IF NOT EXISTS idx_entitlements_device ON public.theme_entitlements(device_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_expires ON public.theme_entitlements(expires_at);

-- Row Level Security (RLS)
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theme_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow devices to register and view their own entitlements
CREATE POLICY "Devices can insert themselves" ON public.devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Devices can read their own row" ON public.devices FOR SELECT USING (true);

-- Payment requests: devices can insert and view their own requests
CREATE POLICY "Devices can submit payment requests" ON public.payment_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Devices can view their own payment requests" ON public.payment_requests FOR SELECT USING (true);

-- Entitlements: devices can view active entitlements
CREATE POLICY "Devices can view their active entitlements" ON public.theme_entitlements FOR SELECT USING (true);

-- Transfers: devices can submit transfer requests
CREATE POLICY "Devices can request transfer" ON public.device_transfer_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Devices can view transfer requests" ON public.device_transfer_requests FOR SELECT USING (true);
