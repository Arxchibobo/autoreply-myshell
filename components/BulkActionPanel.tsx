
import React, { useState } from 'react';
import { Email } from '../types';
import { gmailApi } from '../services/gmailService';
import Badge from './Badge';

interface BulkActionPanelProps {
  selectedEmails: Email[];
  onUpdateEmails: (updates: { id: string; changes: Partial<Email> }[]) => void;
  onClearSelection: () => void;
}

const BulkActionPanel: React.FC<BulkActionPanelProps> = ({ selectedEmails, onUpdateEmails, onClearSelection }) => {
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });

  // Filter logic: Ready if AI has generated a reply AND it's not missing info (or user manually fixed it)
  // Actually, strictly speaking, we just check if there is a drafted reply available from AI result.
  const readyToSend = selectedEmails.filter(e => 
    e.status !== 'resolved' && 
    e.aiResult?.reply_email && 
    e.aiResult.reply_email.length > 10
  );

  const needsReview = selectedEmails.filter(e => !readyToSend.includes(e));

  const handleBulkSend = async () => {
    setIsSending(true);
    setProgress(0);
    let successCount = 0;
    let failCount = 0;
    const updates: { id: string; changes: Partial<Email> }[] = [];

    for (let i = 0; i < readyToSend.length; i++) {
      const email = readyToSend[i];
      try {
        await gmailApi.sendReply(
          email.sender,
          email.subject,
          email.threadId,
          email.messageId,
          email.aiResult!.reply_email
        );
        successCount++;
        updates.push({ 
          id: email.id, 
          changes: { status: 'resolved', isRead: true, selected: false } 
        });
      } catch (error) {
        console.error(`Failed to send to ${email.id}`, error);
        failCount++;
      }
      setProgress(Math.round(((i + 1) / readyToSend.length) * 100));
    }

    setResults({ success: successCount, failed: failCount });
    onUpdateEmails(updates);
    setIsSending(false);
    
    // Auto clear successful ones from selection after a short delay is handled by parent update, 
    // but here we might want to just show success state.
  };

  if (results.success > 0 || results.failed > 0) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center p-12">
        <div className="bg-white rounded-[40px] p-12 shadow-2xl max-w-lg w-full text-center border border-slate-100 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4">Batch Complete</h2>
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-4xl font-black text-emerald-600">{results.success}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sent</div>
            </div>
            {results.failed > 0 && (
              <div className="text-center">
                <div className="text-4xl font-black text-rose-600">{results.failed}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failed</div>
              </div>
            )}
          </div>
          <button 
            onClick={onClearSelection} 
            className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all"
          >
            Return to Inbox
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F8FAFC] flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
      <div className="p-8 border-b border-slate-200 bg-white shadow-sm z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Batch Processor</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {selectedEmails.length} Tickets Selected
            </p>
          </div>
          <div className="flex gap-3">
             <button onClick={onClearSelection} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">
               Cancel
             </button>
             <button 
               onClick={handleBulkSend}
               disabled={isSending || readyToSend.length === 0}
               className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
             >
               {isSending ? (
                 <>Processing {progress}%</>
               ) : (
                 <>Dispatch {readyToSend.length} Replies</>
               )}
               {!isSending && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>}
             </button>
          </div>
        </div>
        
        {isSending && (
          <div className="mt-6 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* READY TO SEND SECTION */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Ready to Dispatch ({readyToSend.length})</h3>
            </div>
            
            {readyToSend.length === 0 ? (
               <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                 <p className="text-xs font-bold text-slate-400">No tickets ready for auto-reply.</p>
               </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-50">
                {readyToSend.map(email => (
                  <div key={email.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-500">{email.senderName}</span>
                        <Badge variant="green">{email.aiResult?.category.split('_')[0]}</Badge>
                      </div>
                      <div className="text-xs font-bold text-slate-800 truncate">{email.subject}</div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 tabular-nums">
                       UID: {email.aiResult?.extracted_metadata?.user_id || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* NEEDS REVIEW SECTION */}
          {needsReview.length > 0 && (
            <section className="opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 bg-rose-500 rounded-full" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Requires Attention ({needsReview.length})</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-50">
                {needsReview.map(email => (
                  <div key={email.id} className="p-4 flex justify-between items-center">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-500">{email.senderName}</span>
                        <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {email.status === 'resolved' ? 'RESOLVED' : 'MISSING INFO'}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-800 truncate">{email.subject}</div>
                    </div>
                    <div className="text-[10px] text-rose-500 font-bold">Skipped</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[10px] text-slate-400 text-center">These tickets will not be processed in this batch.</p>
            </section>
          )}

        </div>
      </div>
    </div>
  );
};

export default BulkActionPanel;
