
import React, { useState, useMemo } from 'react';
import { Customer } from '../types';
import Badge from './Badge';

interface CustomerDatabaseProps {
  customers: Customer[];
  onViewThread: (threadId: string) => void;
  onDeleteCustomer: (email: string) => void;
  onUpdateCustomer: (email: string, updates: Partial<{name: string, userId: string}>) => void;
}

// Define the available tabs/categories for the view
const CATEGORY_TABS = [
  { id: 'ALL', label: 'All Records' },
  { id: 'VIP_READY', label: 'VIP / Verified', color: 'emerald' },
  { id: 'SUBSCRIPTION', label: 'Subscription & Payment', color: 'blue' },
  { id: 'ACCOUNT', label: 'Account & Tech', color: 'indigo' },
  { id: 'NSFW_ISSUE', label: 'Content Policy', color: 'rose' },
  { id: 'DELETION', label: 'Deletion', color: 'slate' }
];

const CustomerDatabase: React.FC<CustomerDatabaseProps> = ({ customers, onViewThread, onDeleteCustomer, onUpdateCustomer }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', userId: '' });

  const filtered = useMemo(() => {
    // 1. Text Search Filter
    let result = customers.filter(c => 
      c.email.toLowerCase().includes(search.toLowerCase()) || 
      c.userId.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
    );

    // 2. Tab Category Filter
    if (activeTab !== 'ALL') {
      result = result.filter(c => {
        if (activeTab === 'VIP_READY') return c.tags.includes('VIP_READY');
        if (activeTab === 'SUBSCRIPTION') return c.latestCategory.includes('SUBSCRIPTION') || c.latestCategory.includes('BILLING') || c.latestCategory.includes('POWER');
        if (activeTab === 'ACCOUNT') return c.latestCategory.includes('ACCOUNT') || c.latestCategory.includes('USAGE');
        if (activeTab === 'NSFW_ISSUE') return c.latestCategory.includes('NSFW');
        if (activeTab === 'DELETION') return c.latestCategory.includes('DELETION');
        return true;
      });
    }

    // Sort: Verified/VIP first, then by date
    return result.sort((a, b) => {
        const aVip = a.tags.includes('VIP_READY') ? 1 : 0;
        const bVip = b.tags.includes('VIP_READY') ? 1 : 0;
        if (aVip !== bVip) return bVip - aVip;
        return b.lastActive.localeCompare(a.lastActive);
    });
  }, [customers, search, activeTab]);

  const startEdit = (c: Customer) => {
    setEditingEmail(c.email);
    setEditForm({ name: c.name, userId: c.userId });
  };

  const saveEdit = () => {
    if (editingEmail) {
      onUpdateCustomer(editingEmail, editForm);
      setEditingEmail(null);
    }
  };

  return (
    <div className="flex-1 bg-white flex flex-col overflow-hidden animate-in fade-in duration-500">
      {/* HEADER & SEARCH */}
      <div className="px-10 py-8 border-b border-slate-100 bg-white z-10 shadow-sm flex flex-col gap-6">
        <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Intelligence Database</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validated customer profiles & history</p>
            </div>
            <div className="relative w-80">
              <input 
                type="text" 
                placeholder="Search records..." 
                className="w-full h-12 bg-slate-50 border-none rounded-2xl px-5 text-xs font-bold outline-none ring-2 ring-transparent focus:ring-blue-500/10 transition-all shadow-inner"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
            </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {CATEGORY_TABS.map(tab => {
                const isActive = activeTab === tab.id;
                const colors: any = {
                    emerald: isActive ? 'bg-emerald-600 text-white shadow-emerald-500/30' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                    blue: isActive ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                    indigo: isActive ? 'bg-indigo-600 text-white shadow-indigo-500/30' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                    rose: isActive ? 'bg-rose-600 text-white shadow-rose-500/30' : 'bg-rose-50 text-rose-700 hover:bg-rose-100',
                    slate: isActive ? 'bg-slate-600 text-white shadow-slate-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                };
                const defaultStyle = isActive ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50';
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${tab.color ? colors[tab.color] : defaultStyle} ${isActive ? 'scale-105' : 'scale-100'}`}
                    >
                        {tab.label}
                    </button>
                )
            })}
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/30">
        <div className="grid grid-cols-1 gap-6 max-w-5xl mx-auto">
          {filtered.length === 0 ? (
            <div className="py-20 text-center opacity-30 flex flex-col items-center">
              <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              <p className="text-xs font-black uppercase tracking-widest">No customers found in this category.</p>
            </div>
          ) : (
            filtered.map((customer) => (
              <div key={customer.email} className="bg-white rounded-[24px] border border-slate-100 p-0 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col">
                 
                 {/* Card Header */}
                 <div className="p-6 pb-4 border-b border-slate-50 flex justify-between items-start bg-gradient-to-r from-white to-slate-50/50">
                    <div className="flex gap-5 items-center">
                        <div className="relative">
                            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-lg font-black italic shadow-lg">
                                {customer.name[0] || 'U'}
                            </div>
                            {customer.tags.includes('VIP_READY') && (
                                <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-sm border-2 border-white">VIP</div>
                            )}
                        </div>
                        
                        <div>
                            {editingEmail === customer.email ? (
                                <div className="space-y-2">
                                    <input 
                                        className="text-sm font-black bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-blue-500 w-40"
                                        value={editForm.name}
                                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                                    />
                                </div>
                            ) : (
                                <h3 className="text-base font-black text-slate-900 mb-1">{customer.name}</h3>
                            )}
                            
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[150px]">{customer.email}</span>
                                {editingEmail === customer.email ? (
                                    <input 
                                        className="text-[9px] font-bold text-blue-600 bg-blue-50 border-none rounded-md px-2 py-0.5 outline-none w-24"
                                        value={editForm.userId}
                                        onChange={e => setEditForm({...editForm, userId: e.target.value})}
                                    />
                                ) : (
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide ${customer.userId !== 'UNLINKED' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 bg-slate-100'}`}>
                                        {customer.userId !== 'UNLINKED' ? `UID: ${customer.userId}` : 'NO UID'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         {editingEmail === customer.email ? (
                            <button onClick={saveEdit} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                            </button>
                         ) : (
                            <button onClick={() => startEdit(customer)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            </button>
                         )}
                         <button onClick={() => confirm(`Delete data for ${customer.email}?`) && onDeleteCustomer(customer.email)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                         </button>
                    </div>
                 </div>

                 {/* Card Body - Tags & Stats */}
                 <div className="p-6 grid grid-cols-12 gap-6 items-center">
                    <div className="col-span-4">
                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Category Tag</div>
                        <div className="flex flex-wrap gap-2">
                            {customer.tags.length > 0 ? (
                                customer.tags.map(tag => (
                                    <Badge key={tag} variant={tag === 'VIP_READY' ? 'green' : 'gray'}>{tag.replace('_', ' ')}</Badge>
                                ))
                            ) : (
                                <Badge variant="gray">{customer.latestCategory.split('_')[0]}</Badge>
                            )}
                        </div>
                    </div>
                    
                    <div className="col-span-8 flex gap-4">
                        <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Activity</div>
                             <div className="flex justify-between items-end">
                                <span className="text-lg font-black text-slate-800">{customer.totalTickets}</span>
                                <span className="text-[9px] font-bold text-slate-400">{new Date(customer.lastActive).toLocaleDateString()}</span>
                             </div>
                        </div>
                        <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolved</div>
                             <div className="flex justify-between items-end">
                                <span className="text-lg font-black text-emerald-600">{customer.resolvedCount}</span>
                                <div className="h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{width: `${(customer.resolvedCount / (customer.totalTickets || 1)) * 100}%`}}/>
                                </div>
                             </div>
                        </div>
                    </div>
                 </div>

                 {/* Card Footer - Recent Threads */}
                 <div className="bg-slate-50/50 p-4 border-t border-slate-50 space-y-2">
                    {customer.threads.slice(0, 2).map(thread => (
                        <div key={thread.id} onClick={() => onViewThread(thread.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white hover:shadow-sm cursor-pointer transition-all group/thread">
                            <div className={`w-1.5 h-1.5 rounded-full ${thread.status === 'resolved' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-slate-700 truncate group-hover/thread:text-blue-600 transition-colors">{thread.subject}</div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-300 tabular-nums">{new Date(thread.timestamp).toLocaleDateString()}</span>
                        </div>
                    ))}
                 </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerDatabase;
