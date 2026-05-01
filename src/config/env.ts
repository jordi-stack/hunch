import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
  HELIUS_API_KEY: z.string(),
  HELIUS_WEBHOOK_SECRET: z.string(),
  TELEGRAM_BOT_TOKEN: z.string(),
  SQUADS_MULTISIG_ADDRESS: z.string().optional(),
  AGENT_KEYPAIR_PATH: z.string().optional(),
});

export const env = envSchema.parse(process.env);
