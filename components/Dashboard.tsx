
import React from 'react';
import { SupportStats } from '../types';

interface DashboardProps {
  stats: SupportStats;
  onEnterWorkspace: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, onEnterWorkspace }) => {
  return (
    <div className="flex-1 bg-[#F8FAFC] overflow-y-auto p-12 animate-in fade-in duration-700">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16 flex justify-between items-end">
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">Command Center</h1>
            <p className="text-slate-500 font-bold text-lg italic uppercase tracking-widest opacity-60">Status Overview & Metrics Analysis</p>
          </div>
          <button 
            onClick={onEnterWorkspace}
            className="px-10 py-5 bg-blue-600 text-white font-black rounded-[32px] shadow-2xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-4"
          >
            GO TO WORKSPACE
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </button>
        </header>

        {/* TOP LEVEL STATUS */}
        <div className="grid grid-cols-4 gap-8 mb-12">
          <StatusCard label="Unprocessed" value={stats.new} color="slate" />
          <StatusCard label="Active Threads" value={stats.inProgress} color="blue" />
          <StatusCard label="Missing Info" value={stats.infoMissing} color="rose" />
          <StatusCard label="Total Resolved" value={stats.resolved} color="emerald" />
        </div>

        {/* DEEP METRICS ANALYSIS */}
        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="col-span-2 bg-white rounded-[48px] p-10 border border-slate-100 shadow-xl">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10">Verification Index Health</h3>
            <div className="space-y-8">
              <MetricRow label="User ID Extraction" current={stats.metrics.uidCount} total={stats.total} color="blue" />
              <MetricRow label="Payment Method Detection" current={stats.metrics.paymentMethodCount} total={stats.total} color="indigo" />
              <MetricRow label="Payment Proof Evidence" current={stats.metrics.proofCount} total={stats.total} color="purple" />
            </div>
          </div>
          
          <div className="bg-slate-900 rounded-[48px] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-150 transition-transform duration-1000" />
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-10">Perfect Candidates</h3>
            <div className="text-7xl font-black mb-4">{stats.metrics.perfectCount}</div>
            <p className="text-xs font-bold text-white/60 leading-relaxed uppercase tracking-widest">Threads with all 3 verified metrics ready for bulk resolution.</p>
            <div className="mt-10 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${(stats.metrics.perfectCount / (stats.total || 1)) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusCard = ({ label, value, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-500',
    rose: 'text-rose-500',
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
