-- 1. Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies for app_settings
CREATE POLICY "Enable read access for authenticated users" ON app_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable all access for admins" ON app_settings
    FOR ALL TO authenticated USING (true); -- Simplified for now, can be restricted by role later

-- Insert default setting
INSERT INTO app_settings (key, value, description)
VALUES ('work_auto_assignment_enabled', 'false', 'Enable automatic work assignment to eligible teams upon creation')
ON CONFLICT (key) DO NOTHING;

-- 2. Update works table schema
ALTER TABLE works 
ADD COLUMN IF NOT EXISTS assigned_team_id UUID REFERENCES teams(id),
ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'UNASSIGNED',
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by UUID,
ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN DEFAULT FALSE;

-- 3. Create work_member_assignments table
CREATE TABLE IF NOT EXISTS work_member_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_id UUID REFERENCES works(id) ON DELETE CASCADE,
    work_item_id UUID, -- Optional, for granular tasks
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    assigned_member_id UUID NOT NULL REFERENCES employees(id), -- employee_id
    assigned_by UUID,
    status TEXT DEFAULT 'ASSIGNED',
    priority TEXT,
    due_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(work_id, work_item_id, assigned_member_id)
);

ALTER TABLE work_member_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated access" ON work_member_assignments FOR ALL TO authenticated USING (true);

-- 4. Create work_assignment_history table
CREATE TABLE IF NOT EXISTS work_assignment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_id UUID REFERENCES works(id) ON DELETE CASCADE,
    old_team_id UUID,
    new_team_id UUID,
    old_member_id UUID,
    new_member_id UUID,
    action TEXT NOT NULL, -- 'AUTO_ASSIGNED', 'TEAM_ASSIGNED', 'MEMBER_ASSIGNED', 'REASSIGNED', etc.
    reason TEXT,
    performed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE work_assignment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all authenticated access" ON work_assignment_history FOR ALL TO authenticated USING (true);
