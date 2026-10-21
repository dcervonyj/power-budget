-- CLN-004 (audit M9): last accepted TOTP time step, so a code is accepted once.
ALTER TABLE "totp_secrets" ADD COLUMN "last_used_time_step" bigint;--> statement-breakpoint
-- CLN-004 (audit H5): secrets are now stored as Encryption-port ciphertext
-- ("env-v1:aes-256-gcm:..."). SQL cannot encrypt with the app KEK, and no
-- plaintext row can hold a working enrolment: until this release
-- POST /auth/totp/enable demanded a TOTP step-up that only an existing
-- enrolment could give (audit C7), so the API never created a row. Any row
-- that is not ciphertext (seeded or inserted by hand) is removed; the user
-- simply enrols again.
DELETE FROM "totp_secrets" WHERE "encrypted_secret" NOT LIKE 'env-v1:%';
