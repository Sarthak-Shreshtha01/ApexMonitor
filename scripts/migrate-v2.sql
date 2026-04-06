-- 1. Create Users Table
CREATE TABLE IF NOT EXISTS users (
    id             VARCHAR(64)  PRIMARY KEY,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    name           VARCHAR(100) NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. Enforce Project Ownership Foreign Key (cite: SRS v2 DB-02)
-- If a user is deleted, we restrict it if they still own projects to prevent orphaned data.
ALTER TABLE projects 
  ADD CONSTRAINT fk_projects_owner 
  FOREIGN KEY (owner_user_id) 
  REFERENCES users(id) 
  ON DELETE RESTRICT;

-- 3. Prepare Metrics for Apdex
-- Add columns to store categorized requests (T = 500ms)
ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS satisfied_count INTEGER DEFAULT 0;
ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS tolerating_count INTEGER DEFAULT 0;
ALTER TABLE hourly_metrics ADD COLUMN IF NOT EXISTS frustrated_count INTEGER DEFAULT 0;

-- 4. Create the Hourly Apdex View (cite: SRS v2 DB-04)
-- Apdex Formula: (Satisfied + (Tolerating / 2)) / Total Requests
CREATE OR REPLACE VIEW hourly_apdex AS
SELECT 
    project_id,
    endpoint,
    hour_bucket,
    request_count,
    satisfied_count,
    tolerating_count,
    frustrated_count,
    CASE 
        WHEN request_count = 0 THEN 1.00 
        ELSE ROUND(((satisfied_count + (tolerating_count / 2.0)) / request_count)::numeric, 2)
    END AS apdex_score
FROM hourly_metrics;