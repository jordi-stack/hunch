import { Bot, InlineKeyboard } from 'grammy';
import type { HunchContext } from './bot.js';
import type { ReasoningResult } from '../agent/reasoning.js';

export function registerActions(bot: Bot<HunchContext>): void {
  bot.callbackQuery(/^execute:(.+)$/, async (ctx) => {
    const memoryId = ctx.match[1];
    await ctx.answerCallbackQuery();
    // TODO: trigger Squads multisig transaction via execution layer (Task 9)
    await ctx.editMessageText(
      `Action submitted for execution.\nMemory ID: ${memoryId}`,
    );
  });

  bot.callbackQuery(/^skip:(.+)$/, async (ctx) => {
    const memoryId = ctx.match[1];
    await ctx.answerCallbackQuery();
    // TODO: update episodic memory with 'skipped' response
    await ctx.editMessageText(
      `Action skipped.\nMemory ID: ${memoryId}`,
    );
  });

  bot.callbackQuery(/^why:(.+)$/, async (ctx) => {
    const memoryId = ctx.match[1];
    // Show reasoning as popup overlay, preserving action buttons
    await ctx.answerCallbackQuery({
      text: `Reasoning trace for ${memoryId}\n(Full trace viewer coming soon)`,
      show_alert: true,
    });
  });
}

export function buildActionCard(
  result: ReasoningResult,
  memoryId: string,
): {
  text: string;
  keyboard: InlineKeyboard;
} {
  const actionLine = result.suggestedAction
    ? `Suggested action: ${result.suggestedAction.type}`
    : 'No action suggested';

  const text = [
    `Decision: ${result.decision}`,
    `Confidence: ${result.confidence.toFixed(2)}`,
    actionLine,
    '',
    result.reasoning.slice(0, 500),
  ].join('\n');

  const keyboard = new InlineKeyboard()
    .text('Execute', `execute:${memoryId}`)
    .text('Skip', `skip:${memoryId}`)
    .row()
    .text('Why?', `why:${memoryId}`);

  return { text, keyboard };
}
