-- Sessions signed before a password change, reset or revocation stop working.
-- Additive only: existing logins start at version 0 and stay signed in.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
