'use client';

import { useEffect, useState, useCallback } from 'react';

/* ─── TYPES ─── */
interface ParsedCandle { time: number; open: number; high: number; low: number; close: number; volume: number }
interface Indicators {
  sma10:number; sma20:number; sma50:number; rsi14:number;
  macd:number; macdSignal:number; macdHist:number;
  stochK:number; stochD:number; kdjK:number; kdjD:number; kdjJ:number;
  cci:number; adx:number;
  bbUpper:number; bbMiddle:number; bbLower:number; bbPercentB:number;
}
interface SRLevel { price:number; strength:number; type:'support'|'resistance' }
interface LiqZone { priceLow:number; priceHigh:number; valueUsd:number; side:'long'|'short' }
interface AppData {
  price:number; change24h:number; change7d:number; change30d:number;
  high24h:number; low24h:number; marketCap:number; volume24h:number;
  oiUsd:number; oiTokens:number; funding8h:number; fundingAnn:number;
  indicators:Indicators; srLevels:{supports:SRLevel[];resistances:SRLevel[]};
  liqZones:LiqZone[]; lastUpdated:number; timeframe:string;
}
type SigAct = 'strong_buy'|'buy'|'neutral'|'sell'|'strong_sell';
interface Signal { action:SigAct; display:string; score:number; summary:string; buy:number; sell:number; neutral:number; }

/* ─── CONSTANTS ─── */
const HL_API = 'https://api.hyperliquid.xyz/info';
const CG_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=hyperliquid&vs_currencies=usd&include_market_cap=true';
const TF: Record<string,{interval:string; tvRes:string; days:number; label:string}> = {
  '1h': {interval:'1h',  tvRes:'60',  days:7,   label:'1H'},
  '4h': {interval:'4h',  tvRes:'240', days:30,  label:'4H'},
  '1d': {interval:'1d',  tvRes:'D',   days:365, label:'1D'},
};

/* ─── HELPERS ─── */
const fmt = (n:number,d=2) => { if(!n||isNaN(n))return'—';if(Math.abs(n)>=1e9)return`$${(Math.abs(n)/1e9).toFixed(d)}B`;if(Math.abs(n)>=1e6)return`$${(Math.abs(n)/1e6).toFixed(d)}M`;if(Math.abs(n)>=1e3)return`$${(Math.abs(n)/1e3).toFixed(1)}K`;return`$${n.toFixed(d)}`; };
const fmtPct = (n:number) => `${n>=0?'+':''}${n.toFixed(2)}%`;
const timeAgo = (ts:number) => { const s=Math.floor((Date.now()-ts)/1000);return s<60?`${s}s`:s<3600?`${Math.floor(s/60)}m`:`${Math.floor(s/3600)}h`; };
const isStale = (ts:number) => (Date.now()-ts)>120000;

/* ─── INDICATORS ─── */
function SMA(d:number[],p:number):number[]{if(d.length<p)return[];const r:number[]=[];for(let i=p-1;i<d.length;i++)r.push(d.slice(i-p+1,i+1).reduce((a,b)=>a+b,0)/p);return r;}
function EMA(d:number[],p:number):number[]{if(d.length<p)return[];const k=2/(p+1);const r:number[]=[d.slice(0,p).reduce((a,b)=>a+b,0)/p];for(let i=p;i<d.length;i++)r.push(d[i]*k+r[r.length-1]*(1-k));return r;}
function RSI(d:number[],p=14):number{if(d.length<p+1)return 50;const ch=d.slice(1).map((c,i)=>c-d[i]);let g=ch.slice(0,p).filter(x=>x>0).reduce((a,b)=>a+b,0)/p,l=ch.slice(0,p).filter(x=>x<0).reduce((a,b)=>a+Math.abs(b),0)/p;for(let i=p;i<ch.length;i++){g=(g*(p-1)+Math.max(ch[i],0))/p;l=(l*(p-1)+Math.max(-ch[i],0))/p;}return l===0?100:100-100/(1+g/l);}
function MACD(c:number[]):{macd:number;signal:number;hist:number}{const e12=EMA(c,12),e26=EMA(c,26);if(!e12.length||!e26.length)return{macd:0,signal:0,hist:0};const ml:number[]=[];const off=e12.length-Math.min(e12.length,e26.length);for(let i=0;i<Math.min(e12.length,e26.length);i++)ml.push(e12[i+off]-e26[i]);const sl=EMA(ml,9);if(!sl.length)return{macd:0,signal:0,hist:0};const mv=ml[ml.length-1],sv=sl[sl.length-1];return{macd:mv,signal:sv,hist:mv-sv};}
function Stoch(h:number[],l:number[],c:number[],kP=14,dP=3):{k:number;d:number}{if(c.length<kP)return{k:50,d:50};const kv:number[]=[];for(let i=kP-1;i<c.length;i++){const hh=Math.max(...h.slice(i-kP+1,i+1)),ll=Math.min(...l.slice(i-kP+1,i+1));kv.push(hh===ll?50:((c[i]-ll)/(hh-ll))*100);}const dv=SMA(kv,dP);return{k:kv[kv.length-1]||50,d:dv[dv.length-1]||50};}
function KDJ(h:number[],l:number[],c:number[],p=9):{k:number;d:number;j:number}{if(c.length<p)return{k:50,d:50,j:50};const rv:number[]=[];for(let i=p-1;i<c.length;i++){const hh=Math.max(...h.slice(i-p+1,i+1)),ll=Math.min(...l.slice(i-p+1,i+1));rv.push(hh===ll?50:((c[i]-ll)/(hh-ll))*100);}let k=50,d=50;for(const r of rv){k=(2/3)*k+(1/3)*r;d=(2/3)*d+(1/3)*k;}return{k,d,j:3*k-2*d};}
function CCI(h:number[],l:number[],c:number[],p=20):number{if(c.length<p)return 0;const tp=c.map((v,i)=>(h[i]+l[i]+v)/3);const s=tp.slice(-p).reduce((a,b)=>a+b,0)/p;const md=tp.slice(-p).reduce((a,v)=>a+Math.abs(v-s),0)/p;return md===0?0:(tp[tp.length-1]-s)/(0.015*md);}
function ADX(h:number[],l:number[],c:number[],p=14):number{if(c.length<p+1)return 25;const tr:number[]=[],pDM:number[]=[],mDM:number[]=[];for(let i=1;i<c.length;i++){tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));const up=h[i]-h[i-1],dn=l[i-1]-l[i];pDM.push(up>dn&&up>0?up:0);mDM.push(dn>up&&dn>0?dn:0);}if(tr.length<p)return 25;let atr=tr.slice(0,p).reduce((a,b)=>a+b,0)/p,sp=pDM.slice(0,p).reduce((a,b)=>a+b,0)/p,sm=mDM.slice(0,p).reduce((a,b)=>a+b,0)/p;for(let i=p;i<tr.length;i++){atr=(atr*(p-1)+tr[i])/p;sp=(sp*(p-1)+pDM[i])/p;sm=(sm*(p-1)+mDM[i])/p;}if(atr===0)return 25;const pDI=(sp/atr)*100,mDI=(sm/atr)*100;return pDI+mDI===0?0:Math.abs(pDI-mDI)/(pDI+mDI)*100;}
function BB(c:number[],p=20,m=2):{upper:number;middle:number;lower:number;percentB:number}{if(c.length<p)return{upper:0,middle:0,lower:0,percentB:0.5};const s=c.slice(-p);const mid=s.reduce((a,b)=>a+b,0)/p;const std=Math.sqrt(s.reduce((a,v)=>a+(v-mid)**2,0)/p);const u=mid+m*std,l=mid-m*std;return{upper:u,middle:mid,lower:l,percentB:u===l?0.5:(c[c.length-1]-l)/(u-l)};}

/* ─── S/R ─── */
function calcSR(candles:ParsedCandle[]):{supports:SRLevel[];resistances:SRLevel[]}{
  if(candles.length<20)return{supports:[],resistances:[]};
  const sh:{price:number;idx:number}[]=[],sl:{price:number;idx:number}[]=[];
  for(let i=2;i<candles.length-2;i++){const hi=candles[i].high;if(hi>candles[i-1].high&&hi>candles[i-2].high&&hi>candles[i+1].high&&hi>candles[i+2].high)sh.push({price:hi,idx:i});const lo=candles[i].low;if(lo<candles[i-1].low&&lo<candles[i-2].low&&lo<candles[i+1].low&&lo<candles[i+2].low)sl.push({price:lo,idx:i});}
  const cp=candles[candles.length-1].close,r=cp*0.005;
  const cl=(lv:{price:number;idx:number}[],res:boolean):SRLevel[]=>{if(!lv.length)return[];const s=[...lv].sort((a,b)=>a.price-b.price);const cl:{price:number;count:number}[]=[];for(const l of s){const e=cl.find(c=>Math.abs(c.price-l.price)<r);if(e){e.price=(e.price*e.count+l.price)/(e.count+1);e.count++;}else cl.push({price:l.price,count:1});}return cl.filter(c=>res?c.price>cp:c.price<cp).sort((a,b)=>res?a.price-b.price:b.price-a.price).slice(0,3).map(c=>({price:c.price,strength:Math.min(99,50+c.count*15),type:res?'resistance' as const:'support' as const}));};
  return{resistances:cl(sh,true),supports:cl(sl,false)};
}

/* ─── SIGNAL ─── */
function computeSignal(d:AppData):Signal{
  let buy=0,sell=0,neutral=0;const p=d.price,ind=d.indicators;
  if(p>ind.sma10)buy++;else sell++;if(p>ind.sma20)buy++;else sell++;if(p>ind.sma50)buy++;else sell++;
  if(ind.sma10>ind.sma20)buy++;else sell++;if(ind.sma20>ind.sma50)buy++;else sell++;
  if(ind.rsi14<30)buy+=2;else if(ind.rsi14>70)sell+=2;else if(ind.rsi14>50)buy++;else sell++;neutral++;
  if(ind.macdHist>0)buy++;else sell++;
  if(ind.stochK<20)buy++;else if(ind.stochK>80)sell++;else neutral++;
  if(ind.kdjJ<20)buy++;else if(ind.kdjJ>80)sell++;else neutral++;
  if(ind.cci<-100)buy++;else if(ind.cci>100)sell++;else neutral++;
  if(ind.bbPercentB<0)buy++;else if(ind.bbPercentB>1)sell++;else neutral++;
  if(d.funding8h<0)buy++;else if(d.funding8h>0.01)neutral++;
  const total=buy+sell+neutral||1;const score=Math.round((buy/total)*100);
  let action:SigAct='neutral',display='NEUTRAL',summary='Mixed signals';
  if(score>=70){action='strong_buy';display='STRONG BUY';summary='Strong bullish';}
  else if(score>=58){action='buy';display='BUY';summary='Bullish bias';}
  else if(score<=30){action='strong_sell';display='STRONG SELL';summary='Strong bearish';}
  else if(score<=42){action='sell';display='SELL';summary='Bearish bias';}
  if(isStale(d.lastUpdated)){action='neutral';display='STALE';summary='Data stale';}
  return{action,display,score,summary,buy,sell,neutral};
}

/* ─── FETCH ─── */
async function hlPost(body:any){const r=await fetch(HL_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`HL ${r.status}`);return r.json();}

async function fetchAll(tf:string):Promise<AppData>{
  const cfg=TF[tf]||TF['4h'],now=Date.now(),start=now-cfg.days*86400*1000;
  const [raw,meta,cg]=await Promise.all([
    hlPost({type:'candleSnapshot',req:{coin:'HYPE',interval:cfg.interval,startTime:start,endTime:now}}),
    hlPost({type:'metaAndAssetCtxs'}),
    fetch(CG_URL).then(r=>r.json()).catch(()=>null),
  ]);
  const candles:ParsedCandle[]=[];
  for(const c of raw){const o=parseFloat(c.o),h=parseFloat(c.h),l=parseFloat(c.l),cl=parseFloat(c.c),v=parseFloat(c.v);if(isNaN(o)||isNaN(h)||isNaN(l)||isNaN(cl))continue;candles.push({time:c.t,open:o,high:h,low:l,close:cl,volume:v});}
  const closes=candles.map(c=>c.close),highs=candles.map(c=>c.high),lows=candles.map(c=>c.low);
  let ctx=null;if(Array.isArray(meta)&&meta.length===2){const m=meta[0],cx=meta[1];if(m?.universe&&Array.isArray(cx)){const i=m.universe.findIndex((a:any)=>a.name==='HYPE');if(i>=0)ctx=cx[i];}}
  const mp=parseFloat(ctx?.markPx)||closes[closes.length-1]||0,pd=parseFloat(ctx?.prevDayPx)||0;
  const c24=pd>0?((mp/pd)-1)*100:0;
  const cpd=tf==='1h'?24:tf==='4h'?6:1;
  const i7=closes.length-(7*cpd),p7=i7>=0?closes[i7]:closes[0],c7=p7>0?((mp/p7)-1)*100:0;
  const i30=closes.length-(30*cpd),p30=i30>=0?closes[i30]:closes[0],c30=p30>0?((mp/p30)-1)*100:0;
  const s10=SMA(closes,10),s20=SMA(closes,20),s50=SMA(closes,50);
  const macdR=MACD(closes),st=Stoch(highs,lows,closes),kj=KDJ(highs,lows,closes),bb=BB(closes);
  const ot=parseFloat(ctx?.openInterest)||0,fr=parseFloat(ctx?.funding)||0,v24=parseFloat(ctx?.dayNtlVlm)||0;
  const mc=cg?.hyperliquid?.usd_market_cap||0;
  const sr=calcSR(candles);
  const rct=candles.slice(-cpd);
  const h24=rct.length?Math.max(...rct.map(c=>c.high)):mp,l24=rct.length?Math.min(...rct.map(c=>c.low)):mp;
  const liq:LiqZone[]=ot?[{priceLow:mp*0.97,priceHigh:mp*0.975,valueUsd:ot*mp*0.075,side:'long' as const},{priceLow:mp*1.025,priceHigh:mp*1.03,valueUsd:ot*mp*0.075,side:'short' as const}]:[];
  return{
    price:mp,change24h:c24,change7d:c7,change30d:c30,high24h:h24,low24h:l24,
    marketCap:mc,volume24h:v24,oiUsd:ot*mp,oiTokens:ot,funding8h:fr*100,fundingAnn:fr*3*365*100,
    indicators:{
      sma10:s10.length?s10[s10.length-1]:0,sma20:s20.length?s20[s20.length-1]:0,sma50:s50.length?s50[s50.length-1]:0,
      rsi14:RSI(closes),macd:macdR.macd,macdSignal:macdR.signal,macdHist:macdR.hist,
      stochK:st.k,stochD:st.d,kdjK:kj.k,kdjD:kj.d,kdjJ:kj.j,cci:CCI(highs,lows,closes),adx:ADX(highs,lows,closes),
      bbUpper:bb.upper,bbMiddle:bb.middle,bbLower:bb.lower,bbPercentB:bb.percentB,
    },
    srLevels:sr,liqZones:liq,lastUpdated:Date.now(),timeframe:tf,
  };
}

/* ─── TRADINGVIEW EMBED (iframe) ─── */
function TVChart({timeframe}:{timeframe:string}){
  const res=TF[timeframe]?.tvRes||'240';
  const symbol='HYPEUSDT';
  const exchange='BINANCE';
  const height=520;

  const params = new URLSearchParams({
    symbol: `${exchange}:${symbol}`,
    interval: res,
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    toolbar_bg: '#0a0a0f',
    enable_publishing: 'false',
    hide_side_toolbar: 'false',
    allow_symbol_change: 'false',
    studies: 'RSI@tv-basicstudies,MACD@tv-basicstudies',
    hide_top_toolbar: 'false',
    save_image: 'false',
    backgroundColor: 'rgba(10,10,15,1)',
    gridColor: 'rgba(255,255,255,0.03)',
    width: '100%',
    height: String(height),
  });

  const src = `https://www.tradingview.com/widgetembed/?frameElementId=tv_chart&${params.toString()}`;

  return (
    <div style={{width:'100%',height}} className="rounded-b-2xl overflow-hidden bg-[#0a0a0f]">
      <iframe
        id="tv_chart"
        src={src}
        width="100%"
        height={height}
        frameBorder="0"
        allowTransparency
        scrolling="no"
        style={{display:'block',border:'none'}}
        title="TradingView Chart"
      />
    </div>
  );
}

/* ─── SIGNAL COLORS ─── */
const SC:Record<SigAct,{bg:string;border:string;text:string}> = {
  strong_buy:{bg:'bg-emerald-500/10',border:'border-emerald-500/30',text:'text-emerald-400'},
  buy:{bg:'bg-emerald-500/5',border:'border-emerald-500/20',text:'text-emerald-400'},
  neutral:{bg:'bg-zinc-500/5',border:'border-zinc-500/20',text:'text-zinc-400'},
  sell:{bg:'bg-red-500/5',border:'border-red-500/20',text:'text-red-400'},
  strong_sell:{bg:'bg-red-500/10',border:'border-red-500/30',text:'text-red-400'},
};
const SI:Record<SigAct,string> = {strong_buy:'↑↑',buy:'↑',neutral:'—',sell:'↓',strong_sell:'↓↓'};

/* ─── MAIN ─── */
export default function Home(){
  const [data,setData]=useState<AppData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [tf,setTf]=useState('4h');
  const [fc,setFc]=useState(0);
  const [tfl,setTfl]=useState(false);

  const fetchData=useCallback(async(t?:string,silent=false)=>{
    try{if(!silent)setTfl(true);const d=await fetchAll(t||tf);setData(d);setFc(c=>c+1);setError('');}
    catch(e:any){if(e.name!=='AbortError')setError(e.message||'Error');}
    finally{setLoading(false);setTfl(false);}
  },[tf]);

  useEffect(()=>{fetchData();const i=setInterval(()=>fetchData(undefined,true),60000);return()=>clearInterval(i);},[fetchData]);
  const ctf=(t:string)=>{setTf(t);fetchData(t);};

  if(loading) return <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4"><div className="w-10 h-10 rounded-full border-2 border-zinc-800 border-t-cyan-500 animate-spin"/><p className="text-zinc-500 text-sm">Loading market data...</p></div>;
  if(error&&!data) return <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4 p-6"><div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl">⚠</div><p className="text-red-400 font-semibold">Connection Error</p><p className="text-zinc-600 text-sm">{error}</p><button onClick={()=>fetchData()} className="mt-2 px-5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-700 text-sm font-medium">Retry</button></div>;
  if(!data) return null;

  const sig=computeSignal(data),sc=SC[sig.action],ind=data.indicators;
  const stale=isStale(data.lastUpdated);
  const rz=ind.rsi14>70?'Overbought':ind.rsi14<30?'Oversold':ind.rsi14>50?'Bullish':'Bearish';
  const rc=ind.rsi14>70?'text-red-400':ind.rsi14<30?'text-emerald-400':ind.rsi14>50?'text-emerald-400/70':'text-red-400/70';

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 antialiased">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-cyan-500/20">H</div>
            <div><span className="text-sm font-bold tracking-tight">HYPE</span><span className="text-sm text-zinc-500 font-normal ml-1">Monitor</span></div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${stale?'bg-red-500/10 text-red-400 border border-red-500/20':'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {stale?`⚠ Stale ${timeAgo(data.lastUpdated)}`:'● Live'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold font-mono tracking-tight">${data.price.toFixed(2)}</div>
              <div className={`text-[11px] font-semibold ${data.change24h>=0?'text-emerald-400':'text-red-400'}`}>{fmtPct(data.change24h)} <span className="text-zinc-600">24h</span></div>
            </div>
            <button onClick={()=>fetchData()} className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.08] transition">
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* SIGNAL */}
        <div className={`rounded-2xl border ${sc.border} ${sc.bg} p-5 ${stale?'opacity-50':''}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${sc.bg} border ${sc.border} flex items-center justify-center text-2xl font-black ${sc.text}`}>{SI[sig.action]}</div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-semibold">Signal · {TF[data.timeframe]?.label} · Hyperliquid</div>
                <div className={`text-2xl font-black tracking-tight ${sc.text}`}>{sig.display}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{sig.summary}</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-32">
                <div className="flex justify-between text-[9px] text-zinc-600 mb-1"><span>Sell</span><span className={`font-mono font-bold ${sc.text}`}>{sig.score}%</span><span>Buy</span></div>
                <div className="w-full bg-zinc-800/80 rounded-full h-1.5"><div className={`h-full rounded-full transition-all duration-700 ${sig.score>60?'bg-emerald-500':sig.score>40?'bg-amber-500':'bg-red-500'}`} style={{width:`${sig.score}%`}}/></div>
              </div>
              <div className="flex gap-4 text-center">
                <div><div className="text-lg font-black text-emerald-400">{sig.buy}</div><div className="text-[8px] text-zinc-600 uppercase tracking-wider">Buy</div></div>
                <div><div className="text-lg font-black text-zinc-500">{sig.neutral}</div><div className="text-[8px] text-zinc-600 uppercase tracking-wider">Neut</div></div>
                <div><div className="text-lg font-black text-red-400">{sig.sell}</div><div className="text-[8px] text-zinc-600 uppercase tracking-wider">Sell</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* METRICS ROW 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {([
            ['MCap', data.marketCap>0?fmt(data.marketCap):'—', ''],
            ['Vol 24h', fmt(data.volume24h), ''],
            ['High 24h', `$${data.high24h.toFixed(2)}`, ''],
            ['Low 24h', `$${data.low24h.toFixed(2)}`, ''],
            ['OI', fmt(data.oiUsd), fmt(data.oiTokens)+' HYPE'],
            ['Funding 8h', `${data.funding8h>=0?'+':''}${data.funding8h.toFixed(4)}%`, `Ann. ${data.fundingAnn.toFixed(1)}%`],
            ['RSI 14', ind.rsi14.toFixed(1), rz],
          ] as const).map(([label,value,sub])=>(
            <div key={label} className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-3">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">{label}</div>
              <div className={`text-sm font-bold font-mono mt-1 ${label==='Funding 8h'?(data.funding8h>0?'text-emerald-400':'text-red-400'):label==='RSI 14'?rc:''}`}>{value}</div>
              {sub&&<div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>}
            </div>
          ))}
        </div>

        {/* DERIVATIVES + SMA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-3"><div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Long Liq</div><div className="text-sm font-bold font-mono mt-1 text-emerald-400">{data.liqZones[0]?fmt(data.liqZones[0].valueUsd):'—'}</div><div className="text-[9px] text-zinc-600 mt-0.5">{data.liqZones[0]?`$${data.liqZones[0].priceLow.toFixed(2)}–$${data.liqZones[0].priceHigh.toFixed(2)}`:''}</div></div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-3"><div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Short Liq</div><div className="text-sm font-bold font-mono mt-1 text-cyan-400">{data.liqZones[1]?fmt(data.liqZones[1].valueUsd):'—'}</div><div className="text-[9px] text-zinc-600 mt-0.5">{data.liqZones[1]?`$${data.liqZones[1].priceLow.toFixed(2)}–$${data.liqZones[1].priceHigh.toFixed(2)}`:''}</div></div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-3"><div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">SMA 10</div><div className="text-sm font-bold font-mono mt-1 text-pink-300">${ind.sma10.toFixed(2)}</div><div className={`text-[9px] mt-0.5 ${data.price>ind.sma10?'text-emerald-500/60':'text-red-500/60'}`}>{data.price>ind.sma10?'▲ Above':'▼ Below'}</div></div>
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-3"><div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">SMA 50</div><div className="text-sm font-bold font-mono mt-1 text-blue-400">${ind.sma50.toFixed(2)}</div><div className={`text-[9px] mt-0.5 ${data.price>ind.sma50?'text-emerald-500/60':'text-red-500/60'}`}>{data.price>ind.sma50?'▲ Above':'▼ Below'}</div></div>
        </div>

        {/* TIMEFRAMES */}
        <div className="flex items-center gap-1.5">
          {Object.keys(TF).map(k=>(
            <button key={k} onClick={()=>ctf(k)} className={`relative px-6 py-2 rounded-lg text-xs font-bold transition-all ${tf===k?'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 shadow-lg shadow-cyan-500/5':'bg-white/[0.02] text-zinc-500 border border-white/[0.04] hover:text-zinc-300 hover:bg-white/[0.04]'}`}>
              {TF[k].label}
              {tfl&&tf===k&&<span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-500 rounded-full animate-pulse"/>}
            </button>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* CHART */}
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-300">HYPE/USDT · TradingView</h3>
                <div className="flex gap-3 text-[9px] text-zinc-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500"/> Bull</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500"/> Bear</span>
                </div>
              </div>
              <TVChart timeframe={tf}/>
            </div>
            {/* PERFORMANCE */}
            <div className="grid grid-cols-3 gap-2">
              {([['24h',data.change24h],['7d',data.change7d],['30d',data.change30d]] as const).map(([l,v])=>(
                <div key={l} className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
                  <div className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">{l}</div>
                  <div className={`text-base font-black font-mono mt-1 ${v>=0?'text-emerald-400':'text-red-400'}`}>{fmtPct(v)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-4">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.04]"><h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.12em]">Indicators · {TF[data.timeframe]?.label}</h3></div>
              <div className="p-4 space-y-2.5">
                {([
                  ['SMA 10',`$${ind.sma10.toFixed(2)}`,data.price>ind.sma10?'text-emerald-400':'text-red-400',data.price>ind.sma10?'Above':'Below'],
                  ['SMA 20',`$${ind.sma20.toFixed(2)}`,data.price>ind.sma20?'text-emerald-400':'text-red-400',data.price>ind.sma20?'Above':'Below'],
                  ['SMA 50',`$${ind.sma50.toFixed(2)}`,data.price>ind.sma50?'text-emerald-400':'text-red-400',data.price>ind.sma50?'Above':'Below'],
                  ['RSI 14',ind.rsi14.toFixed(1),rc,rz],
                  ['MACD',ind.macd.toFixed(4),ind.macdHist>0?'text-emerald-400':'text-red-400',`Sig ${ind.macdSignal.toFixed(4)}`],
                  ['Stoch K',ind.stochK.toFixed(1),ind.stochK>80?'text-red-400':ind.stochK<20?'text-emerald-400':'text-zinc-400',`D ${ind.stochD.toFixed(1)}`],
                  ['KDJ J',ind.kdjJ.toFixed(1),ind.kdjJ>80?'text-red-400':ind.kdjJ<20?'text-emerald-400':'text-zinc-400',`K ${ind.kdjK.toFixed(1)}`],
                  ['CCI',ind.cci.toFixed(1),ind.cci>100?'text-red-400':ind.cci<-100?'text-emerald-400':'text-zinc-400',ind.cci>100?'Overbought':ind.cci<-100?'Oversold':'Neut'],
                  ['ADX',ind.adx.toFixed(1),ind.adx>25?'text-amber-400':'text-zinc-500',ind.adx>25?'Trending':'Ranging'],
                  ['BB %B',ind.bbPercentB.toFixed(3),ind.bbPercentB>1?'text-red-400':ind.bbPercentB<0?'text-emerald-400':'text-zinc-400',''],
                ] as const).map(([l,v,c,s])=>(
                  <div key={l} className="flex justify-between items-center py-1 border-b border-white/[0.02] last:border-0">
                    <span className="text-[10px] text-zinc-500 font-medium">{l}</span>
                    <div className="text-right"><span className={`text-[11px] font-mono font-bold ${c}`}>{v}</span>{s&&<span className="text-[8px] text-zinc-600 ml-2">{s}</span>}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2"><h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.12em]">RSI 14</h3><span className={`text-base font-black font-mono ${rc}`}>{ind.rsi14.toFixed(1)}</span></div>
              <div className="relative h-2 rounded-full overflow-hidden" style={{background:'linear-gradient(to right,#22c55e 0%,#22c55e 30%,#eab308 30%,#eab308 70%,#ef4444 70%,#ef4444 100%)'}}>
                <div className="absolute top-0 h-full w-1 bg-white rounded-full shadow-lg shadow-white/30 transition-all duration-500" style={{left:`${Math.min(100,Math.max(0,ind.rsi14))}%`}}/>
              </div>
              <div className="flex justify-between text-[8px] text-zinc-700 mt-1.5"><span>Oversold</span><span>Neutral</span><span>Overbought</span></div>
            </div>

            {(data.srLevels.resistances.length>0||data.srLevels.supports.length>0)&&(
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.04]"><h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.12em]">Support / Resistance</h3></div>
                <div className="p-4 space-y-2">
                  {data.srLevels.resistances.map((r,i)=>(<div key={`r${i}`} className="flex justify-between items-center"><span className="text-[10px] text-red-400/70 font-medium">R{i+1}</span><span className="text-[11px] font-mono font-bold text-red-400">${r.price.toFixed(2)}</span><span className="text-[9px] text-zinc-600">{r.strength}%</span></div>))}
                  {data.srLevels.supports.map((s,i)=>(<div key={`s${i}`} className="flex justify-between items-center"><span className="text-[10px] text-emerald-400/70 font-medium">S{i+1}</span><span className="text-[11px] font-mono font-bold text-emerald-400">${s.price.toFixed(2)}</span><span className="text-[9px] text-zinc-600">{s.strength}%</span></div>))}
                </div>
              </div>
            )}

            <div className="text-[9px] text-zinc-700 space-y-0.5 pt-2 px-1">
              <div>Hyperliquid · {fc} fetches</div>
              <div>Updated {new Date(data.lastUpdated).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
