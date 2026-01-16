
import React, { useState } from 'react';
import { Template } from '../types';

interface TemplateManagerProps {
  templates: Template[];
  onUpdateTemplates: (templates: Template[]) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({ templates, onUpdateTemplates }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', content: '', rulePrompt: '' });
  const [createForm, setCreateForm] = useState({ name: '', content: '', rulePrompt: '' });

  const handleEdit = (t: Template) => {
    setEditingId(t.id);
    setIsCreating(false);
    setEditForm({ name: t.name, content: t.content, rulePrompt: t.rulePrompt || '' });
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const next = templates.map(t => t.id === editingId ? { 
      ...t, 
      name: editForm.name, 
      content: editForm.content,
      rulePrompt: editForm.rulePrompt
    } : t);
    onUpdateTemplates(next);
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!createForm.name || !createForm.content) {
      alert("Please fill in both name and content.");
      return;
    }
    const newId = `T${templates.length + 1}_${Date.now().toString().slice(-4)}`;
    const newTemplate: Template = {
      id: newId,
      name: createForm.name,
      content: createForm.content,
      rulePrompt: createForm.rulePrompt
    };
    onUpdateTemplates([...templates, newTemplate]);
    setIsCreating(false);
    setCreateForm({ name: '', content: '', rulePrompt: '' });
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] overflow-y-auto p-12 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Response Templates</h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Standardized Decision Tree Outcomes</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => { setIsCreating(true); setEditingId(null); }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Template
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Creation Form Card */}
          {isCreating && (
            <div className="bg-white rounded-[32px] border-2 border-blue-500 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
              <div className="p-10 space-y-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">New Template Configuration</h3>
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">DRAFT</span>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Template Title</label>
                  <input 
                    placeholder="e.g., Refund Processing Guide"
                    className="w-full bg-slate-50 rounded-xl px-5 py-3 text-xs font-black outline-none border-2 border-transparent focus:border-blue-200 transition-all"
                    value={createForm.name}
                    onChange={e => setCreateForm({...createForm, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 block">Selection Rule (AI Prompt)</label>
                  <textarea 
                    placeholder="Explain to AI when to use this template (e.g., 'Use when the user is angry about energy usage')..."
                    className="w-full h-24 bg-blue-50/30 rounded-xl px-5 py-3 text-xs font-bold outline-none border-2 border-transparent focus:border-blue-200 resize-none transition-all"
                    value={createForm.rulePrompt}
                    onChange={e => setCreateForm({...createForm, rulePrompt: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Response Content</label>
                  <textarea 
                    placeholder="Write the standardized response message here..."
                    className="w-full h-64 bg-slate-50 rounded-2xl p-6 text-xs font-bold outline-none border-2 border-transparent focus:border-blue-200 resize-none leading-relaxed transition-all"
                    value={createForm.content}
                    onChange={e => setCreateForm({...createForm, content: e.target.value})}
                  />
                </div>
                <div className="flex gap-4 justify-end pt-4">
                   <button onClick={() => setIsCreating(false)} className="px-8 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">Cancel</button>
                   <button onClick={handleCreate} className="px-10 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">Save Template</button>
                </div>
              </div>
            </div>
          )}

          {/* List of Existing Templates */}
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
              <div className="p-10">
                {editingId === template.id ? (
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Template Name (Display Only)</label>
                      <input 
                        className="w-full bg-slate-50 rounded-xl px-5 py-3 text-xs font-black outline-none border-2 border-blue-100"
                        value={editForm.name}
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 block">Selection Rule (AI Prompt)</label>
                      <textarea 
                        className="w-full h-24 bg-blue-50/30 rounded-xl px-5 py-3 text-xs font-bold outline-none border-2 border-blue-100 resize-none"
                        value={editForm.rulePrompt}
                        onChange={e => setEditForm({...editForm, rulePrompt: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Body Content</label>
                      <textarea 
                        className="w-full h-80 bg-slate-50 rounded-2xl p-6 text-xs font-bold outline-none border-2 border-blue-100 resize-none leading-relaxed"
                        value={editForm.content}
                        onChange={e => setEditForm({...editForm, content: e.target.value})}
                      />
                    </div>
                    <div className="flex gap-4 justify-end">
                       <button onClick={() => setEditingId(null)} className="px-8 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">Discard</button>
                       <button onClick={handleSaveEdit} className="px-10 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/20">Commit Changes</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase">{template.id}</span>
                           <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Flow Result</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900">{template.name}</h3>
                      </div>
                      <button 
                        onClick={() => handleEdit(template)}
                        className="px-6 py-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        Edit Layout
                      </button>
                    </div>
                    
                    {/* Display Rule Prompt */}
                    <div className="mb-6">
                       <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                         AI Selection Rule
                       </div>
                       <div className="bg-blue-50/50 rounded-xl px-5 py-3 text-[11px] font-bold text-blue-800 border border-blue-100">
                         {template.rulePrompt || "No specific rule defined. AI will use its best judgment."}
                       </div>
                    </div>

                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Message Body Preview</div>
                    <div className="bg-slate-50/50 rounded-2xl p-8 text-sm font-medium text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-100">
                      {template.content}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {templates.length === 0 && !isCreating && (
            <div className="p-20 text-center flex flex-col items-center opacity-30 border-2 border-dashed border-slate-200 rounded-[48px]">
              <svg className="w-16 h-16 text-slate-200 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">No Custom Templates Found</p>
              <button onClick={() => setIsCreating(true)} className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Create Your First Template</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
