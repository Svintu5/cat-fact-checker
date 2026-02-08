"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { callVerifyFact, connectMetaMask, clearWalletCache } from "@/lib/genlayer/client";

export const dynamic = 'force-dynamic'

type FactResult = {
  verdict: "true" | "false" | "partial" | "unknown";
  confidence: number;
  explanation: string;
};

// Ключ для хранения результата в localStorage
const LOCAL_STORAGE_KEY = 'mochi_last_fact_result';

export default function HomePage() {
  const searchParams = useSearchParams();
  
  // 1. Инициализируем локальное состояние из URL (выполнится один раз)
  const [localFact, setLocalFact] = useState(searchParams.get('fact') || '');
  
  const [result, setResult] = useState<FactResult | null>(null); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // 2. Функция для "тихой" синхронизации URL (чтобы курсор не прыгал)
  const syncUrl = (fact: string) => {
    const params = new URLSearchParams(window.location.search);
    if (fact) {
      params.set('fact', fact);
    } else {
      params.delete('fact');
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  };

  // --- Эффекты для LocalStorage ---

  // 1. Загрузка результата из localStorage при монтировании
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedResult = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedResult) {
        try {
          setResult(JSON.parse(storedResult));
        } catch (e) {
          console.error("Failed to parse stored result:", e);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }
  }, []); 

  // 2. Сохранение результата в localStorage при его изменении
  useEffect(() => {
    if (typeof window !== 'undefined') {
        if (result) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result));
        } else {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
    }
  }, [result]);


  // --- Функции для взаимодействия ---

  const connect = async () => {
    setError(null);
    try {
      const addr = await connectMetaMask();
      setWalletAddress(addr);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to connect wallet");
    }
  };

 const disconnect = () => {
    // 1. Очищаем локальное состояние
    setWalletAddress(null);
    // 2. Очищаем кэш в client.ts (должна быть функция clearCache)
    clearWalletCache(); 
    // 3. Перезагружаем страницу, чтобы сбросить провайдер
    window.location.reload(); 
  };
  
    const askMochi = async () => {
    setError(null);
    setResult(null); 
    
    // 3. Используем localFact вместо urlFact
    if (!localFact.trim()) return; 

    if (!walletAddress) {
      setError("Connect your wallet before asking Mochi.");
      return;
    }

    setLoading(true);
    try {
      // Передаем localFact
      const output = await callVerifyFact(localFact);
      let parsed: FactResult;
      // ... дальше стандартная обработка JSON ...
      if (typeof output === "string") {
        try {
          parsed = JSON.parse(output);
        } catch {
          parsed = { verdict: "unknown", confidence: 0, explanation: "Failed to parse result." };
        }
      } else {
        parsed = output as FactResult;
      }
      setResult(parsed); 
    } catch (e: any) {
      setError(e?.message ?? "Error calling verify_fact");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get color based on verdict
  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case 'true':
        return { bg: 'bg-[#58d645]', text: 'text-[#58d645]' }; // зеленый
      case 'false':
        return { bg: 'bg-[#c71c33]', text: 'text-[#c71c33]' }; // красный
      case 'partial':
        return { bg: 'bg-[#FFA500]', text: 'text-[#FFA500]' }; // оранжевый
      case 'unknown':
        return { bg: 'bg-gray-500', text: 'text-gray-500' }; // серый
      default:
        return { bg: 'bg-gray-500', text: 'text-gray-500' };
    }
  };

  return (
    // 1. Убираем bg-black, фон теперь задан в body в globals.css
    <div className="min-h-screen flex flex-col text-white relative overflow-hidden"> 
      
      {/* Background: Переопределяем градиент под акцентные цвета */}
      <div className="pointer-events-none absolute inset-0 opacity-30 bg-grid" />
      {/* Используем переменные: from[Primary]/10 to[Secondary]/10 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[var(--accent)]/10 via-transparent to-[var(--secondary-accent)]/10" />

      {/* Navbar */}
      <header className="relative z-10 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 2. GL logo*/}
            <div className="relative h-10">
                 <img 
                    src="/gl.svg" 
                    alt="GL Logo" 
                    className="h-full w-full object-contain"
                />
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            {/* 1. УСЛОВНЫЙ РЕНДЕР: Кнопка "Logout" или "Connect" */}
            {walletAddress ? (
                // --- КНОПКА LOGOUT ---
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                        {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                    </span>
                    <button
                        onClick={disconnect}
                        // Используем Secondary Accent для Logout
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold 
                                 border border-white/20 
                                 bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        Disconnect
                    </button>
                </div>
            ) : (
                // --- КНОПКА CONNECT ---
                <button
                    onClick={() => void connect()}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/20 
                                 bg-[var(--accent)] text-[var(--dark-text)] hover:bg-[#8F5FFF] transition-colors"
                >
                    Connect wallet
                </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 pt-10 pb-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <section className="text-center mb-10 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight flex items-center justify-center">
              <span className="inline-block animate-bounce [animation-duration:1s] mr-4 text-[#A378FF]">
                🐾
              </span>
              Mochi checks your cat facts
              <span className="inline-block animate-bounce [animation-duration:1s] ml-4 text-[#A378FF]">
                🐾
              </span>
            </h1>
            <p className="text-base md:text-lg text-gray-300 max-w-2xl mx-auto">
              Type any statement about cats — cyber‑cat Mochi will ask GenLayer
              and return a verdict with an explanation
            </p>
          </section>

          {/* Form */}
          <section className="glass-card p-8 md:p-10 relative group">

  {/* Декоративный уголок */}
  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/10 to-transparent opacity-20 rounded-tr-[1.25rem]" />
  
{/* СТАТИЧНЫЙ КОТ СПРАВА */}
  <div className="absolute -right-8 md:-right-15 top-0 -translate-y-[70%] z-20 group">
    <div className="relative">
      {/* Мягкое свечение за котом под цвет бренда */}
        <div className="absolute inset-0 bg-[var(--accent)] opacity-20 blur-3xl group-hover:opacity-40 transition-opacity" />
      <img
        src="/mochi_sit.png"
        alt="Mochi Mascot"
        className="relative w-32 h-32 md:w-45 md:h-45 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transform group-hover:scale-110 transition-transform duration-500"
      />
    </div>
  </div>

  <form onSubmit={(e) => { e.preventDefault(); void askMochi(); }} className="relative z-10 space-y-6">
    <label className="block space-y-3">
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--accent)] font-semibold ml-1">
        Input Protocol
      </span>
      <input
        value={localFact} 
        onChange={(e) => {
          setLocalFact(e.target.value);
          syncUrl(e.target.value);
        }}
        type="text"
        className="glass-input w-full text-white rounded-xl px-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#A378FF] focus:border-[#A378FF] placeholder:text-gray-500 transition-all"
        placeholder='e.g. "Cats have 32 muscles in each ear"'
      />
    </label>

    <div className="flex items-center justify-between">
      <button
        type="submit"
        className="px-8 py-3 rounded-xl font-bold text-sm tracking-wider uppercase disabled:opacity-50 transition-all 
                   bg-[#A378FF] text-black shadow-[0_0_20px_rgba(163,120,255,0.3)] hover:shadow-[0_0_30px_rgba(163,120,255,0.5)] 
                   active:scale-95"
        disabled={loading || !localFact.trim() || !walletAddress}
      >
        {loading ? "Processing..." : "Check"}
      </button>
      
      {loading && (
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-[#A378FF] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
          <span className="w-1.5 h-1.5 bg-[#A378FF] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
          <span className="w-1.5 h-1.5 bg-[#A378FF] rounded-full animate-bounce"></span>
        </div>
      )}
    </div>
  </form>
</section>

{result && (
  <section className="mt-10 glass-card p-1 md:p-[1px] bg-gradient-to-br from-white/20 to-transparent">
    <div className="bg-[#39345C]/90 backdrop-blur-2xl rounded-[1.2rem] p-10 md:p-9 flex flex-col md:flex-row items-center gap-8">
      
      <div className="flex-1 space-y-5">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-black/30 rounded-md border border-white/10">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Status: Finalized</span>
          </div>
          <div className={`h-2 w-2 rounded-full animate-pulse ${getVerdictColor(result.verdict).bg}`} />
        </div>

        <div className="space-y-2">
          <h2 className={`text-3xl font-black uppercase tracking-tighter ${getVerdictColor(result.verdict).text}`}>
            {result.verdict}
          </h2>
          <p className="text-gray-300 text-sm leading-relaxed font-light">
            {result.explanation}
          </p>
        </div>

        <div className="pt-4 flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase text-gray-500 font-bold">Confidence Level</span>
            <span className="text-lg font-mono text-[var(--accent)]">{result.confidence}%</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase text-gray-500 font-bold">AI Protocol</span>
            <span className="text-xs text-gray-300 uppercase">GenLayer Consensus</span>
          </div>
        </div>
      </div>

    </div>
  </section>
)}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-3">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-gray-500">
          Live on GenLayer StudioNet · Made for fun and education 
        </div>
      </footer>
    </div>
  );
}
