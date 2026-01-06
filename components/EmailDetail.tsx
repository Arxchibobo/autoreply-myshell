
import React, { useState, useEffect } from 'react';
import { Email, ImageAnalysisResult, Attachment } from '../types';
import Badge from './Badge';
import { supportAgent } from '../services/geminiService';
import { gmailApi } from '../services/gmailService';

interface EmailDetailProps { email: Email; onUpdate: (updatedEmail: Email) => void; }

const EmailDetail: React.FC<EmailDetailProps> = ({ email, onUpdate }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [imageInsights, setImageInsights] = useState<ImageAnalysisResult | null>(null);
  const [isImageAnalyzing, setIsImageAnalyzing] = useState(false);
  
  const [manualUserId, setManualUserId] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('');
  const [humanSupplement, setHumanSupplement] = useState('');
  const [draftReply, setDraftReply] = useState(email.aiResult?.reply_email || '');

  useEffect(() => { 
    setDraftReply(email.aiResult?.reply_email || '');
    setHumanSupplement(''); // Reset human supplement on new email select
    
    const aiUid = email.aiResult?.extracted_metadata?.user_id;
    setManualUserId(aiUid && !aiUid.includes('MISSING') ? aiUid : '');
    
    const aiMethod = email.aiResult?.extracted_metadata?.payment_method;
    setManualPaymentMethod(aiMethod && !aiMethod.includes('MISSING') ? aiMethod : '');
    
    setErrorMsg(null);
    setSendSuccess(false);
    setImageInsights(null);
  }, [email.id]);

  const handleTriage = async () => {
    setErrorMsg(null);
    setIsAnalyzing(true);
    try {
      const overrides = [];
      if (manualUserId) overrides.push(`[USER ID]: ${manualUserId}`);
      if (manualPaymentMethod) overrides.push(`[PAYMENT METHOD]: ${manualPaymentMethod}`);
      if (humanSupplement) overrides.push(`[HUMAN SUPPLEMENT]: ${humanSupplement}`);
      
      const result = await supportAgent.analyzeEmail({
        subject: email.subject,
        body: email.body,
        attachments: email.attachments,
        agentNotes: overrides.join('\n')
      });
      
      setDraftReply(result.reply_email);
      onUpdate({
        ...email,
        aiResult: result,
        status: result.extracted_metadata.is_info_complete ? 'in_progress' : 'info_missing'
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Synthesis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeImageAttachment = async (att: Attachment) => {
    setIsImageAnalyzing(true);
    try {
      const base64Data = await gmailApi.fetchAttachmentData(email.id, att.id);
      const result = await supportAgent.analyzeImage(base64Data, att.mimeType, email.body);
      setImageInsights(result);
      const foundId = result.summary.match(/ID:\s*(\d+)/) || result.summary.match(/UID:\s*(\d+)/);
      if (foundId) setManualUserId(foundId[1]);
    } catch (e: any) {
      setErrorMsg("Image scan failed.");
    } finally {
      setIsImageAnalyzing(false);
    }
  };

  const handleSendReply = async () => {
    if (!draftReply) return;
    setIsSending(true);
    setErrorMsg(null);
    try {
      await gmailApi.sendReply(email.sender, email.subject, email.threadId, email.messageId, draftReply);
      setSendSuccess(true);
      onUpdate({ ...email, status: 'resolved', isRead: true });
    } catch (err: any) {
      setErrorMsg(`Send Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const imageAttachments = email.attachments.filter(a => a.mimeType.startsWith('image/'));
  
  // Mandatory Requirements Checklist
  const hasUid = manualUserId.length > 0 || (email.aiResult?.extracted_metadata.user_id && !email.aiResult.extracted_metadata.user_id.includes('MISSING'));
  const hasMethod = manualPaymentMethod.length > 0 || (email.aiResult?.extracted_metadata.payment_method && !email.aiResult.extracted_metadata.payment_method.includes('MISSING'));
  const hasProof = email.aiResult?.extracted_metadata.has_payment_proof || imageAttachments.length > 0;

  return (
    <div className="flex h-full w-full bg-white overflow-hidden animate-in fade-in duration-500">
      {/* Left Column: Email Content */}
      <div className="flex-1 flex flex-col border-r border-slate-100 overflow-y-auto custom-scrollbar">
        <div className="p-8 border-b border-slate-50 sticky top-0 bg-white z-10 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <Badge variant={email.status === 'resolved' ? 'green' : 'blue'}>
              {email.status.toUpperCase()}
            </Badge>
            <div className="flex gap-2">
               <Checkmark label="UID" active={!!hasUid} />
               <Checkmark label="Method" active={!!hasMethod} />
               <Checkmark label="Proof" active={!!hasProof} />
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-6">{email.subject}</h1>
          <div className="text-xs font-bold text-slate-500 flex items-center gap-2">
            <span className="text-slate-400">From:</span>
            <span className="text-slate-900">{email.senderName}</span>
            <span className="text-slate-400">({email.sender})</span>
          </div>
        </div>

        <div className="p-8 space-y-12 pb-32">
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Original Message</h3>
            <div className="bg-slate-50/50 rounded-[32px] p-8 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap border border-slate-100 min-h-[200px]">
              {email.body}
            </div>
          </section>

          {imageAttachments.length > 0 && (
            <section>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Evidence Attachments ({imageAttachments.length})</h3>
              <div className="grid grid-cols-2 gap-4">
                {imageAttachments.map(att => (
                  <div key={att.id} className="p-5 bg-white rounded-2xl border border-slate-100 flex flex-col items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 truncate w-full text-center">{att.filename}</span>
                    <button 
                      onClick={() => analyzeImageAttachment(att)} 
                      disabled={isImageAnalyzing}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all disabled:opacity-50"
                    >
                      {isImageAnalyzing ? 'Extracting Data...' : 'AI Scan Proof'}
                    </button>
                  </div>
                ))}
              </div>
              {imageInsights && (
                <div className="mt-6 p-6 bg-emerald-50 border border-emerald-100 rounded-[32px] animate-in slide-in-from-bottom border-l-8 border-l-emerald-400">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase mb-3">Vision Scan Results</h4>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">{imageInsights.summary}</p>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Right Column: AI Triage & Draft */}
      <div className="w-[450px] flex-shrink-0 bg-[#F8FAFC] border-l border-slate-200 flex flex-col p-8 gap-6 overflow-y-auto custom-scrollbar">
        {errorMsg && <div className="p-4 bg-rose-50 text-rose-600 text-[10px] font-black rounded-2xl uppercase border border-rose-100">{errorMsg}</div>}
        {sendSuccess && <div className="p-4 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-2xl uppercase border border-emerald-100 shadow-lg">Reply transmitted</div>}

        <section className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xl space-y-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between items-center">
            1. Knowledge Base overrides
            {isAnalyzing && <span className="animate-spin text-blue-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            </span>}
          </h3>
          
          <div className="space-y-4">
            <div className="relative group">
              <span className="absolute left-4 top-2 text-[8px] font-black text-slate-300 uppercase">User ID</span>
              <input value={manualUserId} onChange={e => setManualUserId(e.target.value)} className="w-full h-14 pt-4 px-4 bg-slate-50 rounded-xl text-xs font-black outline-none border border-transparent focus:border-blue-500/20 transition-all" />
            </div>
            <div className="relative group">
              <span className="absolute left-4 top-2 text-[8px] font-black text-slate-300 uppercase">Payment Method</span>
              <input value={manualPaymentMethod} onChange={e => setManualPaymentMethod(e.target.value)} className="w-full h-14 pt-4 px-4 bg-slate-50 rounded-xl text-xs font-black outline-none border border-transparent focus:border-blue-500/20 transition-all" />
            </div>
          </div>

          <div className="pt-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">2. Human supplement</h3>
            <textarea 
               value={humanSupplement} 
               onChange={e => setHumanSupplement(e.target.value)} 
               placeholder="Write additional context or manual notes here to be merged with AI reply..."
               className="w-full h-24 p-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none border border-transparent focus:border-blue-500/20 resize-none leading-relaxed"
            />
          </div>

          <button 
            onClick={handleTriage} 
            disabled={isAnalyzing} 
            className="w-full h-14 bg-slate-950 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black active:scale-95 transition-all shadow-xl shadow-slate-900/10"
          >
            {isAnalyzing ? 'SYNTHESIZING CONTEXT...' : 'SYNC AI SYNTHESIS'}
          </button>
        </section>

        <section className="flex-1 flex flex-col min-h-[300px]">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">3. Final Draft Terminal</h3>
          <div className="flex-1 bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl flex flex-col border-t-[10px] border-t-blue-600 relative overflow-hidden">
            {!hasProof && (
              <div className="absolute top-2 right-4 flex items-center gap-1.5 px-2 py-1 bg-rose-50 rounded-lg border border-rose-100">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-rose-500 uppercase">Proof Missing</span>
              </div>
            )}
            <textarea 
              className="flex-1 w-full text-sm font-bold text-slate-800 bg-transparent outline-none resize-none p-0 custom-scrollbar leading-relaxed" 
              value={draftReply} 
              onChange={e => setDraftReply(e.target.value)} 
            />
            <button 
              onClick={handleSendReply} 
              disabled={isSending || !draftReply || email.status === 'resolved'} 
              className="mt-6 w-full h-16 bg-blue-600 text-white rounded-3xl font-black text-xs tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-500/30"
            >
              {isSending ? 'SENDING...' : 'SEND REPLY'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const Checkmark = ({ label, active }: { label: string, active: boolean }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all ${active ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`}>
     <svg className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-20'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
     <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
  </div>
);

export default EmailDetail;
