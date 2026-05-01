import { Bot } from 'grammy';
import type { HunchContext } from './bot.js';

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function registerCommands(bot: Bot<HunchContext>): void {
  bot.command('start', async (ctx) => {
    const name = ctx.from?.first_name ?? 'there';
    await ctx.reply(
      `Welcome to Hunch, ${name}.\n\n` +
        'Hunch monitors Solana onchain events and proposes actions based on your portfolio.\n\n' +
        'Commands:\n' +
        '/wallet - Set up your Squads multisig\n' +
        '/preferences - View your watchlist and thresholds\n' +
        '/history - View past decisions\n' +
        '/help - Show this list',
    );
  });

  bot.command('wallet', async (ctx) => {
    const current = ctx.session.walletAddress;
    await ctx.reply(
      'To execute onchain actions, Hunch uses a Squads multisig wallet.\n\n' +
        '1. Create a multisig at squads.so\n' +
        '2. Add your agent pubkey as a member\n' +
        '3. Send the multisig address to this chat\n\n' +
        (current ? `Current wallet: ${current}` : 'No wallet linked yet.'),
    );
  });

  bot.command('preferences', async (ctx) => {
    const { watchlist } = ctx.session;

    const watchlistDisplay =
      watchlist.length > 0 ? watchlist.join(', ') : '(none set)';

    await ctx.reply(
      `Current preferences:\n\n` +
        `Watchlist: ${watchlistDisplay}\n` +
        `Confidence threshold: 0.7 (default)\n\n` +
        'To add a token to your watchlist, send its mint address.',
    );
  });

  bot.command('history', async (ctx) => {
    await ctx.reply(
      'Decision history is not yet available. This will show past reasoning results and execution outcomes.',
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      'Hunch commands:\n\n' +
        '/start - Welcome message\n' +
        '/wallet - Set up your Squads multisig\n' +
        '/preferences - View your watchlist and thresholds\n' +
        '/history - View past decisions\n' +
        '/help - Show this list',
    );
  });

  // Handle plain text messages: wallet addresses and token mints
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();

    if (SOLANA_ADDRESS_RE.test(text)) {
      if (!ctx.session.walletAddress) {
        ctx.session.walletAddress = text;
        await ctx.reply(`Wallet linked: ${text}`);
      } else if (ctx.session.watchlist.length < 20) {
        if (!ctx.session.watchlist.includes(text)) {
          ctx.session.watchlist.push(text);
          await ctx.reply(`Added to watchlist: ${text}`);
        } else {
          await ctx.reply('Already in your watchlist.');
        }
      }
    }
  });
}
