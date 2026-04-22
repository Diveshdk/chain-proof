import { supabase } from '../config/supabase';

// users table in Supabase (minimally: wallet_address, nonce)
// CREATE TABLE IF NOT EXISTS users (
//   wallet_address TEXT PRIMARY KEY,
//   nonce          TEXT NOT NULL,
//   username       TEXT,
//   display_name   TEXT,
//   created_at     TIMESTAMPTZ DEFAULT NOW()
// );

export interface UserRow {
  wallet_address: string;
  nonce: string;
  username?: string;
  display_name?: string;
}

export const UserModel = {
  async findByAddress(walletAddress: string): Promise<UserRow | null> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();
    return data || null;
  },

  async upsert(walletAddress: string, nonce: string): Promise<UserRow> {
    const { data, error } = await supabase
      .from('users')
      .upsert({ wallet_address: walletAddress, nonce }, { onConflict: 'wallet_address' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateNonce(walletAddress: string, nonce: string): Promise<void> {
    await supabase
      .from('users')
      .update({ nonce })
      .eq('wallet_address', walletAddress);
  },
};
