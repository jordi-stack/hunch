# Hunch

Your hunch, smarter. An agent that reasons about onchain events from your history.

## What is Hunch?

Hunch is an LLM-powered agent that:
1. Monitors Solana onchain events (price changes, whale transactions, DeFi positions)
2. Reasons about what events mean for YOUR portfolio using your decision history
3. Suggests actions with transparent reasoning traces
4. Executes after your approval via Squads multisig

Unlike generic alert services, Hunch learns from your behavior and personalizes suggestions.

## Quick Start

### Prerequisites
- Node.js 18+
- Telegram Bot Token (from @BotFather)
- Helius API Key (from helius.dev)
- LLM API Key (Anthropic, OpenAI, or Google)

### Setup

1. Clone and install:
```bash
git clone https://github.com/yourusername/hunch.git
cd hunch
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your keys
```

3. Run migrations:
```bash
npm run db:migrate
```

4. Start the agent:
```bash
npm run dev
```

5. Open Telegram and message your bot `/start`

## Architecture

```
Event -> Pre-filter -> LLM Reasoning -> Tool Use -> Proposal -> User Approve -> Execute -> Memory Update
```

### Components
- **Event Ingestion**: Helius webhook for onchain events
- **Pre-filter**: Rule-based filtering (drops 95% of events)
- **Reasoning Engine**: LLM with tool use (provider-agnostic via Vercel AI SDK)
- **Memory**: Episodic (decisions) + Semantic (learned preferences)
- **Execution**: Squads multisig for non-custodial security

### Two-Tier Reasoning

1. **Tier 1 (Triage)**: Fast, cheap model filters irrelevant events
2. **Tier 2 (Deep Reasoning)**: Capable model with tool use for relevant events

## LLM Providers

Hunch supports multiple LLM providers via Vercel AI SDK:

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude Opus, Sonnet, Haiku | Best reasoning |
| OpenAI | GPT-4o, GPT-4o-mini, o1 | Good balance |
| Google | Gemini Pro, Flash | Fast, cheap |
| Ollama | Llama, Mistral, etc. | Self-hosted, free |

Users bring their own API keys (BYOK).

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome and setup |
| `/wallet` | Connect Squads multisig |
| `/preferences` | Set alert thresholds |
| `/history` | View past decisions |
| `/help` | Show commands |

## Development

```bash
npm run dev          # Start with hot reload
npm run test         # Run tests
npm run db:migrate   # Run database migrations
npm run build        # Build for production
```

## Dashboard

The web dashboard is a separate Next.js app:

```bash
cd dashboard
npm install
npm run dev
```

## License

MIT
