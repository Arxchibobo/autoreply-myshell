
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Email, SupportStats, Customer } from './types';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import Dashboard from './components/Dashboard';
import CustomerDatabase from './components/CustomerDatabase';
import BulkActionPanel from './components/BulkActionPanel';
import { gmailApi } from './services/gmailService';
import { supportAgent } from './services/geminiService';

const FIXED_CLIENT_ID = "153665040479-6ll5r9urlcrb8e8tkc3qknacoos66hhi.apps.googleusercontent.com";
const STORAGE_KEY = 'myshell_support_v9'; 
const AUTH_KEY = 'myshell_auth_session';

const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'database'>('dashboard');
  const [activeTab, setActiveTab] = useState<'new' | 'in_progress' | 'resolved'>('new');
  const [userProfile, setUserProfile] = useState<{name: string, email: string, picture: string} | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  
  const tokenClientRef = useRef<any>(null);

  // 初始化加载
  useEffect(() => {
    const authSession = localStorage.getItem(AUTH_KEY);
    if (authSession) {
      try {
        const { token, profile } = JSON.parse(authSession);
        if (token) {
          gmailApi.setToken(token);
          setUserProfile(profile);
          setIsAuthenticated(true);
        }
      } catch (e) { localStorage.removeItem(AUTH_KEY); }
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setEmails(parsed);
      } catch (e) {}
    }
  }, []);

  // 状态持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
  }, [emails]);

  // 核心同步与自动归纳逻辑
  const syncAndTriage = async () => {
    if (isProcessing || !isAuthenticated) return;
    setIsProcessing(true);
    setSyncError(null);
    try {
      const fetched = await gmailApi.fetchMessages(20);
      let updatedList: Email[] = [];
      
      setEmails(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const newOnes = fetched.filter(f => !existingIds.has(f.id));
        updatedList = [...newOnes, ...prev];
        return updatedList;
      });

      // 自动对新邮件进行 AI 归类
      const unread = fetched.filter(f => f.status === 'new');
      if (unread.length > 0) {
        for (const email of unread) {
          try {
            const result = await supportAgent.analyzeEmail({
              subject: email.subject,
              body: email.body,
              attachments: email.attachments
            });
            setEmails(prev => prev.map(e => e.id === email.id ? {
              ...e,
              aiResult: result,
              status: result.extracted_metadata.is_info_complete ? 'in_progress' : 'info_missing'
            } : e));
          } catch (e) {}
        }
      }
    } catch (err: any) {
      setSyncError(err.message);
      if (err.message.includes("AUTH")) handleLogout();
    } finally {
      setIsProcessing(false);
    }
  };

  // 自动触发逻辑：一旦验证成功就同步
  useEffect(() => {
    if (isAuthenticated) {
      syncAndTriage();
    }
  }, [isAuthenticated]);

  const customers = useMemo(() => {
    const db: Record<string, Customer> = {};
    
    // Sort emails by date ascending first to ensure latest overwrites correctly
    const sortedEmails = [...emails].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    sortedEmails.forEach(email => {
      const key = email.sender.toLowerCase();
      const extractedUid = email.aiResult?.extracted_metadata.user_id;
      const category = email.aiResult?.category || 'OTHER';

      if (!db[key]) {
        db[key] = {
          email: key, 
          name: email.senderName,
          userId: (extractedUid && !extractedUid.includes('MISSING')) ? extractedUid : 'UNLINKED',
          latestCategory: 'OTHER',
          tags: [],
          threads: [], 
          totalTickets: 0, 
          lastActive: email.timestamp, 
          resolvedCount: 0
        };
      }

      // Update basic info if newer
      if (db[key].userId === 'UNLINKED' && extractedUid && !extractedUid.includes('MISSING')) {
        db[key].userId = extractedUid;
      }
      
      db[key].latestCategory = category; // Since we sorted by date, this will end up being the latest
      db[key].lastActive = email.timestamp;
      
      db[key].threads.push({ 
        id: email.id, 
        subject: email.subject, 
        status: email.status, 
        timestamp: email.timestamp,
        category: category
      });
      
      db[key].totalTickets += 1;
      if (email.status === 'resolved') db[key].resolvedCount += 1;
    });

    // Post-process for tags
    return Object.values(db).map(c => {
      const tags = [];
      if (c.userId !== 'UNLINKED') tags.push('VERIFIED_UID');
      if (c.latestCategory.includes('SUBSCRIPTION')) tags.push('PAID_USER');
      if (c.latestCategory.includes('VERIFIED')) tags.push('VIP_READY');
      if (c.totalTickets > 3) tags.push('FREQUENT');
      return { ...c, tags };
    });
  }, [emails]);

  const handleDeleteCustomer = (email: string) => {
    setEmails(prev => prev.filter(e => e.sender.toLowerCase() !== email.toLowerCase()));
  };

  const handleUpdateCustomer = (email: string, updates: Partial<{name: string, userId: string}>) => {
    setEmails(prev => prev.map(e => {
      if (e.sender.toLowerCase() !== email.toLowerCase()) return e;
      const newEmail = { ...e };
      if (updates.name) newEmail.senderName = updates.name;
      if (updates.userId && newEmail.aiResult) {
        newEmail.aiResult.extracted_metadata.user_id = updates.userId;
      }
      return newEmail;
    }));
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const initGoogleAuth = () => {
    if (!(window as any).google?.accounts?.oauth2) return;
    tokenClientRef.current = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: FIXED_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: async (res: any) => {
        if (res.access_token) {
          gmailApi.setToken(res.access_token);
          const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${res.access_token}` } });
          const profile = await profileRes.json();
          setUserProfile({ name: profile.name, email: profile.email, picture: profile.picture });
          localStorage.setItem(AUTH_KEY, JSON.stringify({ token: res.access_token, profile }));
          setIsAuthenticated(true);
        }
      },
    });
  };

  useEffect(() => {
    const timer = setInterval(() => { 
      if ((window as any).google?.accounts?.oauth2) { 
        initGoogleAuth(); 
        clearInterval(timer); 
      } 
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => ({
    total: emails.length,
    new: emails.filter(e => e.status === 'new').length,
    inProgress: emails.filter(e => e.status === 'in_progress' || e.status === 'info_missing').length,
    resolved: emails.filter(e => e.status === 'resolved').length,
    infoMissing: emails.filter(e => e.status === 'info_missing').length,
    metrics: {
      uidCount: emails.filter(e => e.aiResult?.extracted_metadata.user_id && !e.aiResult.extracted_metadata.user_id.includes('MISSING')).length,
      paymentMethodCount: emails.filter(e => e.aiResult?.extracted_metadata.payment_method && !e.aiResult.extracted_metadata.payment_method.includes('MISSING')).length,
      proofCount: emails.filter(e => e.aiResult?.extracted_metadata.has_payment_proof).length,
      perfectCount: emails.filter(e => e.status === 'resolved').length
    }
  }), [emails]);

  const filteredEmails = useMemo(() => 
    emails.filter(e => {
      const matchesTab = (activeTab === 'new' && e.status === 'new') || 
                        (activeTab === 'in_progress' && (e.status === 'in_progress' || e.status === 'info_missing')) ||
                        (activeTab === 'resolved' && e.status === 'resolved');
      const q = searchQuery.toLowerCase();
      return matchesTab && (!q || e.subject.toLowerCase().includes(q) || e.sender.toLowerCase().includes(q));
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [emails, activeTab, searchQuery]
  );

  // Derived state for bulk selection
  const selectedCount = emails.filter(e => e.selected).length;
  const selectedEmails = emails.filter(e => e.selected);

  const handleBulkUpdate = (updates: { id: string; changes: Partial<Email> }[]) => {
    setEmails(prev => prev.map(e => {
      const update = updates.find(u => u.id === e.id);
      return update ? { ...e, ...update.changes } : e;
    }));
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-[40px] p-12 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black italic mb-10 mx-auto text-3xl">M</div>
          <h1 className="text-2xl font-black text-white uppercase mb-12">MyShell Intelligence</h1>
          <button onClick={() => tokenClientRef.current?.requestAccessToken()} className="w-full h-16 bg-white text-slate-900 rounded-2xl font-black shadow-xl">SIGN IN WITH GOOGLE</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900">
      <aside className="w-20 bg-slate-950 flex flex-col items-center py-8 gap-8 shadow-2xl z-40">
        <div onClick={() => setCurrentView('dashboard')} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black italic cursor-pointer shadow-xl">M</div>
        <nav className="flex flex-col gap-6">
          <NavItem icon="home" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon="inbox" active={currentView === 'workspace'} onClick={() => setCurrentView('workspace')} badge={stats.new} />
          <NavItem icon="users" active={currentView === 'database'} onClick={() => setCurrentView('database')} />
        </nav>
        <div className="mt-auto flex flex-col gap-6 items-center pb-4">
          <button onClick={syncAndTriage} className={`p-3 text-slate-500 hover:text-white transition-all ${isProcessing ? 'animate-spin text-blue-400' : ''}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <img src={userProfile?.picture} className="w-10 h-10 rounded-xl border border-slate-800 cursor-pointer" onClick={handleLogout} />
        </div>
      </aside>

      {currentView === 'dashboard' && <Dashboard stats={stats as any} onEnterWorkspace={() => setCurrentView('workspace')} />}
      
      {currentView === 'database' && (
        <CustomerDatabase 
          customers={customers} 
          onDeleteCustomer={handleDeleteCustomer}
          onUpdateCustomer={handleUpdateCustomer}
          onViewThread={(id) => {
            const email = emails.find(e => e.id === id);
            if (email) { setSelectedEmail(email); setCurrentView('workspace'); }
          }}
        />
      )}

      {currentView === 'workspace' && (
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-[400px] flex flex-col border-r border-slate-200 bg-white relative z-10 group/sidebar">
            <div className="p-8 border-b border-slate-50">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xs font-black text-slate-900 tracking-widest uppercase">Inbox Queue</h2>
                 {isProcessing && <span className="text-[10px] font-black text-blue-600 animate-pulse">SYNCING...</span>}
               </div>
               <nav className="flex gap-4 mb-6">
                 {['new', 'in_progress', 'resolved'].map(t => (
                   <button key={t} onClick={() => setActiveTab(t as any)} className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${activeTab === t ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100'}`}>
                     {t.replace('_', ' ')}
                   </button>
                 ))}
               </nav>
               <input type="text" placeholder="Filter..." className="w-full bg-slate-50 border-none rounded-xl py-3 px-5 text-xs font-bold outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex-1 overflow-hidden relative">
               <EmailList 
                 emails={filteredEmails} 
                 selectedId={selectedEmail?.id} 
                 onSelect={(e) => {
                   setSelectedEmail(e);
                   setShowBulkPanel(false);
                 }} 
                 onToggleSelect={(id) => setEmails(prev => prev.map(e => e.id === id ? { ...e, selected: !e.selected } : e))} 
                 onSelectAll={(sel) => setEmails(prev => prev.map(e => filteredEmails.some(fe => fe.id === e.id) ? { ...e, selected: sel } : e))} 
               />
               
               {/* Floating Bulk Action Button */}
               {selectedCount > 0 && (
                 <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6">
                   <button 
                     onClick={() => {
                       setShowBulkPanel(true);
                       setSelectedEmail(null);
                     }}
                     className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                   >
                     <span className="text-xs font-black uppercase tracking-widest">Process ({selectedCount})</span>
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                   </button>
                 </div>
               )}
            </div>
          </aside>
          
          <main className="flex-1 overflow-hidden bg-[#F8FAFC]">
            {showBulkPanel && selectedCount > 0 ? (
              <BulkActionPanel 
                selectedEmails={selectedEmails} 
                onUpdateEmails={handleBulkUpdate}
                onClearSelection={() => {
                  setEmails(prev => prev.map(e => ({ ...e, selected: false })));
                  setShowBulkPanel(false);
                }}
              />
            ) : selectedEmail ? (
              <EmailDetail email={selectedEmail} onUpdate={(updated) => setEmails(prev => prev.map(e => e.id === updated.id ? updated : e))} />
            ) : (
              <div className="flex-1 h-full flex items-center justify-center text-center p-20 opacity-30">
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Select a thread or use bulk process</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
};

const NavItem = ({ icon, active, onClick, badge }: any) => {
  const icons: any = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>,
    inbox: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
  };
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl transition-all relative group ${active ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}>
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icons[icon]}</svg>
      {badge > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black border-4 border-slate-950">{badge}</span>}
    </button>
  );
};

export default App;
