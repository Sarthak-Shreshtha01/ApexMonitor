-- 1. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    user_id             VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan_tier           VARCHAR(20) NOT NULL DEFAULT 'FREE', -- 'FREE' or 'PRO'
    last_tx_id          VARCHAR(100),
    payment_status      VARCHAR(50),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Retroactively give existing users a FREE subscription
INSERT INTO subscriptions (user_id, plan_tier) 
SELECT id, 'FREE' FROM users 
ON CONFLICT DO NOTHING;