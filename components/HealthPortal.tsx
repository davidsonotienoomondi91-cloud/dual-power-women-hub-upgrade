
import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, ShieldCheck, Send, User, Sparkles, Stethoscope, HeartPulse, ChevronRight, Lock, Trash2, Save, FileText, Users, ExternalLink, LogOut, ArrowLeftCircle } from 'lucide-react';
import { ChatMessage, Product, UserProfile } from '../types';
import { getHealthAdvice } from '../services/geminiService';
import { saveNurseMessage, deleteNurseMessage, getNurseMessages, getProducts, getAllUsers } from '../services/storageService';

interface HealthPortalProps {
    user?: UserProfile;
    onSwitchToUser?: () => void;
}

const HealthPortal: React.FC<HealthPortalProps> = ({ user, onSwitchToUser }) => {
  const isNurseUser = user?.role === 'nurse';
  
  const [activeTab, setActiveTab] = useState<'ai' | 'nurse' | 'shop'>('ai');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'model', text: 'Hello. I am your wellness assistant. I am here to listen and help safely.', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Nurse Specific State
  const [savedMessages, setSavedMessages] = useState<ChatMessage[]>([]);
  const [patients, setPatients] = useState<UserProfile[]>([]);
  
  // Shop State
  const [products, setProducts] = useState<Product[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (isNurseUser) {
        setSavedMessages(getNurseMessages());
        setPatients(getAllUsers());
    }
    // Load products
    setProducts(getProducts());
  }, [messages, activeTab, isNurseUser]);

  const switchTab = (tab: 'ai' | 'nurse' | 'shop') => {
    setActiveTab(tab);
    if (tab === 'nurse' && !isNurseUser) {
        const hasNurseMsg = messages.some(m => m.role === 'nurse');
        if (!hasNurseMsg) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'nurse',
                text: "Virtual Private Nurse connected. I am here for your medical concerns. Please describe your symptoms.",
                timestamp: new Date()
             }]);
        }
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const isNurseMode = activeTab === 'nurse';
      const response = await getHealthAdvice(
        messages.map(m => ({ role: m.role, text: m.text })),
        userMsg.text,
        isNurseMode
      );

      if (response.isEscalated && activeTab !== 'nurse') {
        setActiveTab('nurse');
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: response.isEscalated || isNurseMode ? 'nurse' : 'model',
        text: response.text,
        timestamp: new Date(),
        isEscalated: response.isEscalated
      }]);

      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'model',
          text: "I'm having trouble connecting right now. Please try again.",
          timestamp: new Date()
      }]);
    }
  };

  // Nurse Actions
  const handleSaveMessage = (msg: ChatMessage) => {
      saveNurseMessage({ ...msg, isSaved: true });
      setSavedMessages(getNurseMessages());
      alert("Message saved to records.");
  };

  const handleDeleteSavedMessage = (id: string) => {
      deleteNurseMessage(id);
      setSavedMessages(getNurseMessages());
  };

  // --------------------------------------------------------------------------
  // NURSE DASHBOARD VIEW
  // --------------------------------------------------------------------------
  if (isNurseUser) {
      return (
        <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans text-slate-900">
             <header className="bg-purple-900 text-white px-4 md:px-6 py-4 sticky top-0 z-20 shadow-lg flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Stethoscope />
                    <h1 className="font-bold text-lg hidden md:block">Nurse Portal</h1>
                </div>
                <div className="flex items-center gap-4">
                    {/* SWITCH TO PERSONAL VIEW BUTTON - NEAR LOGOUT */}
                    <button 
                        onClick={onSwitchToUser}
                        className="flex items-center gap-2 bg-white text-purple-900 hover:bg-purple-100 px-3 py-2 rounded-lg text-xs font-bold transition-all border border-purple-200 shadow-md"
                        title="Switch to Personal"
                    >
                        <User size={14} /> <span className="hidden md:inline">Switch to Personal View</span>
                    </button>
                    <div className="text-xs font-mono bg-purple-800 px-3 py-1 rounded hidden md:block">
                        Licensed Personnel Only
                    </div>
                </div>
            </header>
            
            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Column 1: Patient Directory */}
                    <div className="bg-white rounded-xl shadow p-4 md:p-6 lg:col-span-1 border border-slate-200 h-fit">
                        <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                            <Users className="text-purple-600" /> Patient Directory
                        </h2>
                        <div className="space-y-2 max-h-[300px] md:max-h-[500px] overflow-y-auto pr-2">
                            {patients.filter(p => p.role === 'user').map(patient => (
                                <div key={patient.id} className="p-3 border border-slate-100 rounded-lg bg-slate-50 flex items-center justify-between group">
                                    <div className="overflow-hidden">
                                        <div className="font-bold text-sm text-slate-900 truncate">{patient.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{patient.email}</div>
                                    </div>
                                    <div className="text-[10px] text-purple-400 font-mono">
                                        {patient.verified ? 'Verified' : 'Unverified'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column 2: Live Triage Simulator */}
                    <div className="bg-white rounded-xl shadow p-4 md:p-6 lg:col-span-1 border border-slate-200">
                        <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                            <HeartPulse className="text-rose-500" /> Live Triage Simulator
                        </h2>
                        <div className="h-[400px] border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                             <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" ref={scrollRef}>
                                 {messages.map(msg => (
                                     <div key={msg.id} className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-slate-200 ml-auto max-w-[90%] text-slate-900' : 'bg-white border border-slate-200 mr-auto max-w-[90%] text-slate-800'}`}>
                                         <div className="text-[10px] font-bold uppercase mb-1 opacity-50">{msg.role}</div>
                                         {msg.text}
                                         <div className="mt-2 pt-2 border-t border-black/5 flex justify-end">
                                             <button onClick={() => handleSaveMessage(msg)} className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1">
                                                 <Save size={12} /> Save
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                                 {isLoading && <div className="text-xs text-slate-400 italic">Typing...</div>}
                             </div>
                             <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
                                 <input 
                                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm text-slate-900" 
                                    placeholder="Simulate user input..."
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                 <button onClick={handleSend} className="bg-purple-900 text-white px-4 rounded hover:bg-purple-800">
                                     <Send size={16} />
                                 </button>
                             </div>
                        </div>
                    </div>

                    {/* Column 3: Saved Records */}
                    <div className="bg-white rounded-xl shadow p-4 md:p-6 lg:col-span-1 border border-slate-200">
                        <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                            <FileText className="text-indigo-500" /> Saved Records
                        </h2>
                        {savedMessages.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <p>No saved messages.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 h-[400px] overflow-y-auto pr-2">
                                {savedMessages.map(msg => (
                                    <div key={msg.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 group bg-slate-50/50">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${msg.role === 'user' ? 'bg-slate-200 text-slate-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {msg.role}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-700 mb-3 line-clamp-3">{msg.text}</p>
                                        <div className="flex justify-end">
                                            <button 
                                                onClick={() => handleDeleteSavedMessage(msg.id)}
                                                className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} /> Delete Record
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
      );
  }

  // --------------------------------------------------------------------------
  // REGULAR USER VIEW (Mobile Optimized)
  // --------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans text-slate-800">
      
      {/* Professional Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-20 shadow-sm flex justify-between items-center">
        <div>
           <div className="flex items-center gap-2 text-rose-600">
            <div className="bg-rose-100 p-1.5 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-900">Health Portal</h1>
          </div>
          <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 ml-9">End-to-End Encrypted & Anonymous</p>
        </div>
        
        <div className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-xs font-semibold">Secure Connection</span>
        </div>
      </header>

      {/* Segmented Control Navigation */}
      <div className="bg-white border-b border-slate-100 p-2 md:p-3">
        <div className="max-w-xl mx-auto bg-slate-100 p-1 rounded-xl flex shadow-inner">
          <button
            onClick={() => switchTab('ai')}
            className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-1 md:gap-2 ${
                activeTab === 'ai' 
                ? 'bg-white text-rose-600 shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={14} /> Wellness
          </button>
          
          <button
            onClick={() => switchTab('nurse')}
            className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-1 md:gap-2 ${
                activeTab === 'nurse' 
                ? 'bg-white text-purple-700 shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Stethoscope size={14} /> Triage
          </button>
          
          <button
            onClick={() => switchTab('shop')}
            className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center justify-center gap-1 md:gap-2 ${
                activeTab === 'shop' 
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShoppingBag size={14} /> Shop
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full" ref={scrollRef}>
        
        {/* Chat UI */}
        {(activeTab === 'ai' || activeTab === 'nurse') && (
          <div className="space-y-6 pb-24">
            
            {activeTab === 'nurse' && (
                <div className="mx-auto max-w-lg bg-purple-50 border border-purple-100 p-4 rounded-xl flex gap-4 items-center mb-8">
                    <div className="bg-purple-200 p-3 rounded-full text-purple-700">
                        <HeartPulse size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-purple-900 text-sm">Professional Triage Mode</h3>
                        <p className="text-purple-700/80 text-xs mt-1 leading-relaxed">
                            You are speaking with a Virtual Nurse Agent. This data is processed securely for medical context.
                        </p>
                    </div>
                </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] md:max-w-[70%] flex gap-2 md:gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        msg.role === 'user' ? 'bg-slate-200 text-slate-500' 
                        : msg.role === 'nurse' ? 'bg-purple-100 text-purple-600'
                        : 'bg-rose-100 text-rose-500'
                    }`}>
                        {msg.role === 'user' && <User size={14} />}
                        {msg.role === 'nurse' && <Stethoscope size={14} />}
                        {msg.role === 'model' && <Sparkles size={14} />}
                    </div>

                    {/* Bubble */}
                    <div className={`p-3 md:p-4 shadow-sm text-sm leading-relaxed ${
                        msg.role === 'user' 
                        ? 'bg-slate-900 text-white rounded-2xl rounded-tr-sm' 
                        : msg.role === 'nurse'
                            ? 'bg-white border border-purple-100 text-slate-800 rounded-2xl rounded-tl-sm'
                            : 'bg-white border border-slate-100 text-slate-800 rounded-2xl rounded-tl-sm'
                    }`}>
                         {/* Name Tag */}
                         {msg.role !== 'user' && (
                             <div className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${
                                 msg.role === 'nurse' ? 'text-purple-600' : 'text-rose-500'
                             }`}>
                                 {msg.role === 'nurse' ? 'Senior Nurse Bot' : 'Wellness Assistant'}
                             </div>
                         )}
                         <p>{msg.text}</p>
                    </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
               <div className="flex w-full justify-start pl-11">
                  <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                     <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                  </div>
               </div>
            )}
          </div>
        )}

        {/* Shop UI */}
        {activeTab === 'shop' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-rose-50 rounded-2xl p-6 mb-8 text-center border border-rose-100">
                 <h2 className="text-xl font-bold text-rose-900 mb-2">Discrete Essentials Store</h2>
                 <p className="text-sm text-rose-700 max-w-md mx-auto">
                    Professional grade hygiene products delivered in plain, unmarked packaging to ensure your privacy.
                 </p>
            </div>
            
            {products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <ShoppingBag className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-lg font-bold text-slate-600">Store Empty</h3>
                    <p className="text-slate-500 text-sm">Please check back later for stock updates.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                {products.map(product => (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-lg transition-all group overflow-hidden">
                    <div className="aspect-square bg-slate-50 relative p-6 flex items-center justify-center">
                       <img src={product.image} alt={product.name} className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300 shadow-sm" />
                       {product.stock < 10 && (
                           <span className="absolute top-2 right-2 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">
                               Low: {product.stock}
                           </span>
                       )}
                    </div>
                    <div className="p-3 md:p-4">
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">{product.category}</div>
                      <h3 className="font-semibold text-slate-900 truncate text-sm mb-2">{product.name}</h3>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-slate-900 text-sm">KES {product.price}</span>
                        <button 
                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors ${
                                product.stock > 0 ? 'bg-slate-900 text-white hover:bg-rose-600' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                            disabled={product.stock === 0}
                        >
                          <ShoppingBag size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      {activeTab !== 'shop' && (
        <div className="bg-white border-t border-slate-200 p-3 md:p-4 sticky bottom-0 z-10">
          <div className="max-w-4xl mx-auto flex gap-2 md:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={activeTab === 'nurse' ? "Describe symptoms..." : "Ask anonymously..."}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-900 transition-all text-slate-900 placeholder:text-slate-400 text-sm md:text-base"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`text-white rounded-xl px-4 md:px-5 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${
                  activeTab === 'nurse' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="max-w-4xl mx-auto text-center mt-2">
              <span className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                  <Lock size={8} /> Private Chat
              </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthPortal;
