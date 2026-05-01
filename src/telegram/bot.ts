import { Bot, Context, session, SessionFlavor } from 'grammy';
import { env } from '../config/env.js';

export interface SessionData {
  userId?: string;
  walletAddress?: string;
  watchlist: string[];
}

export type HunchContext = Context & SessionFlavor<SessionData>;

export function createBot(): Bot<HunchContext> {
  const bot = new Bot<HunchContext>(env.TELEGRAM_BOT_TOKEN);

  bot.use(
    session({
      initial: (): SessionData => ({
        watchlist: [],
      }),
    }),
  );

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Bot] Error handling update ${ctx.update.update_id}:`, err.error);
  });

  return bot;
}
