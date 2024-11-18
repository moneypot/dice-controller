export type DbHashchain = {
  id: string;
  user_id: string;
  experience_id: string;
  casino_id: string;
  active: boolean;
  client_seed: string;
};

export type DbHash = {
  id: string;
  type: string;
  hashchain_id: string;
  iteration: number;
};

export type DbDiceBet = {
  id: string;
  user_id: string;
  experience_id: string;
  wager: number;
  target: number;
  actual: number;
  net: number;
  currency_key: string;
  revealed_at: Date | null;
};
