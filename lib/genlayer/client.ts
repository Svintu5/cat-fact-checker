"use client";

import { createClient } from "genlayer-js"; 
import { studionet } from "genlayer-js/chains";

let cachedAddress: string | undefined;

export function getContractAddress(): string {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
  }
  return address;
}

// Тип провайдера MetaMask
interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function getEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum || null;
}

// Явное подключение MetaMask
export async function connectMetaMask(): Promise<string> {
  const provider = getEthereumProvider();
  if (!provider) throw new Error("MetaMask is not installed");

  const accounts = await provider.request({
    method: "eth_requestAccounts",
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found");
  }

  const addr = accounts[0] as string;
  cachedAddress = addr;
  return addr;
}

// Создание GenLayer‑клиента (genlayer-js)
export function createGenLayerClient(address?: string) {
  const config: any = {
    chain: studionet,
  };

  if (address) {
    config.account = address as `0x${string}`;
  }

  return createClient(config);
}

// Получение клиента с текущим аккаунтом MetaMask (если он есть)
export async function getClient() {
  if (cachedAddress) {
    return createGenLayerClient(cachedAddress);
  }

  const provider = getEthereumProvider();
  let address: string | undefined;

  if (provider) {
    const accounts = await provider.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      address = accounts[0];
      cachedAddress = address;
    }
  }

  return createGenLayerClient(address);
}

// ABI контракта CatFactChecker
const CAT_FACT_ABI = [
  {
    type: "function",
    name: "verify_fact",
    stateMutability: "nonpayable",
    inputs: [{ name: "fact", type: "string" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export async function callVerifyFact(fact: string) {
  const client: any = await getClient();
  const contractAddress = getContractAddress();

  // 1. Отправляем транзакцию
  const txHash = await client.writeContract({
    address: contractAddress,
    abi: CAT_FACT_ABI,
    functionName: "verify_fact",
    args: [fact],
  });

  // 2. Ждём финализации транзакции
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: 'FINALIZED' as any, // Ждём FINALIZED статус
    retries: 100,
    interval: 2000,
  });

  // 3. Проверяем, достигнут ли консенсус
  if (receipt.result_name === "MAJORITY_DISAGREE" || receipt.status_name === "UNDETERMINED") {
    throw new Error("Consensus was not reached. Validators could not agree on the result.");
  }

  // 4. Извлекаем результат из payload.readable
  const leaderReceipt = receipt.consensus_data?.leader_receipt;

  if (!leaderReceipt || leaderReceipt.length === 0) {
    throw new Error("No leader_receipt found in consensus_data");
  }

  // Результат находится в result.payload.readable
  let verdictJson =
    leaderReceipt[0]?.result?.payload?.readable ||
    leaderReceipt[1]?.result?.payload?.readable;

  if (!verdictJson || typeof verdictJson !== 'string') {
    console.error("Invalid result format:", verdictJson);
    throw new Error("Result not found in payload.readable");
  }

  // Парсим JSON (он экранированный, нужно убрать лишние кавычки)
  try {
    // Убираем внешние кавычки если есть
    if (verdictJson.startsWith('"') && verdictJson.endsWith('"')) {
      verdictJson = verdictJson.slice(1, -1);
    }
    // Заменяем экранированные кавычки
    verdictJson = verdictJson.replace(/\\"/g, '"');

    // Проверяем что это валидный JSON
    JSON.parse(verdictJson);

    return verdictJson;
  } catch (e) {
    console.error("Failed to parse result JSON:", e);
    throw new Error("Contract returned invalid JSON format");
  }
}

export function clearWalletCache(): void {
  cachedAddress = undefined;
}