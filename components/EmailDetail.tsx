
import React, { useState, useEffect, useMemo } from 'react';
import { Email, Attachment, Template, SupportCategory, LinkedUserProfile } from '../types';
import Badge from './Badge';
import { supportAgent } from '../services/geminiService';
import { gmailApi } from '../services/gmailService';

interface EmailDetailProps { 
  email: Email; 
  templates: Template[];
  history: Email[];
  activeModel?: string;
  onSelectHistory: (email: Email) => void;
  onUpdate: (updatedEmail: Email) => void; 
}

type DBTab = 'STRIPE' | 'SUBS' | 'ENERGY' | 'TASKS';

const EmailDetail: React.FC<EmailDetailProps> = ({ email, templates, history, activeModel, onSelectHistory, onUpdate }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [isGeneratingFromData, setIsGeneratingFromData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  
  const [manualUserId, setManualUserId] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('');
  const [humanSupplement, setHumanSupplement] = useState('');
  const [draftReply, setDraftReply] = useState('');
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [attachmentPreviews, setAttachmentPreviews] = useState<Record<string, string>>({});
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [activeDbTab, setActiveDbTab] = useState<DBTab>('STRIPE');
  const [queryLogs, setQueryLogs] = useState<string[]>([]);

  const incomingHistory = useMemo(() => {
    return history.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [history]);

  const aiRecommendedId = useMemo(() => {
    if (!email.aiResult) return 'T7';
    const cat = email.aiResult.category;
    const mapping: Record<string, string> = {
      [SupportCategory.SUBSCRIPTION_MISSING_INFO]: 'T1',
      [SupportCategory.NSFW_ISSUE]: 'T2',
      [SupportCategory.ACCOUNT_USAGE_ERROR]: 'T3',
      [SupportCategory.ACCOUNT_DELETION]: 'T4',
      [SupportCategory.BOT_POWER_ISSUE]: 'T5',
      [SupportCategory.POST_DELETION_BILLING]: 'T6',
      [SupportCategory.SUBSCRIPTION_VERIFIED]: 'T7',
      [SupportCategory.OTHER]: 'T7'
    };
    return mapping[cat] || 'T7';
  }, [email.aiResult]);

  useEffect(() => { 
    setHumanSupplement(''); 
    setSendSuccess(false);
    setErrorMsg(null);
    setSelectedTemplateId(aiRecommendedId);
    
    if (email.status === 'resolved' && email.sentReply) {
      setDraftReply(email.sentReply);
    } else if (aiRecommendedId === 'T7') {
      setDraftReply(email.aiResult?.reply_email || templates.find(t => t.id === 'T7')?.content || '');
    } else {
      setDraftReply(templates.find(temp => temp.id === aiRecommendedId)?.content || '');
    }

    setManualUserId(email.aiResult?.extracted_metadata?.user_id || '');
    setManualPaymentMethod(email.aiResult?.extracted_metadata?.payment_method || '');
    email.attachments.forEach(att => loadPreview(att));
  }, [email.id, aiRecommendedId, templates]);

  const loadPreview = async (att: Attachment) => {
    if (attachmentPreviews[att.id]) return;
    try {
      const base64 = await gmailApi.fetchAttachmentData(email.id, att.id);
      setAttachmentPreviews(prev => ({ ...prev, [att.id]: base64 }));
    } catch (e) { console.error(e); }
  };

  const getActiveSql = (tab: DBTab, uid: string) => {
    const targetUid = uid || '47188073';
    switch (tab) {
      case 'STRIPE': return `SELECT * FROM user_subscription_stripe_orders WHERE user_id = ${targetUid} ORDER BY id DESC LIMIT 5;`;
      case 'SUBS': return `SELECT * FROM user_subscriptions WHERE user_id = ${targetUid} ORDER BY id DESC LIMIT 5;`;
      case 'ENERGY': return `SELECT * FROM user_energy_logs WHERE user_id = ${targetUid} ORDER BY id DESC LIMIT 3;`;
      case 'TASKS': return `SELECT * FROM art_task WHERE user_id = ${targetUid} ORDER BY id DESC LIMIT 5;`;
      default: return '';
    }
  };

  const handleQueryUser = async () => {
    if (!manualUserId || manualUserId.trim() === '') {
      return;
    }
    setIsQuerying(true);
    setQueryLogs([
      `[INFO] Establishing TCP connection to us-west-2.rds.amazonaws.com:3306...`,
      `[INFO] Authenticating user 'data_analyst_01' via SSL...`,
      `[INFO] Access granted to 'my_shell_prod'. Parsing AST...`
    ]);
    
    try {
      const targetUid = manualUserId;
      
      const [stripeRes, subsRes, energyRes, tasksRes] = await Promise.all([
        supportAgent.queryRDS(getActiveSql('STRIPE', targetUid)),
        supportAgent.queryRDS(getActiveSql('SUBS', targetUid)),
        supportAgent.queryRDS(getActiveSql('ENERGY', targetUid)),
        supportAgent.queryRDS(getActiveSql('TASKS', targetUid))
      ]);

      setQueryLogs(prev => [...prev, `[SUCCESS] ${stripeRes.length + subsRes.length + energyRes.length + tasksRes.length} records retrieved.`]);

      const profile: LinkedUserProfile = {
        uid: targetUid,
        status: subsRes.some((s: any) => s.status === 'active') ? 'Pro' : 'Basic',
        energy_balance: energyRes[0]?.balance || 0,
        is_verified: true,
        stripe_orders_count: stripeRes.length,
        subscriptions_count: subsRes.length,
        art_tasks_count: tasksRes.length,
        energy_logs_count: energyRes.length,
        stripe_orders_json: stripeRes,
        subscriptions_json: subsRes,
        energy_logs_json: energyRes,
        art_tasks_json: tasksRes
      };
      
      onUpdate({ ...email, linkedProfile: profile });
    } catch (e) {
      console.error("RDS Sync Error", e);
      setQueryLogs(prev => [...prev, `[ERROR] Connection failed: Access denied for user 'data_analyst_01'.`]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleGenerateReplyFromData = async () => {
    if (!email.linkedProfile) return;
    setIsGeneratingFromData(true);
    try {
      const response = await supportAgent.generateReplyFromDbData({
        emailContent: email.body,
        dbProfile: email.linkedProfile,
        model: activeModel
      });
      setDraftReply(response);
      setSelectedTemplateId('T7'); 
    } catch (e) { console.error(e); } finally { setIsGeneratingFromData(false); }
  };

  const handleTriage = async () => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const threadHistory = incomingHistory.filter(h => h.id !== email.id);
      const latestSummary = threadHistory.find(h => h.aiResult?.chinese_summary)?.aiResult?.chinese_summary;

      const result = await supportAgent.analyzeEmail({
        subject: email.subject,
        body: email.body,
        attachments: email.attachments,
        previousSummary: latestSummary,
        agentNotes: `[OVERRIDE] UID: ${manualUserId}, Method: ${manualPaymentMethod}\n[HUMAN]: ${humanSupplement}`,
        activeTemplates: templates,
        model: activeModel
      });
      onUpdate({
        ...email,
        aiResult: result,
        status: result.extracted_metadata.is_info_complete ? 'ready_to_resolve' : 'info_missing'
      });
      if (selectedTemplateId === 'T7') setDraftReply(result.reply_email);
    } catch (err: any) { setErrorMsg(err.message); } finally { setIsAnalyzing(false); }
  };

  const handleSendReply = async () => {
    if (!draftReply) return;
    setIsSending(true);
    try {
      await gmailApi.sendReply(email.sender, email.subject, email.threadId, email.messageId, draftReply);
      setSendSuccess(true);
      onUpdate({ ...email, status: 'resolved', isRead: true, sentReply: draftReply });
    } catch (err: any) { setErrorMsg(err.message); } finally { setIsSending(false); }
  };

  const selectTemplate = (t: Template) => {
    setSelectedTemplateId(t.id);
    if (t.id === 'T7') {
      setDraftReply(email.aiResult?.reply_email || t.content);
    } else {
      setDraftReply(t.content);
    }
  };

  return (
    <div className="flex h-full w-full bg-white overflow-hidden relative text-slate-900">
      {enlargedImage && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-8 backdrop-blur-sm cursor-zoom-out" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="Full view" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}

      {/* History Sidebar */}
      <aside className="w-[180px] bg-slate-50/50 border-r border-slate-100 flex flex-col p-6 overflow-y-auto shrink-0">
        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-6">History</h3>
        <div className="relative space-y-8 pl-4">
          <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-slate-200/50" />
          {incomingHistory.map((h) => (
            <div key={h.id} onClick={() => onSelectHistory(h)} className={`relative group cursor-pointer transition-all ${h.id === email.id ? 'opacity-100' : 'opacity-40 hover:opacity-80'}`}>
              <div className={`absolute -left-[13px] top-1 w-3 h-3 rounded-full border-2 border-white transition-all ${h.id === email.id ? 'bg-blue-600' : h.status === 'resolved' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-slate-400">
                  {new Date(h.timestamp).toLocaleDateString([], {month: 'short', day: 'numeric'})}
                </span>
                <p className="text-[10px] font-bold line-clamp-2">{h.subject}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col border-r border-slate-100 overflow-y-auto custom-scrollbar">
        <div className="p-8 border-b border-slate-50 sticky top-0 bg-white z-20 flex justify-between items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
               <Badge variant={email.status === 'resolved' ? 'green' : 'gray'}>{email.status.toUpperCase()}</Badge>
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-1">{email.subject}</h2>
            <div className="text-xs font-bold text-slate-400">From: {email.senderName} ({email.sender})</div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleTriage} disabled={isAnalyzing} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
              {isAnalyzing ? 'Analyzing...' : 'AI Triage'}
            </button>
            <button onClick={handleSendReply} disabled={isSending || !draftReply || email.status === 'resolved'} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50">
              {isSending ? 'Sending...' : email.status === 'resolved' ? 'Reply Sent' : 'Send Reply'}
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="prose prose-slate max-w-none text-sm text-slate-600 whitespace-pre-wrap mb-8">
            {email.body}
          </div>

          {email.attachments.length > 0 && (
            <div className="mb-8">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Attachments ({email.attachments.length})</h3>
              <div className="flex flex-wrap gap-4">
                {email.attachments.map(att => (
                  <div key={att.id} className="relative group cursor-pointer" onClick={() => attachmentPreviews[att.id] && setEnlargedImage(`data:${att.mimeType};base64,${attachmentPreviews[att.id]}`)}>
                    {attachmentPreviews[att.id] && att.mimeType.startsWith('image/') ? (
                      <img src={`data:${att.mimeType};base64,${attachmentPreviews[att.id]}`} className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-sm" alt={att.filename} />
                    ) : (
                      <div className="w-24 h-24 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2 text-center">
                        <svg className="w-6 h-6 text-slate-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        <span className="text-[8px] font-bold text-slate-400 truncate w-full">{att.filename}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Response Workspace</h3>
            
            {email.aiResult?.chinese_summary && (
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 shadow-sm">
                <h4 className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3">AI Intelligence Summary</h4>
                <div className="text-xs font-bold text-blue-900 whitespace-pre-wrap leading-relaxed">
                  {email.aiResult.chinese_summary}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">UID (QUERY PARAMETER)</label>
                <div className="flex gap-2">
                  <input 
                    value={manualUserId} 
                    onChange={e => setManualUserId(e.target.value)} 
                    className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-xs font-bold outline-none border border-transparent focus:border-blue-200 transition-all" 
                    placeholder="12345678" 
                  />
                  <button 
                    onClick={handleQueryUser} 
                    disabled={isQuerying || !manualUserId || manualUserId.trim() === ''} 
                    className="px-6 py-2 bg-[#0F172A] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {isQuerying ? <div className="w-2 h-2 bg-white rounded-full animate-ping" /> : null}
                    {isQuerying ? 'BUSY...' : 'RUN QUERY'}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">PAYMENT REFERENCE</label>
                <input 
                  value={manualPaymentMethod} 
                  onChange={e => setManualPaymentMethod(e.target.value)} 
                  className="w-full bg-slate-50 rounded-lg px-3 py-2 text-xs font-bold outline-none border border-transparent focus:border-blue-200 transition-all" 
                  placeholder="Stripe" 
                />
              </div>
            </div>

            {email.linkedProfile || isQuerying ? (
              <div className="bg-[#0D1117] text-slate-300 rounded-[32px] p-8 shadow-2xl relative flex flex-col min-h-[450px] border border-slate-800 animate-in fade-in duration-500">
                <div className="flex justify-between items-start mb-8">
                   <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isQuerying ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <h4 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">
                          {isQuerying ? 'SHELL_PROD_DB: CONNECTING...' : 'SHELL_PROD_DB: ACTIVE'}
                        </h4>
                      </div>
                      <p className="text-[8px] font-mono text-slate-500">HOST: readonly-for-data-analysis.cv0kgvmpymow.us-west-2.rds.amazonaws.com</p>
                      <p className="text-[8px] font-mono text-slate-500">USER: data_analyst_01 | PORT: 3306</p>
                   </div>
                   <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl border border-white/5">
                      {[
                        { id: 'STRIPE', label: 'Stripe' },
                        { id: 'SUBS', label: 'Subs' },
                        { id: 'ENERGY', label: 'Energy' },
                        { id: 'TASKS', label: 'Tasks' }
                      ].map((tab: any) => (
                        <button 
                          key={tab.id} 
                          onClick={() => setActiveDbTab(tab.id)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${activeDbTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                   <div className="flex items-start gap-2 text-[10px] font-mono text-emerald-400/80 mb-2">
                      <span className="text-slate-500 shrink-0">mysql></span>
                      <span className="font-bold whitespace-pre-wrap">{getActiveSql(activeDbTab, manualUserId)}</span>
                   </div>
                   <div className="h-0.5 w-full bg-slate-800 rounded-full" />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/30 rounded-2xl p-4 border border-white/5">
                  {isQuerying ? (
                    <div className="space-y-1 font-mono text-[9px] text-slate-500">
                      {queryLogs.map((log, i) => (
                        <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-200" style={{animationDelay: `${i * 300}ms`}}>{log}</div>
                      ))}
                      <div className="flex items-center gap-2 mt-4 text-blue-400">
                        <span className="animate-spin text-lg">⟳</span>
                        <span>EXECUTING REMOTE SQL...</span>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-[10px] font-mono text-slate-300/90 leading-relaxed animate-in fade-in zoom-in duration-300">
                      {activeDbTab === 'STRIPE' && JSON.stringify(email.linkedProfile?.stripe_orders_json || [], null, 2)}
                      {activeDbTab === 'SUBS' && JSON.stringify(email.linkedProfile?.subscriptions_json || [], null, 2)}
                      {activeDbTab === 'ENERGY' && JSON.stringify(email.linkedProfile?.energy_logs_json || [], null, 2)}
                      {activeDbTab === 'TASKS' && JSON.stringify(email.linkedProfile?.art_tasks_json || [], null, 2)}
                    </pre>
                  )}
                </div>

                {!isQuerying && (
                  <div className="mt-8 flex justify-between items-center">
                      <div className="flex gap-6 text-[10px]">
                          <div>
                             <div className="font-black text-slate-500 uppercase tracking-widest mb-1">Rows Found</div>
                             <div className="font-black text-white">
                                {activeDbTab === 'STRIPE' ? email.linkedProfile?.stripe_orders_json?.length : 
                                 activeDbTab === 'SUBS' ? email.linkedProfile?.subscriptions_json?.length :
                                 activeDbTab === 'ENERGY' ? email.linkedProfile?.energy_logs_json?.length : 
                                 email.linkedProfile?.art_tasks_json?.length}
                             </div>
                          </div>
                          <div>
                             <div className="font-black text-slate-500 uppercase tracking-widest mb-1">Status</div>
                             <div className="font-black text-emerald-500 uppercase tracking-wider">SUCCESS 200</div>
                          </div>
                      </div>
                      <button onClick={handleGenerateReplyFromData} disabled={isGeneratingFromData} className="px-8 py-4 bg-indigo-600 text-white rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-2xl shadow-indigo-500/40 active:scale-95 transition-all flex items-center gap-3">
                        {isGeneratingFromData ? 'COMPUTING...' : 'SYNC TO DRAFT'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                      </button>
                  </div>
                )}
              </div>
            ) : null}

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Standard Templates</label>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {templates.map(t => {
                  const isRecommended = t.id === aiRecommendedId;
                  const isSelected = selectedTemplateId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' 
                          : isRecommended
                            ? 'bg-amber-50 border-amber-200 text-amber-700 hover:border-amber-400 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 shadow-sm'
                      } flex items-center gap-1.5`}
                    >
                      {t.name}
                      {isRecommended && !isSelected && (
                         <div className="w-1 h-1 bg-amber-400 rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              <textarea 
                value={draftReply} 
                onChange={e => setDraftReply(e.target.value)} 
                className="w-full h-72 bg-slate-50 rounded-3xl p-8 text-xs font-bold outline-none border border-transparent focus:border-blue-200 resize-none leading-relaxed shadow-inner transition-all" 
                placeholder="The intelligent draft will appear here..."
              />
            </div>
            
            {errorMsg && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 animate-in shake-x duration-500">
                {errorMsg}
              </div>
            )}
            
            {sendSuccess && (
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 animate-in zoom-in duration-300">
                Reply sent successfully!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;
