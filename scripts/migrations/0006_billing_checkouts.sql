-- v5: billing checkouts
-- Each PhonePe checkout is recorded under its merchant transaction id, so the payment
-- webhook can find the paying user server-side instead of trusting a user id echoed
-- back by the gateway (KI-36).
CREATE TABLE IF NOT EXISTS billing_checkouts (
    merchant_transaction_id VARCHAR(38)  PRIMARY KEY,
    user_id                 VARCHAR(64)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_tier               VARCHAR(20)  NOT NULL,
    amount_paise            INTEGER      NOT NULL CHECK (amount_paise > 0),
    status                  VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING | SUCCESS | FAILED
    gateway_code            VARCHAR(64),
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_billing_checkouts_user ON billing_checkouts (user_id, created_at DESC);
