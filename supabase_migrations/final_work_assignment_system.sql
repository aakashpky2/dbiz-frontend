-- FINAL WORK ASSIGNMENT SYSTEM MIGRATION
-- This script ensures all tables and columns for the Work Assignment workflow exist.
-- It uses safe idempotent checks (IF NOT EXISTS) and DO blocks.

-- 1. Ensure app_settings table is correctly structured
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure default setting for auto-assignment
INSERT INTO app_settings (key, value, description)
VALUES ('work_auto_assignment_enabled', 'false', 'Enable automatic work assignment to eligible teams upon creation')
ON CONFLICT (key) DO NOTHING;

-- 2. Update works table with assignment columns
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='works' AND column_name='assigned_team_id') THEN
        ALTER TABLE works ADD COLUMN assigned_team_id UUID REFERENCES teams(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='works' AND column_name='assignment_status') THEN
        ALTER TABLE works ADD COLUMN assignment_status TEXT DEFAULT 'UNASSIGNED';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='works' AND column_name='assigned_at') THEN
        ALTER TABLE works ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='works' AND column_name='assigned_by') THEN
        ALTER TABLE works ADD COLUMN assigned_by UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='works' AND column_name='auto_assigned') THEN
        ALTER TABLE works ADD COLUMN auto_assigned BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 3. Create work_member_assignments table
CREATE TABLE IF NOT EXISTS work_member_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    work_item_id UUID, -- For granular tasks within a work
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    assigned_member_id UUID NOT NULL REFERENCES employees(id),
    assigned_by UUID,
    status TEXT DEFAULT 'ASSIGNED',
    priority TEXT,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(work_id, work_item_id, assigned_member_id)
);

-- 4. Create work_assignment_history table
CREATE TABLE IF NOT EXISTS work_assignment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_id UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
    old_team_id UUID REFERENCES teams(id),
    new_team_id UUID REFERENCES teams(id),
    old_member_id UUID REFERENCES employees(id),
    new_member_id UUID REFERENCES employees(id),
    action TEXT NOT NULL, -- 'AUTO_ASSIGNED', 'TEAM_ASSIGNED', 'MEMBER_ASSIGNED', 'REASSIGNED', etc.
    reason TEXT,
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. RLS Policies
ALTER TABLE work_member_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated access" ON work_member_assignments;
CREATE POLICY "Allow all authenticated access" ON work_member_assignments FOR ALL TO authenticated USING (true);

ALTER TABLE work_assignment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated access" ON work_assignment_history;
CREATE POLICY "Allow all authenticated access" ON work_assignment_history FOR ALL TO authenticated USING (true);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON app_settings;
CREATE POLICY "Enable read access for authenticated users" ON app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable all access for admins" ON app_settings;
CREATE POLICY "Enable all access for admins" ON app_settings FOR ALL TO authenticated USING (true);
