import fetch from 'node-fetch';

const TOKEN = "8512875440:AAE8Jud1g5DoIWVtlYz6MD0YKBBH4ewhTJM";
const CHAT_ID = "-1003397140916";
const DATA_API = "https://tradingpoin.com/chart/api/data?type=json&pair_code=CRYIDX.B&timeframe=5&source=Binomo&val=Z-CRY/IDX&last=60";

let lastAnalysisMin = -1;
let activeTrade = null;
let signalHistory = [];
let batchWins = 0;

async function tg(text) {
    try {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: 'Html' })
        });
    } catch (e) { console.error("TG Error"); }
}

async function getAnalysis() {
    try {
        const res = await fetch(DATA_API);
        const json = await res.json();
        const prices = json.data.map(d => parseFloat(d[4]));
        const currentPrice = prices[prices.length - 1];

        // Indikator MA10 & MA20
        const ma10 = prices.slice(-10).reduce((a, b) => a + b) / 10;
        const ma20 = prices.slice(-20).reduce((a, b) => a + b) / 20;
        
        // Indikator Kekuatan Momentum
        const diffs = [];
        for(let i = prices.length-11; i < prices.length; i++) {
            diffs.push(prices[i] - (prices[i-1] || prices[i]));
        }
        const gains = diffs.filter(d => d > 0).reduce((a,b) => a+b, 0);
        const losses = Math.abs(diffs.filter(d => d < 0).reduce((a,b) => a+b, 0));
        const strength = gains / (gains + losses || 1);

        let score = 0;
        if (currentPrice > ma10 && ma10 > ma20) score += 5;
        if (currentPrice < ma10 && ma10 < ma20) score -= 5;
        if (strength > 0.7) score += 5;
        if (strength < 0.3) score -= 5;

        return { score, price: currentPrice };
    } catch (e) { return null; }
}

setInterval(async () => {
    const now = new Date();
    const min = now.getMinutes();
    const sec = now.getSeconds();

    // 1. ANALISIS WAJIB PER 3 MENIT (Menit :00, :03, dst pada Detik 50)
    if (min % 3 === 0 && sec === 50 && min !== lastAnalysisMin) {
        const data = await getAnalysis();
        if (data && Math.abs(data.score) >= 10) {
            lastAnalysisMin = min;
            
            // Format Jam Open (Analisis 20:00 -> Open 20:01)
            const targetMin = (min + 1) % 60;
            const targetHour = targetMin === 0 ? (now.getHours() + 1) % 24 : now.getHours();
            const jamOpenStr = `${targetHour.toString().padStart(2,'0')}:${targetMin.toString().padStart(2,'0')}`;
            
            const tipe = data.score > 0 ? "BUY" : "SELL";
            const emoji = data.score > 0 ? "🟢" : "🔴";
            
            activeTrade = { 
                jamOpen: jamOpenStr, 
                type: tipe, 
                targetMin: targetMin,
                visualScore: data.score
            };
            
            tg(`🚀 <b>ALICORN V13 | SIGNAL</b>\n\n` +
               `Sinyal: ${emoji} <b>${tipe}</b>\n` +
               `Skor Visual: <b>${data.score > 0 ? '+' : ''}${data.score}</b>\n\n` +
               `⚠️ <b>OPEN POSISI JAM: ${jamOpenStr}:00</b>\n` +
               `${emoji} <b><pre>${tipe === 'BUY' ? 'BUY - HIJAU' : 'SELL - MERAH'}</pre></b>`);
        }
    }

    // 2. VIRTUAL OPEN DI MENIT TARGET (DETIK 00)
    if (sec === 0 && activeTrade && min === activeTrade.targetMin && activeTrade.openPrice === undefined) {
        const data = await getAnalysis();
        if (data) {
            activeTrade.openPrice = data.price;
            activeTrade.expiryMin = (min + 1) % 60;
        }
    }

    // 3. EVALUASI REAL-TIME & RANGKUMAN BATCH
    if (sec === 0 && activeTrade && activeTrade.openPrice !== undefined && min === activeTrade.expiryMin) {
        const data = await getAnalysis();
        if (data) {
            const win = activeTrade.type === 'BUY' ? data.price > activeTrade.openPrice : data.price < activeTrade.openPrice;
            const resEmoji = win ? '✅ PROFIT' : '❌ LOSS';
            if (win) batchWins++;

            // Kirim Hasil Real-time
            tg(`🏁 <b>ALICORN V13 | RESULT</b>\n\n` +
               `Waktu OP: <b>${activeTrade.jamOpen}</b>\n` +
               `Hasil: <b>${resEmoji}</b>`);
            
            // Simpan ke Riwayat berdasarkan JAM OPEN
            signalHistory.push(`[${activeTrade.jamOpen}] ${activeTrade.type} ➔ ${resEmoji}`);
            activeTrade = null;

            // Kirim Rangkuman setiap 10 Sinyal
            if (signalHistory.length >= 10) {
                const wr = (batchWins / 10) * 100;
                tg(`📊 <b>BATCH SUMMARY ALICORN V13</b>\n\n${signalHistory.join('\n')}\n\n<b>WINRATE: ${wr}%</b>`);
                signalHistory = []; batchWins = 0;
            }
        }
    }
}, 1000);

tg("🚀 <b>ALICORN V13 ENGINE SYNCED</b>\nSistem Aktif 24 Jam.");
