import { env } from '../config/env.js';

export interface SquadsConfig {
  multisigAddress: string;
  agentKeypairPath: string;
}

export interface ExecutionCheck {
  allowed: boolean;
  reason?: string;
}

export class SquadsExecution {
  private multisigAddress: string;
  private agentKeypairPath: string;
  private dailySpent: number = 0;
  private spendingCap: number = 10; // SOL, placeholder for hackathon

  constructor(config?: SquadsConfig) {
    this.multisigAddress = config?.multisigAddress ?? env.SQUADS_MULTISIG_ADDRESS ?? '';
    this.agentKeypairPath = config?.agentKeypairPath ?? env.AGENT_KEYPAIR_PATH ?? '';
  }

  async proposeTransaction(
    _transaction: unknown,
    description: string,
  ): Promise<string> {
    // Stub: in production, this would use @sqds/sdk to create a proposal
    // on the Squads multisig configured at this.multisigAddress
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Squads] Proposed transaction: ${description} -> ${proposalId}`);
    return proposalId;
  }

  async approveTransaction(proposalId: string): Promise<string> {
    // Stub: in production, this would submit an approval transaction
    // to the Squads multisig for the given proposal
    const txHash = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Squads] Approved proposal ${proposalId} -> ${txHash}`);
    return txHash;
  }

  async getSpendingCap(): Promise<number> {
    return this.spendingCap;
  }

  async getDailySpent(): Promise<number> {
    return this.dailySpent;
  }

  async canExecute(amount: number): Promise<ExecutionCheck> {
    const cap = await this.getSpendingCap();
    const spent = await this.getDailySpent();

    if (amount <= 0) {
      return { allowed: false, reason: 'Amount must be positive' };
    }

    if (spent + amount > cap) {
      return {
        allowed: false,
        reason: `Would exceed daily cap: ${spent.toFixed(4)} + ${amount.toFixed(4)} > ${cap.toFixed(4)} SOL`,
      };
    }

    if (!this.multisigAddress) {
      return { allowed: false, reason: 'No multisig address configured' };
    }

    return { allowed: true };
  }
}
