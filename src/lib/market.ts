export type BarTuple = [number, number, number, number, number, number]; // [tsSec, open, high, low, close, vol]

export type SymbolCode = 'BTC' | 'ETH' | 'ANT' | 'SOL' | 'DOGE' | 'ZEC' | 'PEPE' | 'WLD';

export interface ContractSpec {
  sym: SymbolCode;
  name: string;
  instId: string;
  spotId: string;
  unit: string;
  ctVal: number;
  lotSz: number;
  mmr: number;
  maxLev: number;
  recLev: number;
  recRiskPct: number;
  decimals: number;
  fundingIntervalHours: number;
  fallbackPrice: number;
  fallbackVol24hUsd: number;
  fallbackFundingPct: number;
  fallbackRs14dPct: number;
  fallbackAtrPct: number;
  floatRatioPct: number;
  defaultSetup: [number, number, number];
}

export const CONTRACTS: Record<SymbolCode, ContractSpec> = {
  BTC: {
    sym: 'BTC',
    name: '比特币',
    instId: 'BTC-USDT-SWAP',
    spotId: 'BTC-USDT',
    unit: 'BTC',
    ctVal: 0.01,
    lotSz: 0.01,
    mmr: 0.004,
    maxLev: 100,
    recLev: 5,
    recRiskPct: 1.0,
    decimals: 1,
    fundingIntervalHours: 8,
    fallbackPrice: 61984.8,
    fallbackVol24hUsd: 4820,
    fallbackFundingPct: -0.0047,
    fallbackRs14dPct: 0.0,
    fallbackAtrPct: 4.27,
    floatRatioPct: 94.4,
    defaultSetup: [62000, 60500, 65000],
  },
  ETH: {
    sym: 'ETH',
    name: '以太坊',
    instId: 'ETH-USDT-SWAP',
    spotId: 'ETH-USDT',
    unit: 'ETH',
    ctVal: 0.1,
    lotSz: 0.01,
    mmr: 0.004,
    maxLev: 100,
    recLev: 5,
    recRiskPct: 1.0,
    decimals: 2,
    fundingIntervalHours: 8,
    fallbackPrice: 1757.55,
    fallbackVol24hUsd: 2610,
    fallbackFundingPct: 0.0013,
    fallbackRs14dPct: -3.2,
    fallbackAtrPct: 5.86,
    floatRatioPct: 100.0,
    defaultSetup: [1750, 1690, 1870],
  },
  ANT: {
    sym: 'ANT',
    name: 'Anthropic 永续',
    instId: 'ANTHROPIC-USDT-SWAP',
    spotId: 'ANT-USDT',
    unit: '股',
    ctVal: 1,
    lotSz: 0.001,
    mmr: 0.0125,
    maxLev: 20,
    recLev: 3,
    recRiskPct: 0.5,
    decimals: 2,
    fundingIntervalHours: 8,
    fallbackPrice: 92.19,
    fallbackVol24hUsd: 310,
    fallbackFundingPct: 0.0187,
    fallbackRs14dPct: 4.5,
    fallbackAtrPct: 7.4,
    floatRatioPct: 18.0,
    defaultSetup: [92, 88, 100],
  },
  SOL: {
    sym: 'SOL',
    name: 'Solana',
    instId: 'SOL-USDT-SWAP',
    spotId: 'SOL-USDT',
    unit: 'SOL',
    ctVal: 1,
    lotSz: 0.01,
    mmr: 0.004,
    maxLev: 100,
    recLev: 3,
    recRiskPct: 0.5,
    decimals: 2,
    fundingIntervalHours: 8,
    fallbackPrice: 69.7,
    fallbackVol24hUsd: 805,
    fallbackFundingPct: 0.0085,
    fallbackRs14dPct: 9.4,
    fallbackAtrPct: 6.28,
    floatRatioPct: 81.5,
    defaultSetup: [70, 65.5, 79],
  },
  DOGE: {
    sym: 'DOGE',
    name: 'Dogecoin',
    instId: 'DOGE-USDT-SWAP',
    spotId: 'DOGE-USDT',
    unit: 'DOGE',
    ctVal: 1000,
    lotSz: 0.01,
    mmr: 0.0065,
    maxLev: 50,
    recLev: 3,
    recRiskPct: 0.5,
    decimals: 5,
    fundingIntervalHours: 8,
    fallbackPrice: 0.05532,
    fallbackVol24hUsd: 184,
    fallbackFundingPct: 0.0042,
    fallbackRs14dPct: 8.6,
    fallbackAtrPct: 6.31,
    floatRatioPct: 100.0,
    defaultSetup: [0.055, 0.051, 0.063],
  },
  ZEC: {
    sym: 'ZEC',
    name: 'Zcash',
    instId: 'ZEC-USDT-SWAP',
    spotId: 'ZEC-USDT',
    unit: 'ZEC',
    ctVal: 0.01,
    lotSz: 1,
    mmr: 0.004,
    maxLev: 75,
    recLev: 2,
    recRiskPct: 0.25,
    decimals: 2,
    fundingIntervalHours: 8,
    fallbackPrice: 739.71,
    fallbackVol24hUsd: 880,
    fallbackFundingPct: 0.0312,
    fallbackRs14dPct: 16.8,
    fallbackAtrPct: 12.01,
    floatRatioPct: 78.2,
    defaultSetup: [1213, 1314, 1011],
  },
  PEPE: {
    sym: 'PEPE',
    name: 'Pepe',
    instId: 'PEPE-USDT-SWAP',
    spotId: 'PEPE-USDT',
    unit: 'PEPE',
    ctVal: 10000000,
    lotSz: 0.1,
    mmr: 0.0065,
    maxLev: 50,
    recLev: 2,
    recRiskPct: 0.25,
    decimals: 8,
    fundingIntervalHours: 8,
    fallbackPrice: 0.00000331,
    fallbackVol24hUsd: 178,
    fallbackFundingPct: -0.118,
    fallbackRs14dPct: 11.2,
    fallbackAtrPct: 10.8,
    floatRatioPct: 100.0,
    defaultSetup: [0.00000331, 0.00000302, 0.0000039],
  },
  WLD: {
    sym: 'WLD',
    name: 'Worldcoin',
    instId: 'WLD-USDT-SWAP',
    spotId: 'WLD-USDT',
    unit: 'WLD',
    ctVal: 1,
    lotSz: 1,
    mmr: 0.0065,
    maxLev: 50,
    recLev: 2,
    recRiskPct: 0.25,
    decimals: 4,
    fundingIntervalHours: 8,
    fallbackPrice: 0.2359,
    fallbackVol24hUsd: 52,
    fallbackFundingPct: -0.019,
    fallbackRs14dPct: -11.4,
    fallbackAtrPct: 11.49,
    floatRatioPct: 14.8,
    defaultSetup: [0.2359, 0.259, 0.189],
  },
};

export function fmtPrice(val: number, decimals?: number): string {
  if (!Number.isFinite(val)) return '0';
  const a = Math.abs(val);
  const d =
    decimals !== undefined
      ? decimals
      : a >= 1000
        ? 0
        : a >= 100
          ? 1
          : a >= 1
            ? 2
            : a >= 0.1
              ? 3
              : a >= 0.001
                ? 4
                : 8;
  return val.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtBarTime(tsSec: number, intraday: boolean): string {
  const d = new Date((tsSec + (intraday ? 8 * 3600 : 0)) * 1000);
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return intraday ? `${ymd} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : ymd;
}

export function calcSma(rows: BarTuple[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    sum += rows[i][4];
    if (i >= period) sum -= rows[i - period][4];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function calcAtr(rows: BarTuple[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let avg = 0;
  for (let i = 1; i < rows.length; i++) {
    const [, , h, l] = rows[i];
    const prevClose = rows[i - 1][4];
    const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    if (i <= period) {
      avg += tr / period;
      out.push(i === period ? avg : null);
    } else {
      avg = (avg * (period - 1) + tr) / period;
      out.push(avg);
    }
  }
  return out;
}

export function calcIsolatedLiq(
  entry: number,
  lev: number,
  mmr: number,
  isLong: boolean,
): number {
  const takerFee = 0.0005;
  return isLong
    ? (entry * (1 - 1 / lev)) / (1 - mmr - takerFee)
    : (entry * (1 + 1 / lev)) / (1 + mmr + takerFee);
}
