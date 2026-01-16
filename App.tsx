
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Email, DatabaseTicket, SupportStats, Customer, SupportCategory, Template, LinkedUserProfile } from './types';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import Dashboard from './components/Dashboard';
import CustomerDatabase from './components/CustomerDatabase';
import BulkActionPanel from './components/BulkActionPanel';
import DatabaseWorkspace from './components/DatabaseWorkspace';
import TemplateManager from './components/TemplateManager';
import { gmailApi } from './services/gmailService';
import { supportAgent } from './services/geminiService';
import { MOCK_EMAILS } from './constants';

const CLIENT_ID = "153665040479-6ll5r9urlcrb8e8tkc3qknacoos66hhi.apps.googleusercontent.com";
const STORAGE_KEY = 'myshell_support_v16_state'; 
const AUTH_KEY = 'myshell_auth_token';

const DEFAULT_TEMPLATES: Template[] = [
  { 
    id: 'T1', 
    name: 'Information Recovery', 
    category: SupportCategory.SUBSCRIPTION_MISSING_INFO, 
    rulePrompt: 'Use when a user asks about subscription/recharge issues but lacks full info (missing UID, payment method, or receipt).',
    content: `Dear Customer,\n\nThank you for contacting MyShell.\n\nTo investigate your transaction, we require the following missing details:\n\n- Your unique User ID\n- Payment platform used (e.g., Stripe/PayPal)\n- A clear screenshot of the receipt/confirmation\n\nOnce provided, our team will manually verify and update your balance.\n\nBest regards,\nMyShell Support Team` 
  },
  { 
    id: 'T2', 
    name: 'NSFW Policy Notice', 
    category: SupportCategory.NSFW_ISSUE, 
    rulePrompt: 'Use when a user complains about NSFW content being locked or bots being limited after policy changes.',
    content: `Dear Customer,\n\nThank you for your inquiry. Please be advised that NSFW content and associated bots are now a Pro-exclusive feature.\n\nTo unlock these capabilities, consider upgrading your account. We currently have a promotion: Use code UPGRADEPRO for 50% off yearly plans.\n\nBest regards,\nMyShell Support Team` 
  },
  { 
    id: 'T3', 
    name: 'Technical Diagnostics', 
    category: SupportCategory.ACCOUNT_USAGE_ERROR, 
    rulePrompt: 'Use for account-related technical bugs, 500 errors, or usage failures where we need the UID to check the backend.',
    content: `Dear Customer,\n\nWe are sorry to hear you're experiencing technical difficulties.\n\nWe have logged this issue with our engineering team. To expedite the fix, please confirm:\n- Your UID\n- Your device OS version\n\nExpect a follow-up within 72 hours.\n\nBest regards,\nMyShell Support Team` 
  },
  { 
    id: 'T4', 
    name: 'Account Deletion Guide', 
    category: SupportCategory.ACCOUNT_DELETION, 
    rulePrompt: 'Use when a user explicitly requests to delete their account or personal data.',
    content: `Dear Customer,\n\nYou can delete your account via My Profile > Settings > Delete Account.\n\nPlease note that this action is permanent and all data will be erased.\n\nBest regards,\nMyShell Support Team` 
  },
  { 
    id: 'T5', 
    name: 'Energy Consumption Explained', 
    category: SupportCategory.BOT_POWER_ISSUE, 
    rulePrompt: 'Use when a user complains about a bot consuming too much energy/power per task.',
    content: `Dear Customer,\n\nOur power system is dynamic. Consumption is calculated post-task based on complexity.\n\nWe are working on detailed usage logs to improve transparency.\n\nBest regards,\nMyShell Support Team` 
  },
  { 
    id: 'T6', 
    name: 'Subscription Reminder', 
    category: SupportCategory.POST_DELETION_BILLING, 
    rulePrompt: 'Use when a user is still being charged by PayPal/Stripe after deleting their MyShell account.',
    content: `Dear Customer,\n\nNote that deleting your MyShell account does not automatically cancel third-party billing cycles (Stripe/PayPal).\n\nPlease cancel your active subscription in your payment portal to prevent future charges.\n\nBest regards,\nMyShell Support Team` 
  },
  { 
    id: 'T7', 
    name: 'AI INTELLIGENT REPLY', 
    category: SupportCategory.OTHER, 
    rulePrompt: 'DEFAULT: Use for general queries or when subscription info is already complete. Generate a smart context-aware reply.',
    content: `[AI CONTEXT-AWARE DRAFT]` 
  }
];

const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [dbTickets, setDbTickets] = useState<DatabaseTicket[]>([]);
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace' | 'database' | 'db_workspace' | 'templates'>('dashboard');
  const [activeTab, setActiveTab] = useState<'new' | 'in_progress' | 'resolved'>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [userProfile, setUserProfile] = useState<{name: string, email: string, picture: string} | null>(null);
  const [activeModel, setActiveModel] = useState<string>('gemini-3-flash-preview');
  
  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    const initGsi = () => {
      const google = (window as any).google;
      if (google && google.accounts && google.accounts.oauth2) {
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
          callback: (response: any) => {
            if (response.access_token) {
              localStorage.setItem(AUTH_KEY, response.access_token);
              gmailApi.setToken(response.access_token);
              setIsAuthenticated(true);
              fetchUserInfo(response.access_token);
              setEmails([]);
              setSelectedEmail(null);
            }
          },
        });
      } else { setTimeout(initGsi, 500); }
    };
    initGsi();

    const savedToken = localStorage.getItem(AUTH_KEY);
    const savedData = localStorage.getItem(STORAGE_KEY);
    
    if (savedToken === 'mock_token') {
      enterMockMode(false);
    } else if (savedToken) {
      gmailApi.setToken(savedToken);
      setIsAuthenticated(true);
      fetchUserInfo(savedToken);
    }

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.emails) setEmails(parsed.emails);
        if (parsed.dbTickets) setDbTickets(parsed.dbTickets);
        if (parsed.templates) setTemplates(parsed.templates);
        if (parsed.activeModel) setActiveModel(parsed.activeModel);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ emails, dbTickets, templates, activeModel }));
  }, [emails, dbTickets, templates, activeModel]);

  const enterMockMode = (forceLoad: boolean = true) => {
    localStorage.setItem(AUTH_KEY, 'mock_token');
    setIsAuthenticated(true);
    setUserProfile({
      name: "Dev Admin (Mock)",
      email: "support-dev@myshell.ai",
      picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=MyShellDev"
    });
    
    if (forceLoad && emails.length === 0) {
      const initEmails = MOCK_EMAILS.map(m => ({
        ...m,
        id: m.id.startsWith('init_') ? m.id : `init_${m.id}`,
        messageId: m.messageId || `msg_${m.id}`,
        threadId: m.threadId || `thread_${m.id}`,
        isRead: m.isRead ?? false,
        status: m.status ?? 'new',
        selected: false,
        attachments: m.attachments || []
      }));
      setEmails(initEmails);
    }
    setCurrentView('workspace');
    setActiveTab('in_progress'); 
  };

  const fetchUserInfo = async (token: string) => {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await resp.json();
      setUserProfile({ name: data.name, email: data.email, picture: data.picture });
    } catch (e) {}
  };

  const handleLogin = () => {
    if (tokenClientRef.current) tokenClientRef.current.requestAccessToken();
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
    gmailApi.setToken(null);
    window.location.reload();
  };

  const handleSyncInbox = async () => {
    if (isProcessing) return;
    if (!isAuthenticated) { enterMockMode(true); return; }

    setIsProcessing(true);
    try {
      const savedToken = localStorage.getItem(AUTH_KEY);
      let incoming: Email[] = [];
      if (savedToken !== 'mock_token') {
        incoming = await gmailApi.fetchMessages(20);
      } else {
        await new Promise(r => setTimeout(r, 1200));
        const ts = Date.now();
        incoming = [
          {
            id: `sync_mock_${ts}_1`,
            threadId: `thread_${ts}_1`,
            sender: 'test.user1@myshell.ai',
            senderName: 'Lucas Mock',
            subject: `Payment Query #${ts % 1000}`,
            body: "I just paid for the Pro plan but the energy isn't showing up. My UID is 99228811.",
            timestamp: new Date().toISOString(),
            status: 'new',
            attachments: [],
            isRead: false,
            messageId: `msg_${ts}_1`
          }
        ] as any;
      }

      setEmails(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const filtered = incoming.filter(f => !existingIds.has(f.id)).map(f => ({ ...f, selected: true }));
        return [...filtered, ...prev];
      });
      setActiveTab('new');
    } catch (err: any) {
      if (err.message === 'AUTH_EXPIRED') handleLogin();
      else alert("Sync failed: " + err.message);
    } finally { setIsProcessing(false); }
  };

  const handleAIProcess = async () => {
    const selectedToProcess = emails.filter(e => e.selected && e.status !== 'resolved');
    if (selectedToProcess.length === 0) return;

    setIsProcessing(true);
    try {
      const processedEmails = await Promise.all(selectedToProcess.map(async (email) => {
        const threadHistory = emails
            .filter(e => e.threadId === email.threadId && e.id !== email.id)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        const latestSummary = threadHistory.find(h => h.aiResult?.chinese_summary)?.aiResult?.chinese_summary;

        const aiResult = await supportAgent.analyzeEmail({
          subject: email.subject,
          body: email.body,
          attachments: email.attachments,
          previousSummary: latestSummary,
          activeTemplates: templates,
          model: activeModel
        });

        let status: Email['status'] = 'in_progress';
        if (aiResult.extracted_metadata.is_info_complete) {
          status = 'ready_to_resolve';
        } else if (aiResult.category === SupportCategory.SUBSCRIPTION_MISSING_INFO) {
          status = 'info_missing';
        }

        return { ...email, aiResult, status, selected: false }; 
      }));

      setEmails(prev => prev.map(e => {
          const processed = processedEmails.find(p => p.id === e.id);
          return processed ? processed : e;
      }));
      setActiveTab('in_progress');
    } catch (err: any) {
      console.error(err);
      alert("AI Processing error.");
    } finally { setIsProcessing(false); }
  };

  const handleUpdateEmail = (updated: Email) => {
    setEmails(prev => prev.map(e => e.id === updated.id ? updated : e));
    // 重要：确保当前选中的邮件对象也被同步更新，触发子组件重绘
    if (selectedEmail?.id === updated.id) {
      setSelectedEmail(updated);
    }
  };

  const customers = useMemo(() => {
    const db: Record<string, Customer> = {};
    emails.forEach(email => {
      const key = email.sender.toLowerCase();
      if (!db[key]) db[key] = { email: key, name: email.senderName, userId: 'UNLINKED', latestCategory: 'OTHER', tags: [], threads: [], totalTickets: 0, lastActive: email.timestamp, resolvedCount: 0 };
      const uid = email.aiResult?.extracted_metadata.user_id;
      if (uid && !uid.includes('MISSING')) db[key].userId = uid;
      db[key].threads.push({ id: email.id, source: 'gmail', subject: email.subject, status: email.status, timestamp: email.timestamp, category: email.aiResult?.category });
      db[key].totalTickets++;
      if (email.status === 'resolved') db[key].resolvedCount++;
      if (email.timestamp > db[key].lastActive) db[key].lastActive = email.timestamp;
    });
    return Object.values(db);
  }, [emails]);

  const stats = useMemo(() => ({
    total: emails.length + dbTickets.length,
    gmailCount: emails.length,
    dbCount: dbTickets.length,
    new: emails.filter(e => e.status === 'new').length,
    inProgress: emails.filter(e => e.status === 'in_progress' || e.status === 'ready_to_resolve' || e.status === 'info_missing').length,
    resolved: emails.filter(e => e.status === 'resolved').length,
    metrics: {
      uidCount: emails.filter(e => e.aiResult?.extracted_metadata.user_id && !e.aiResult.extracted_metadata.user_id.includes('MISSING')).length,
      paymentMethodCount: emails.filter(e => e.aiResult?.extracted_metadata.payment_method && !e.aiResult.extracted_metadata.payment_method.includes('MISSING')).length,
      proofCount: emails.filter(e => e.aiResult?.extracted_metadata.has_payment_proof).length,
      perfectCount: emails.filter(e => e.status === 'ready_to_resolve').length
    }
  }), [emails, dbTickets]);

  const filteredEmails = useMemo(() => 
    emails.filter(e => {
      const matchesTab = (activeTab === 'new' && e.status === 'new') || 
                        (activeTab === 'in_progress' && (e.status === 'in_progress' || e.status === 'info_missing' || e.status === 'ready_to_resolve')) ||
                        (activeTab === 'resolved' && e.status === 'resolved');
      const q = searchQuery.toLowerCase();
      return matchesTab && (!q || e.subject.toLowerCase().includes(q) || e.sender.toLowerCase().includes(q));
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [emails, activeTab, searchQuery]
  );

  const selectedCount = emails.filter(e => e.selected && filteredEmails.some(fe => fe.id === e.id)).length;

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden text-slate-900">
      <aside className="w-20 bg-slate-950 flex flex-col items-center py-8 gap-8 shadow-2xl z-40">
        <div onClick={() => setCurrentView('dashboard')} className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black italic cursor-pointer shadow-lg shadow-blue-500/20">M</div>
        <nav className="flex flex-col gap-6">
          <NavItem icon="home" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <NavItem icon="inbox" active={currentView === 'workspace'} onClick={() => setCurrentView('workspace')} badge={stats.inProgress} />
          <NavItem icon="database_sync" active={currentView === 'db_workspace'} onClick={() => setCurrentView('db_workspace')} />
          <NavItem icon="users" active={currentView === 'database'} onClick={() => setCurrentView('database')} />
          <NavItem icon="templates" active={currentView === 'templates'} onClick={() => setCurrentView('templates')} />
        </nav>
        <div className="mt-auto flex flex-col items-center gap-6 pb-4">
          <button onClick={() => enterMockMode(true)} className={`p-3 transition-colors ${localStorage.getItem(AUTH_KEY) === 'mock_token' ? 'text-amber-400' : 'text-slate-600 hover:text-white'}`}>
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86 1.412l-1.874 1.562a2 2 0 01-2.546.125l-1.587-1.133a2 2 0 01-.825-2.023l.412-2.115a6 6 0 00-1.09-4.516l-1.588-2.126a2 2 0 01.313-2.613l1.804-1.543a2 2 0 012.384-.216l2.126 1.275a6 6 0 006.182 0l2.126-1.275a2 2 0 012.384.216l1.804 1.543a2 2 0 01.313 2.613l-1.588 2.126a6 6 0 00-1.09 4.516l.412 2.115a2 2 0 01-.825 2.023l-1.587 1.133a2 2 0 01-1.022.547z"/></svg>
          </button>
          <button onClick={handleSyncInbox} className={`p-3 text-slate-500 hover:text-white transition-colors ${isProcessing ? 'animate-spin text-blue-400' : ''}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          </button>
          <img src={userProfile?.picture || "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"} className={`w-10 h-10 rounded-xl border cursor-pointer ${isAuthenticated ? 'border-blue-500' : 'border-slate-800'}`} onClick={isAuthenticated ? handleLogout : handleLogin} />
        </div>
      </aside>

      {currentView === 'dashboard' && <Dashboard stats={stats as any} onEnterWorkspace={() => setCurrentView('workspace')} activeModel={activeModel} onModelChange={setActiveModel} />}
      {currentView === 'database' && <CustomerDatabase customers={customers} onDeleteCustomer={(email) => setEmails(prev => prev.filter(e => e.sender !== email))} onUpdateCustomer={(email, updates) => setEmails(prev => prev.map(e => e.sender === email ? { ...e, senderName: updates.name || e.senderName } : e))} onViewThread={(id) => { const email = emails.find(e => e.id === id); if (email) { setSelectedEmail(email); setCurrentView('workspace'); } }} />}
      {currentView === 'db_workspace' && <DatabaseWorkspace tickets={dbTickets} onTicketsUpdate={setDbTickets} templates={templates} activeModel={activeModel} />}
      {currentView === 'templates' && <TemplateManager templates={templates} onUpdateTemplates={setTemplates} />}

      {currentView === 'workspace' && (
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-[300px] flex flex-col border-r border-slate-200 bg-white">
            <div className="p-6 border-b border-slate-50">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Inbox</h2>
                 <button onClick={handleAIProcess} disabled={isProcessing || selectedCount === 0} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${selectedCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    AI PROCESS {selectedCount > 0 ? `(${selectedCount})` : ''}
                 </button>
               </div>
               <nav className="flex gap-2 mb-6">
                 {['new', 'in_progress', 'resolved'].map(t => <button key={t} onClick={() => setActiveTab(t as any)} className={`text-[9px] font-black uppercase px-2 py-1.5 rounded-lg ${activeTab === t ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-100'}`}>{t}</button>)}
               </nav>
               <input type="text" placeholder="Search..." className="w-full bg-slate-50 border-none rounded-xl py-3 px-5 text-xs font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex-1 overflow-hidden">
               <EmailList 
                 emails={filteredEmails} 
                 isSyncing={isProcessing}
                 onSync={handleSyncInbox}
                 selectedId={selectedEmail?.id} 
                 onSelect={(e) => setSelectedEmail(e)} 
                 onToggleSelect={(id) => setEmails(prev => prev.map(e => e.id === id ? { ...e, selected: !e.selected } : e))} 
                 onSelectAll={(sel) => setEmails(prev => prev.map(e => filteredEmails.some(fe => fe.id === e.id) ? { ...e, selected: sel } : e))} 
               />
            </div>
          </aside>
          <main className="flex-1 overflow-hidden">
             {selectedEmail ? <EmailDetail email={selectedEmail} templates={templates} history={emails.filter(e => e.sender === selectedEmail.sender).sort((a,b) => b.timestamp.localeCompare(a.timestamp))} activeModel={activeModel} onSelectHistory={(e) => setSelectedEmail(e)} onUpdate={handleUpdateEmail} /> : <div className="flex-1 h-full flex items-center justify-center opacity-30 text-xs font-black">SELECT THREAD</div>}
          </main>
        </div>
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: string; active: boolean; onClick: () => void; badge?: number }> = ({ icon, active, onClick, badge }) => {
  const icons: Record<string, React.ReactNode> = {
    home: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
    inbox: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>,
    database_sync: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/></svg>,
    users: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
    templates: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  };
  return (
    <div onClick={onClick} className={`relative p-3 rounded-xl cursor-pointer ${active ? 'bg-blue-600/20 text-blue-500' : 'text-slate-500 hover:bg-slate-800'}`}>
      {icons[icon]}
      {badge ? <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">{badge}</span> : null}
    </div>
  );
};

export default App;
