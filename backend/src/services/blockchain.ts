// backend/src/services/blockchain.ts
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const CONTRACT_ABI = [
  "function registerTournament(uint256 _timestamp, string memory _name, string memory _winnerName, uint256 _participants) external"
];

export class BlockchainService {
  // 👇 AJOUTEZ DES '?' ICI : Cela dit à TS "C'est peut-être undefined, t'inquiète pas"
  private provider?: ethers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private contract?: ethers.Contract;

  constructor() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const privateKey = process.env.BACKEND_WALLET_PRIVATE_KEY;
    const contractAddress = process.env.TOURNAMENT_CONTRACT_ADDRESS;

    // Si la config manque, on arrête là (et les variables restent undefined)
    if (!rpcUrl || !privateKey || !contractAddress) {
      console.error("❌ Blockchain config missing in .env");
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.wallet);
    } catch (error) {
      console.error("❌ Blockchain initialization failed:", error);
    }
  }

  async recordTournament(name: string, winnerName: string, participantsCount: number) {
    try {
        // On vérifie ici si le contrat existe avant de l'utiliser
        if (!this.contract) throw new Error("Contract not initialized");

        console.log(`🔗 Blockchain: Recording tournament '${name}'...`);

        const timestamp = Math.floor(Date.now() / 1000);

        const tx = await this.contract.registerTournament(
            timestamp,
            name,
            winnerName,
            participantsCount
        );

        console.log(`⏳ Transaction sent: ${tx.hash}. Waiting for confirmation...`);
        
        await tx.wait();

        console.log(`✅ Tournament recorded on blockchain! Block: ${tx.blockNumber}`);
        return tx.hash;

    } catch (error) {
        console.error("❌ Blockchain Error:", error);
    }
  }
}

export const blockchainService = new BlockchainService();