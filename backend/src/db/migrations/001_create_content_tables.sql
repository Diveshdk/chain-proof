-- ============================================================
-- Digital Content Copyright Protection System - Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: content
-- One row per uploaded file (image or video)
-- ============================================================
CREATE TABLE IF NOT EXISTS content (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT        NOT NULL,         -- owner wallet address
  ipfs_cid      TEXT        NOT NULL,         -- Pinata IPFS file CID
  metadata_cid  TEXT,                         -- Pinata IPFS metadata JSON CID
  file_name     TEXT,
  file_type     TEXT        NOT NULL DEFAULT 'image',  -- 'image' | 'video'
  royalty_fee   NUMERIC     NOT NULL DEFAULT 0,
  is_original   BOOLEAN     NOT NULL DEFAULT TRUE,
  merkle_root   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: content_hashes
-- One row per pHash (per frame for video, single for image)
-- ============================================================
CREATE TABLE IF NOT EXISTS content_hashes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id       UUID        NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  hash_value       TEXT        NOT NULL,   -- 16-char hex pHash string (64 bits)
  frame_index      INTEGER     NOT NULL DEFAULT 0,
  timestamp_second NUMERIC     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast hash lookup
CREATE INDEX IF NOT EXISTS idx_content_hashes_hash       ON content_hashes(hash_value);
CREATE INDEX IF NOT EXISTS idx_content_hashes_content_id ON content_hashes(content_id);
-- Prefix index for pre-filtering (first 4 chars = 16 bits)
CREATE INDEX IF NOT EXISTS idx_content_hashes_prefix     ON content_hashes(LEFT(hash_value, 4));

-- ============================================================
-- TABLE: copyright_claims
-- Records detected infringement between two pieces of content
-- ============================================================
CREATE TABLE IF NOT EXISTS copyright_claims (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  new_content_id      UUID        REFERENCES content(id) ON DELETE SET NULL,
  matched_content_id  UUID        REFERENCES content(id) ON DELETE SET NULL,
  similarity_score    NUMERIC     NOT NULL,   -- 0.00 to 100.00
  matched_frames      INTEGER     DEFAULT 0,
  total_frames        INTEGER     DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'confirmed' | 'dismissed'
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claims_new_content     ON copyright_claims(new_content_id);
CREATE INDEX IF NOT EXISTS idx_claims_matched_content ON copyright_claims(matched_content_id);
CREATE INDEX IF NOT EXISTS idx_claims_status          ON copyright_claims(status);

-- ============================================================
-- TABLE: users
-- Support for wallet auth and profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  wallet_address TEXT        PRIMARY KEY,
  nonce          TEXT        NOT NULL,
  username       TEXT,
  display_name   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

