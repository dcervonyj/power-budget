-- CLN-032 (audit BE-BUGS-01): a TOTP replacement is stored as a pending secret
-- (Encryption-port ciphertext, context totp:<userId>). The active secret keeps
-- 2FA on until the first valid code of the pending one swaps it in.
ALTER TABLE "totp_secrets" ADD COLUMN "pending_encrypted_secret" text;
