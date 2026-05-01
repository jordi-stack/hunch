const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact: number;
  fee: string;
}

interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: unknown;
  routePlan: unknown[];
}

interface SimulateResult {
  success: boolean;
  expectedOutput: string;
  priceImpact: number;
  error?: string;
}

export class JupiterExecution {
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
  ): Promise<SwapQuote> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: Math.floor(amount).toString(),
      slippageBps: '50',
    });

    try {
      const res = await fetch(`${JUPITER_QUOTE_API}?${params}`);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Jupiter quote failed (${res.status}): ${body}`);
      }

      const data: JupiterQuoteResponse = await res.json();

      return {
        inputMint: data.inputMint,
        outputMint: data.outputMint,
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        priceImpact: parseFloat(data.priceImpactPct),
        fee: data.platformFee ? String(data.platformFee) : '0',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[Jupiter] getQuote failed: ${message}`);
    }
  }

  async getSwapTransaction(
    _quote: SwapQuote,
    _userPublicKey: string,
  ): Promise<unknown> {
    // Stub: in production, this would POST to https://quote-api.jup.ag/v6/swap
    // with the quote and user public key to get a serialized transaction
    console.log('[Jupiter] getSwapTransaction is a stub -- returning placeholder');
    return { serializedTransaction: 'stub', lastValidBlockHeight: 0 };
  }

  async simulateSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
  ): Promise<SimulateResult> {
    try {
      const quote = await this.getQuote(inputMint, outputMint, amount);

      return {
        success: true,
        expectedOutput: quote.outAmount,
        priceImpact: quote.priceImpact,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        expectedOutput: '0',
        priceImpact: 0,
        error: message,
      };
    }
  }
}
