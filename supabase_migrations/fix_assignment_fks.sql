-- FIX: Missing Foreign Key for Member Assignments
-- Run this in your Supabase SQL Editor

-- 1. Ensure assigned_member_id references employees
ALTER TABLE work_member_assignments 
DROP CONSTRAINT IF EXISTS fk_member_assignment_employee;

ALTER TABLE work_member_assignments 
ADD CONSTRAINT fk_member_assignment_employee 
FOREIGN KEY (assigned_member_id) REFERENCES employees(id);

-- 2. Ensure assigned_by references employees (optional but good practice)
ALTER TABLE work_member_assignments 
DROP CONSTRAINT IF EXISTS fk_member_assignment_creator;

ALTER TABLE work_member_assignments 
ADD CONSTRAINT fk_member_assignment_creator 
FOREIGN KEY (assigned_by) REFERENCES employees(id);

-- 3. Verify works table has correct defaults
ALTER TABLE works 
ALTER COLUMN assignment_status SET DEFAULT 'UNASSIGNED';

-- 4. Re-run RLS to be safe
ALTER TABLE work_member_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all authenticated access" ON work_member_assignments;
CREATE POLICY "Allow all authenticated access" ON work_member_assignments FOR ALL TO authenticated USING (true);
