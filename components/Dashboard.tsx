
import React from 'react';
import { SupportStats } from '../types';

interface DashboardProps {
  stats: SupportStats;
  onEnterWorkspace: () => void;
  activeModel: string;
  onModelChange: (model: string) => void;
}

const MODELS = [
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash Lite',
    description: 'Extremely cost-effective for high-volume, simple tasks. Ideal for initial filtering and basic categorization.',
    latency: '< 1.0s',
    strength: 'Efficiency',
    color: 'emerald'
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    description: 'Ultra-low latency. Optimized for rapid ticket classification and standard bulk processing.',
    latency: '< 1.5s',
    strength: 'Speed',
    color: 'blue'
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'High reasoning capabilities. Best for complex multi-turn disputes and technical debugging.',
    latency: '~ 3.8s',
    strength: 'Intelligence',
    color: 'indigo'
  }
];

const Dashboard: React.FC<DashboardProps> = ({ stats, onEnterWorkspace, activeModel, onModelChange }) => {
  return (
    <div className="flex-1 bg-[#F8FAFC] overflow-y-auto p-12 animate-in fade-in duration-700 custom-scrollbar">
      <div className="max-w-7xl mx-auto">
        <header className="mb-16 flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">Intelligence Center</h1>
            <p className="text-slate-500 font-bold text-lg italic uppercase tracking-widest opacity-60">Multi-Channel Support Overview</p>
          </div>
          <button 
            onClick={onEnterWorkspace}
            className="px-10 py-5 bg-indigo-600 text-white font-black rounded-[32px] shadow-2xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-4"
          >
            ENTER WORKSPACE
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </button>
        </header>

        {/* TOP LEVEL STATUS */}
        <div className="grid grid-cols-4 gap-8 mb-12">
          <StatusCard label="Total Unprocessed" value={stats.new} color="slate" />
          <StatusCard label="Gmail Threads" value={stats.gmailCount} color="blue" />
          <StatusCard label="RDS Tickets" value={stats.dbCount} color="indigo" />
          <StatusCard label="Overall Resolved" value={stats.resolved} color="emerald" />
        </div>

        {/* DEEP METRICS ANALYSIS */}
        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="col-span-2 bg-white rounded-[48px] p-10 border border-slate-100 shadow-xl">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10">Cross-Platform Integrity Index</h3>
            <div className="space-y-8">
              <MetricRow label="Unified UID Extraction" current={stats.metrics.uidCount} total={stats.total} color="blue" />
              <MetricRow label="Payment Data Detection" current={stats.metrics.paymentMethodCount} total={stats.total} color="indigo" />
              <MetricRow label="Proof of Evidence Verification" current={stats.metrics.proofCount} total={stats.total} color="purple" />
            </div>
          </div>
          
          <div className="bg-indigo-950 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-1000" />
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-10">Verification Ready</h3>
            <div className="text-7xl font-black mb-4">{stats.metrics.perfectCount}</div>
            <p className="text-xs font-bold text-white/60 leading-relaxed uppercase tracking-widest">Candidates across all sources ready for automated resolution.</p>
            <div className="mt-10 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${(stats.metrics.perfectCount / (stats.total || 1)) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* RESTORED MODEL SELECTOR */}
        <section className="mt-16 animate-in slide-in-from-bottom-8 duration-1000">
           <div className="flex items-center gap-4 mb-10">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Neural Engine Allocation</h2>
              <div className="flex-1 h-[1px] bg-slate-100"></div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {MODELS.map(model => (
                <button 
                  key={model.id}
                  onClick={() => onModelChange(model.id)}
                  className={`relative flex flex-col items-start text-left p-8 rounded-[40px] border-2 transition-all duration-500 group ${
                    activeModel === model.id 
                    ? 'bg-white border-indigo-600 shadow-2xl shadow-indigo-500/10 scale-[1.02]' 
                    : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  {activeModel === model.id && (
                    <div className="absolute top-6 right-6 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                    </div>
                  )}

                  <div className={`mb-6 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    model.color === 'blue' ? 'bg-blue-100 text-blue-600' : 
                    model.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {model.strength} Optimized
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2">{model.name}</h3>
                  <p className="text-xs font-bold text-slate-500 leading-relaxed mb-8">
                    {model.description}
                  </p>

                  <div className="mt-auto flex gap-6">
                    <div>
                       <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Avg Latency</div>
                       <div className="text-xs font-black text-slate-700">{model.latency}</div>
                    </div>
                    <div>
                       <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Efficiency</div>
                       <div className="text-xs font-black text-slate-700">{model.color === 'emerald' ? 'Max (Free)' : model.color === 'blue' ? 'High' : 'Balanced'}</div>
                    </div>
                  </div>
                </button>
              ))}
           </div>
        </section>
      </div>
    </div>
  );
};

const StatusCard = ({ label, value, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-500',
    indigo: 'text-indigo-600',
    slate: 'text-slate-400'
  };
  return (
    <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 group-hover:text-slate-400 transition-colors">{label}</div>
      <div className={`text-4xl font-black tabular-nums ${colors[color]}`}>{value}</div>
    </div>
  );
};

const MetricRow = ({ label, current, total, color }: any) => {
  const percent = Math.round((current / (total || 1)) * 100);
  const colorMap: any = {
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    purple: 'bg-purple-500'
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <span className="text-xs font-black text-slate-700 uppercase">{label}</span>
        <span className="text-xs font-bold text-slate-400 tabular-nums">{percent}% ({current}/{total})</span>
      </div>
      <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
        <div className={`h-full ${colorMap[color]} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default Dashboard;
