-- Enable the PostGIS extension if you need more complex geographical queries, 
-- but for MVP, we'll use a simple Haversine function.

-- 1. Create workers table
CREATE TABLE workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create worksite_settings table (only needs one row for now)
CREATE TABLE worksite_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_lat FLOAT NOT NULL,
    site_lng FLOAT NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 150,
    default_daily_wage NUMERIC NOT NULL DEFAULT 500
);

-- 3. Create attendance table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_lat FLOAT,
    check_in_lng FLOAT,
    distance_from_site FLOAT,
    status TEXT CHECK (status IN ('on_site', 'flagged')),
    wage_for_day NUMERIC,
    UNIQUE (worker_id, date) -- Prevent multiple records for same worker on same day
);

-- 4. Create tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT,
    quantity_target NUMERIC,
    quantity_done NUMERIC,
    assigned_by TEXT -- Could be a UUID if managers have logins, but text for now
);

-- 5. Create a function to calculate distance (Haversine formula in meters)
CREATE OR REPLACE FUNCTION calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
DECLARE
    R float = 6371000;
    toRad float = PI() / 180.0;
    dLat float = (lat2 - lat1) * toRad;
    dLng float = (lon2 - lon1) * toRad;
    a float = sin(dLat / 2) ^ 2 + cos(lat1 * toRad) * cos(lat2 * toRad) * sin(dLng / 2) ^ 2;
    c float = 2 * atan2(sqrt(a), sqrt(1 - a));
BEGIN
    RETURN R * c;
END
$$ LANGUAGE plpgsql;

-- 6. Trigger to automatically calculate distance, status, and set default wage on insert
CREATE OR REPLACE FUNCTION process_attendance_insert()
RETURNS trigger AS $$
DECLARE
    site_setting worksite_settings%ROWTYPE;
BEGIN
    -- Get the worksite settings (assuming single row, limit 1)
    SELECT * INTO site_setting FROM worksite_settings LIMIT 1;
    
    IF FOUND AND NEW.check_in_lat IS NOT NULL AND NEW.check_in_lng IS NOT NULL THEN
        -- Calculate distance
        NEW.distance_from_site = calculate_distance(NEW.check_in_lat, NEW.check_in_lng, site_setting.site_lat, site_setting.site_lng);
        
        -- Set status based on radius
        IF NEW.distance_from_site <= site_setting.radius_meters THEN
            NEW.status = 'on_site';
        ELSE
            NEW.status = 'flagged';
        END IF;
    END IF;

    -- Set default wage if not provided
    IF NEW.wage_for_day IS NULL AND FOUND THEN
        NEW.wage_for_day = site_setting.default_daily_wage;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_before_insert
BEFORE INSERT ON attendance
FOR EACH ROW
EXECUTE FUNCTION process_attendance_insert();


-- Enable RLS (Row Level Security)
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksite_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for workers (anon access) and restricted for managers (authenticated)
-- Workers table
CREATE POLICY "Allow anonymous read access to workers" ON workers FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to workers" ON workers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to workers" ON workers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings table
CREATE POLICY "Allow anonymous read access to settings" ON worksite_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated full access to settings" ON worksite_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Attendance table
CREATE POLICY "Allow anonymous read access to attendance" ON attendance FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert access to attendance" ON attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update access to attendance" ON attendance FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to attendance" ON attendance FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks table
CREATE POLICY "Allow anonymous read access to tasks" ON tasks FOR SELECT TO anon USING (true);
CREATE POLICY "Allow authenticated full access to tasks" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert a default worksite setting row so we can query it
INSERT INTO worksite_settings (site_lat, site_lng, radius_meters, default_daily_wage) 
VALUES (28.6139, 77.2090, 150, 500); -- Defaulting to New Delhi coordinates
