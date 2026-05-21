-- Add AIRBNB to CanalSync enum for outbound sync logs
ALTER TYPE "CanalSync" ADD VALUE IF NOT EXISTS 'AIRBNB';
