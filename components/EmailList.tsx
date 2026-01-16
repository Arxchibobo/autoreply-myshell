
import React from 'react';
import { Email } from '../types';
import Badge from './Badge';

interface EmailListProps {
  emails: Email[];
  selectedId?: string;
  isSyncing?: boolean;
  onSync: () => void;
  onSelect: (email: Email) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: (selected: boolean) => void;
}

const EmailList: React.FC<EmailListProps> = ({ 
  emails, 
  selectedId, 
  isSyncing, 
  onSync, 
  onSelect, 
  onToggleSelect, 
  onSelectAll 
}) => {
  const selectedCount = emails.filter(e => e.selected).length;
  const isAllSelected = emails.length > 0 && selectedCount === emails.length;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* List Header for Bulk Actions & Sync */}
      <div className="px-6 py-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <div className="flex items-center gap-4">
          <input 
            type="checkbox" 
            checked={isAllSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {selectedCount > 0 ? `${selectedCount} Selected` : 'Select All'}
          </span>
        </div>
        
        {/* Header Sync Trigger */}
        <button 
          onClick={onSync} 
          disabled={isSyncing}
          className={`p-1.5 rounded-lg transition-colors ${isSyncing ? 'text-blue-500 animate-spin' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
          title="Sync Inbox"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
        {emails.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center h-full">
            <div className="opacity-30 flex flex-col items-center mb-8">
              <svg className="w-10 h-10 text-slate-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Nothing here</p>
            </div>
            
            {/* Primary Center Sync Button */}
            <button 
              onClick={onSync}
              disabled={isSyncing}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-500/10 ${
                isSyncing 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
              }`}
            >
              {isSyncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  Sync Inbox
                </>
              )}
            </button>
          </div>
        ) : (
          emails.map((email) => {
            const isPerfect = email.aiResult?.extracted_metadata.user_id && 
                              !email.aiResult.extracted_metadata.user_id.includes('MISSING') &&
                              email.aiResult.extracted_metadata.payment_method &&
                              !email.aiResult.extracted_metadata.payment_method.includes('MISSING') &&
                              email.aiResult.extracted_metadata.has_payment_proof;

            return (
              <div
                key={email.id}
                className={`group flex items-center transition-all border-b border-slate-50 ${
                  selectedId === email.id ? 'bg-blue-50/60' : 'hover:bg-slate-50/50'
                } ${email.selected ? 'bg-blue-50/30' : ''}`}
              >
                <div className="pl-6 py-6">
                  <input 
                    type="checkbox" 
                    checked={!!email.selected} 
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelect(email.id);
                    }}
                    className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => onSelect(email)}
                  className="flex-1 flex flex-col p-6 text-left relative overflow-hidden"
                >
                  {isPerfect && (
                    <div className="absolute top-0 right-0 p-1">
                      <div className="bg-emerald-500 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-bl-lg shadow-sm">Verified Perfect</div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      {!email.isRead && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                      <span className="text-[9px] text-slate-400 font-bold tabular-nums">
                        {new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className={`text-sm font-black text-slate-900 truncate mb-1 transition-colors ${selectedId === email.id ? 'text-blue-700' : 'group-hover:text-blue-600'}`}>
                    {email.subject}
                  </div>
                  
                  <div className="text-[10px] font-bold text-slate-400 mb-4 flex items-center gap-1.5 truncate">
                    {email.senderName}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {email.aiResult ? (
                        <Badge variant={email.aiResult.extracted_metadata.is_info_complete ? 'green' : 'red'}>
                          {email.aiResult.category.split('_')[0]}
                        </Badge>
                      ) : (
                        <div className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md text-[9px] font-black uppercase tracking-tighter">Unprocessed</div>
                      )}
                    </div>
                    
                    {email.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-slate-300">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        <span className="text-[10px] font-black">{email.attachments.length}</span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default EmailList;
