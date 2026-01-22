
import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, ShieldCheck, Send, User, Sparkles, Stethoscope, HeartPulse, ChevronRight, Lock, Trash2, Save, FileText, Users, ExternalLink, LogOut, ArrowLeftCircle, CheckCircle, MapPin, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { ChatMessage, Product, UserProfile } from '../types';
import { getHealthAdvice } from '../services/geminiService';
import { saveNurseMessage, deleteNurseMessage, getNurseMessages, getProducts, getAllUsers, createShopOrder } from '../services/storageService';
import Button from './Button';

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
  const [isEscalated, setIsEscalated] = useState(false);
  
  // Nurse Specific State
  const [savedMessages, setSavedMessages] = useState<ChatMessage[]>([]);
  const [patients, setPatients] = useState<UserProfile[]>([]);
  
  // Shop State
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderDate, setOrderDate] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number, accuracy: number} | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    const loadData = async () => {
        if (isNurseUser) {
            setSavedMessages(await getNurseMessages());
            setPatients(await getAllUsers());
        }
        // Load products
        setProducts(await getProducts());
    };

    loadData();
  }, [messages, activeTab, isNurseUser, isLoading]); // Added isLoading to dependencies

  const switchTab = (tab: 'ai' | 'nurse' | 'shop') => {
    setActiveTab(tab);
    if (tab === 'nurse' && !isNurseUser) {
        // If manually switching to nurse tab, ensure nurse bot greeting is present
        const hasNurseMsg = messages.some(m => m.role === 'nurse');
        if (!hasNurseMsg) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'nurse',
                text: "Virtual Private Nurse connected. I am here for your medical concerns. Please describe your symptoms clearly.",
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
      // Note: We use 'messages' from closure which doesn't have the new userMsg yet.
      const response = await getHealthAdvice(
        messages.map(m => ({ role: m.role, text: m.text })),
        userMsg.text,
        isNurseMode
      );

      // STRICT ESCALATION HANDLING
      if (response.isEscalated) {
          setIsEscalated(true);
          if (activeTab !== 'nurse') {
              setActiveTab('nurse');
          }
          
          // AUTO-SAVE FOR REAL NURSE
          // We save the user's triggering message so the nurse knows WHAT caused the alarm
          const emergencyLog: ChatMessage = {
              id: Date.now().toString() + '_alert',
              role: 'user', // Attributed to user for clarity in Nurse Log
              text: `[EMERGENCY TRIGGER] ${userMsg.text} \n\n[AI RESPONSE] ${response.text}`,
              timestamp: new Date(),
              isEscalated: true,
              isSaved: true
          };
          saveNurseMessage(emergencyLog).catch(console.error);
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
          text: "I'm having trouble connecting right now. If this is an emergency, please call 112 immediately.",
          timestamp: new Date()
      }]);
    }
  };

  // Nurse Actions
  const handleSaveMessage = async (msg: ChatMessage) => {
      await saveNurseMessage({ ...msg, isSaved: true });
      setSavedMessages(await getNurseMessages());
      alert("Message saved to records.");
  };

  const handleDeleteSavedMessage = async (id: string) => {
      await deleteNurseMessage(id);
      setSavedMessages(await getNurseMessages());
  };

  // Shop Actions
  const handleGetLocation = () => {
      if (!navigator.geolocation) {
          alert("Geolocation is not supported by your browser");
          return;
      }
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setDeliveryCoords({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy
              });
          },
          (err) => {
              alert("Unable to retrieve your location. Please ensure Location Services are enabled in your browser settings.");
          },
          { enableHighAccuracy: true }
      );
  };

  const handleShopOrder = async () => {
      if (!user || !selectedProduct) return;
      if (!deliveryCoords) {
          alert("Please capture your location for delivery.");
          return;
      }
      if (!orderDate) {
          alert("Please select a delivery date and time.");
          return;
      }

      // Check 3 Hour Rule
      const selectedTime = new Date(orderDate).getTime();
      const minTime = Date.now() + (3 * 60 * 60 * 1000); // 3 hours from now

      if (selectedTime < minTime) {
          alert("Invalid Time: Delivery must be scheduled at least 3 hours from now.");
          return;
      }

      await createShopOrder(selectedProduct, user, new Date(orderDate).toISOString(), deliveryCoords);
      alert(`Order Placed for ${selectedProduct.name}! Delivery scheduled.`);
      setSelectedProduct(null);
      setOrderDate('');
      setDeliveryCoords(null);
  };

  // Calculate Min DateTime string for input
  const getMinDateTime = () => {
      const d = new Date(Date.now() + (3 * 60 * 60 * 1000));
      // Format to YYYY-MM-DDTHH:mm
      return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
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
                                    <div className="overflow-hidden min-w-0">
                                        <div className="font-bold text-sm text-slate-900 truncate">{patient.name}</div>
                                        <div className="text-xs text-slate-500 truncate">{patient.email}</div>
                                    </div>
                                    <div className="text-[10px] text-purple-400 font-mono flex-shrink-0 ml-2">
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
                                        <p className="text-sm text-slate-700 mb-3 line-clamp-3 whitespace-pre-wrap">{msg.text}</p>
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
    <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans text-slate-800 relative">
      
      {/* CHECKOUT MODAL */}
      {selectedProduct && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <ShoppingBag className="text-rose-600"/> Secure Checkout
                  </h3>
                  
                  <div className="flex gap-4 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <img src={selectedProduct.image} className="w-16 h-16 object-cover rounded-lg bg-white" alt="product"/>
                      <div>
                          <div className="font-bold text-slate-900">{selectedProduct.name}</div>
                          <div className="text-sm text-slate-500">KES {selectedProduct.price}</div>
                      </div>
                  </div>

                  {/* Location Step */}
                  <div className="mb-6 space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 1: Delivery Location</div>
                      <p className="text-xs text-slate-500">To ensure discreet delivery, please pinpoint your exact location.</p>
                      
                      {!deliveryCoords ? (
                          <button 
                              onClick={handleGetLocation} 
                              className="w-full py-3 bg-white border border-rose-200 text-rose-600 font-bold rounded-lg hover:bg-rose-50 flex items-center justify-center gap-2 transition-colors"
                          >
                              <MapPin size={16}/> Auto-Detect Current Location
                          </button>
                      ) : (
                          <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                              <CheckCircle size={16} />
                              <div className="text-xs font-bold">Location Captured (Accuracy: {Math.round(deliveryCoords.accuracy)}m)</div>
                          </div>
                      )}
                  </div>

                  {/* Time Step */}
                  <div className="mb-6 space-y-3">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Step 2: Delivery Time</div>
                      <p className="text-xs text-slate-500">Select a time at least <span className="font-bold text-slate-700">3 hours from now</span>.</p>
                      <div className="relative">
                          <input 
                              type="datetime-local" 
                              min={getMinDateTime()}
                              value={orderDate}
                              onChange={(e) => setOrderDate(e.target.value)}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                          />
                          <Clock className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={16}/>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                      <button onClick={() => {setSelectedProduct(null); setDeliveryCoords(null); setOrderDate('');}} className="px-4 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                      <Button variant="wealth" onClick={handleShopOrder} disabled={!deliveryCoords || !orderDate}>Confirm Order</Button>
                  </div>
              </div>
          </div>
      )}

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
                <div className={`mx-auto max-w-lg border p-4 rounded-xl flex gap-4 items-center mb-8 ${isEscalated ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-100'}`}>
                    <div className={`p-3 rounded-full ${isEscalated ? 'bg-red-100 text-red-600' : 'bg-purple-200 text-purple-700'}`}>
                        {isEscalated ? <AlertTriangle size={24}/> : <HeartPulse size={24} />}
                    </div>
                    <div>
                        <h3 className={`font-bold text-sm ${isEscalated ? 'text-red-900' : 'text-purple-900'}`}>
                            {isEscalated ? 'EMERGENCY PROTOCOL ACTIVE' : 'Professional Triage Mode'}
                        </h3>
                        <p className={`text-xs mt-1 leading-relaxed ${isEscalated ? 'text-red-800' : 'text-purple-700/80'}`}>
                            {isEscalated 
                                ? 'Your chat has been flagged for severity. A record has been securely sent to our medical desk. Please ensure you are safe.' 
                                : 'You are speaking with a Virtual Nurse Agent. This data is processed securely for medical context.'}
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
                            onClick={() => { setSelectedProduct(product); setDeliveryCoords(null); setOrderDate(''); }}
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
