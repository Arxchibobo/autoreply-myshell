
import React, { useState, useMemo } from 'react';
import { DatabaseTicket, AIClassificationResult, Template } from '../types';
import { dbService } from '../services/databaseService';
import { supportAgent } from '../services/geminiService';
import Badge from './Badge';

interface DatabaseWorkspaceProps {
  tickets: DatabaseTicket[];
  onTicketsUpdate: (tickets: DatabaseTicket[]) => void;
  templates: Template[];
  activeModel?: string;
}

const DatabaseWorkspace: React.FC<DatabaseWorkspaceProps> = ({ tickets, onTicketsUpdate, templates, activeModel }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTicket, setActiveTicket] = useState<DatabaseTicket | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [backendOpinion, setBackendOpinion] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [professionalReply, setProfessionalReply] = useState('');

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const fetched = await dbService.fetchTicketsByDate(selectedDate);
      // Fixed: onTicketsUpdate expects DatabaseTicket[], not a functional update.
      // Use the 'tickets' prop directly to compute the next state.
      const existingIds = new Set(tickets.map(p => p.id));
      const newOnes = fetched.filter(f => !existingIds.has(f.id));
      onTicketsUpdate([...newOnes, ...tickets]);
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  };

  const handleTranslateFeedback = async () => {
    if (!activeTicket || !backendOpinion) return;
    setIsTranslating(true);
    try {
      const reply = await supportAgent.translateFeedbackToProfessional(
        activeTicket.subject, 
        backendOpinion,
        activeModel
      );
      setProfessionalReply(reply);
    } finally {
      setIsTranslating(false);
    }
  };

  const triageTicket = async (ticket: DatabaseTicket) => {
    setIsAnalyzing(true);
    try {
      const result = await supportAgent.analyzeEmail({
        subject: ticket.subject,
        body: `[DB TICKET] UID: ${ticket.user_id} Method: ${ticket.payment_method}`,
        attachments: ticket.proof_of_payment.map((url, i) => ({ id: `url_${i}`, filename: `p_${i}.png`, mimeType: 'image/png', size: 0 })),
        activeTemplates: templates,
        model: activeModel
      });
      onTicketsUpdate(tickets.map(t => t.id === ticket.id ? { ...t, aiResult: result } : t));
      setActiveTicket({ ...ticket, aiResult: result });
    } finally { setIsAnalyzing(false); }
  };

  return (
    <div className="flex-1 flex bg-[#F8FAFC] overflow-hidden animate-in slide-in-from-right duration-500">
      <div className="flex-1 flex flex-col border-r border-slate-200 bg-white">
        <header className="p-8 border-b border-slate-100 flex justify-between items-center bg-white z-20">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Ticket Center</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Backend Investigation Queue</p>
          </div>
          <div className="flex items-center gap-4">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-slate-50 rounded-xl px-4 py-3 text-xs font-bold border-none" />
            <button onClick={handleSync} disabled={isSyncing} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">
              SYNC RDS
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50/80 backdrop-blur-md">
              <tr>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">ID / User</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b">Subject</th>
                <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] border-b text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.id} onClick={() => { setActiveTicket(ticket); setProfessionalReply(''); setBackendOpinion(''); }} className={`group cursor-pointer border-b border-slate-50 transition-all ${activeTicket?.id === ticket.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-8 py-6">
                    <div className="text-[10px] font-black text-slate-900">UID: {ticket.user_id}</div>
                    <div className="text-[9px] font-bold text-slate-400">{ticket.email}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-xs font-black text-slate-800 truncate max-w-[300px]">{ticket.subject}</div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <Badge variant={ticket.status === 'resolved' ? 'green' : 'yellow'}>{ticket.status.toUpperCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-[500px] bg-slate-50 border-l border-slate-200 flex flex-col p-8 gap-8 overflow-y-auto custom-scrollbar">
        {activeTicket ? (
          <>
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">1. Investigation Result</h4>
               <textarea 
                  placeholder="Engineering Feedback: e.g., 'User account restricted due to multiple IPs', 'Payment refunded on Stripe side'"
                  value={backendOpinion}
                  onChange={e => setBackendOpinion(e.target.value)}
                  className="w-full h-32 p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-indigo-100 resize-none"
               />
               <div className="flex gap-2">
                 <button 
                    onClick={handleTranslateFeedback}
                    disabled={!backendOpinion || isTranslating}
                    className="flex-1 h-14 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                 >
                   {isTranslating ? 'AI TRANSLATING...' : 'TRANSLATE TO PROFESSIONAL EMAIL'}
                 </button>
                 <button 
                    onClick={() => triageTicket(activeTicket)}
                    disabled={isAnalyzing}
                    className="flex-1 h-14 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                 >
                   {isAnalyzing ? 'TRIAGING...' : 'AI TRIAGE'}
                 </button>
               </div>
            </section>

            {professionalReply && (
              <section className="animate-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">2. Professional Output</h4>
                <div className="bg-white rounded-[32px] border-2 border-indigo-500 p-8 shadow-2xl flex flex-col gap-6">
                   <textarea 
                    className="w-full min-h-[300px] text-xs font-bold text-slate-700 leading-relaxed outline-none resize-none"
                    value={professionalReply}
                    onChange={e => setProfessionalReply(e.target.value)}
                   />
                   <button className="w-full h-14 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">
                     SEND FINAL REPLY
                   </button>
                </div>
              </section>
            )}
            
            <section className="bg-white rounded-3xl p-6 border border-slate-200 opacity-60">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Initial Meta</h4>
               <div className="grid grid-cols-2 gap-4 text-[10px]">
                 <div><span className="text-slate-400">UID:</span> <span className="font-black">{activeTicket.user_id}</span></div>
                 <div><span className="text-slate-400">Method:</span> <span className="font-black">{activeTicket.payment_method}</span></div>
               </div>
            </section>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-20 opacity-20">
             <p className="text-[10px] font-black uppercase tracking-[0.3em]">Select Ticket for investigation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseWorkspace;
