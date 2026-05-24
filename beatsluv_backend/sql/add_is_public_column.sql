-- Add is_public column to tracks table for privacy control
ALTER TABLE tracks
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
-- Set existing tracks to public by default (optional - you can change this)
UPDATE tracks
SET is_public = TRUE
WHERE is_public IS NULL;