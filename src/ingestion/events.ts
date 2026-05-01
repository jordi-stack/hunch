export interface OnchainEvent {
  id: string;
  type: 'price_change' | 'whale_tx' | 'defi_position';
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface PriceChangeEvent extends OnchainEvent {
  type: 'price_change';
  payload: {
    tokenMint: string;
    tokenSymbol: string;
    priceUsd: number;
    changePercent: number;
    timeframe: '1h' | '24h';
  };
}

export interface WhaleTxEvent extends OnchainEvent {
  type: 'whale_tx';
  payload: {
    tokenMint: string;
    tokenSymbol: string;
    amount: number;
    amountUsd: number;
    fromAddress: string;
    toAddress: string;
    txSignature: string;
  };
}

export interface DefiPositionEvent extends OnchainEvent {
  type: 'defi_position';
  payload: {
    protocol: 'marinade' | 'kamino' | 'marginfi';
    positionType: 'stake' | 'lend' | 'borrow';
    tokenMint: string;
    amount: number;
    healthRatio?: number;
    yieldRate?: number;
    change: 'health_improved' | 'health_degraded' | 'yield_changed';
  };
}
