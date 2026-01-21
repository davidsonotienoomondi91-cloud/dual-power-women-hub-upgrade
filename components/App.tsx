
import React, { useState, useEffect } from 'react';
import HealthPortal from './HealthPortal';
import WealthPortal from './WealthPortal';
import LoginScreen from './LoginScreen';
import AdminDashboard from './AdminDashboard';
import { Segment, UserProfile, AppSettings, Transaction, SupportTicket } from '../types';
import { Heart, Briefcase, ArrowRight, LogOut, User, X, ShieldCheck, Mail, Phone, FileText, Wallet, Activity, Stethoscope, HelpCircle, MessageSquare, Plus, Upload } from 'lucide-react';
import { getSettings, getTransactions, getNurseMessages, getTickets, addTicket, uploadMedia, updateUserProfile } from '../services/storageService';
import Button from './Button';

const App: React.FC = () => {
  const [currentSegment, setCurrentSegment] = useState<Segment>(Segment.LOGIN);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ orgName: '', logoUrl: '' });

  // Profile Modal State
  const [showProfile, setShowProfile] = useState(false);
  const [stats, setStats] = useState({ earnings: 0, spending: 0, activeRentals: 0, nurseLogs: 0 });
  
  // Ticket State in Profile
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [newTicket, setNewTicket] = useState<{type: 'complaint' | 'help' | 'return', subject: string, message: string}>({
      type: 'help', subject: '', message: ''
  });

  // ID Upload State
  const [isUploadingId, setIsUploadingId] = useState(false);

  useEffect(() => {
    setSettings(getSettings());

    // Calculate General Profile Stats
    if (user) {
        const txs = getTransactions();
        const earnings = txs
            .filter(t => t.ownerId === user.id && t.status !== 'disputed' && t.status !== 'pending_approval')
            .reduce((sum, t) => sum + t.totalCost, 0);
        
        const spending = txs
            .filter(t => t.renterId === user.id)
            .reduce((sum, t) => sum + t.totalCost, 0);

        const activeRentals = txs.filter(t => t.renterId === user.id && (t.status === 'active' || t.status === 'in_transit')).length;
        
        const nurseLogsCount = getNurseMessages().length;

        setStats({ earnings, spending, activeRentals, nurseLogs: nurseLogsCount });
        setMyTickets(getTickets().filter(t => t.userId === user.id));
    }
  }, [currentSegment, user, showProfile]);

  const handleLogin = (loggedInUser: UserProfile) => {
      setUser(loggedInUser);
      if (loggedInUser.role === 'admin') {
          setCurrentSegment(Segment.ADMIN);
      } else if (loggedInUser.role === 'nurse') {
          setCurrentSegment(Segment.HEALTH);
      } else {
          setCurrentSegment(Segment.LANDING);
      }
  };

  const handleUpdateUser = (updatedUser: UserProfile) => {
    setUser(updatedUser);
  };

  const handleLogout = () => {
      setUser(null);
      setCurrentSegment(Segment.LOGIN);
      setShowProfile(false);
  };

  // Switch contexts
  const handleSwitchToUserView = () => {
      setCurrentSegment(Segment.LANDING);
  };

  const handleSwitchToAdminPanel = () => {
      setCurrentSegment(Segment.ADMIN);
  };

  const handleSwitchToNursePanel = () => {
      setCurrentSegment(Segment.HEALTH);
  };

  const handleImpersonateUser = (targetUser: UserProfile) => {
      setUser(targetUser);
      setCurrentSegment(Segment.LANDING);
  };

  const handleUploadId = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file || !user) return;
      
      setIsUploadingId(true);
      const url = await uploadMedia(file);
      const updated = { ...user, idDocumentUrl: url, verified: true };
      updateUserProfile(updated);
      setUser(updated);
      setIsUploadingId(false);
      alert("ID Uploaded. Verification Pending.");
  };

  const handleSubmitTicket = () => {
      if(!user || !newTicket.subject || !newTicket.message) return;
      
      addTicket({
          id: Date.now().toString(),
          userId: user.id,
          userName: user.name,
          type: newTicket.type,
          subject: newTicket.subject,
          message: newTicket.message,
          status: 'pending',
          createdAt: new Date().toISOString()
      });
      
      setNewTicket({ type: 'help', subject: '', message: '' });
      setShowTicketForm(false);
      setMyTickets(getTickets().filter(t => t.userId === user.id));
      alert("Ticket Submitted Successfully.");
  };

  const ExitButton = () => (
    <button 
      onClick={() => setCurrentSegment(Segment.LANDING)}
      className="fixed top-4 right-4 z-50 bg-white/90 backdrop-blur text-gray-800 px-4 py-2 rounded-full shadow-sm hover:shadow-md hover:bg-white text-xs font-semibold tracking-wide transition-all border border-gray-200 flex items-center gap-2"
    >
      <ArrowRight size={14} className="rotate-180" /> EXIT PORTAL
    </button>
  );

  const BrandHeader = () => (
      <div className="absolute top-4 md:top-6 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
        <div className="bg-white/90 backdrop-blur-md border border-white/20 px-6 py-2 md:px-8 md:py-3 rounded-full shadow-xl flex items-center gap-3 max-w-full">
          {settings.logoUrl && (
             <img src={settings.logoUrl} alt="Logo" className="h-5 md:h-6 w-auto" />
          )}
          <h1 className="text-sm md:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-indigo-900 tracking-tight truncate">
             {settings.orgName || "DUAL POWER WOMEN HUB"}
          </h1>
        </div>
      </div>
  );

  if (currentSegment === Segment.LOGIN) {
      return <LoginScreen onLogin={handleLogin} logoUrl={settings.logoUrl} />;
  }

  // CORRECTED: Pass required props to AdminDashboard
  if (currentSegment === Segment.ADMIN && user?.role === 'admin') {
      return (
        <AdminDashboard 
            user={user} 
            onLogout={handleLogout} 
            onSwitchToUser={handleSwitchToUserView} 
            onImpersonate={handleImpersonateUser} 
        />
      );
  }

  if (currentSegment === Segment.HEALTH) {
    return (
      <div className="relative animate-in fade-in duration-300">
        {user?.role !== 'nurse' && <ExitButton />}
        <HealthPortal user={user || undefined} onSwitchToUser={handleSwitchToUserView} />
      </div>
    );
  }

  if (currentSegment === Segment.WEALTH && user) {
    return (
      <div className="relative animate-in fade-in duration-300">
        <ExitButton />
        <WealthPortal 
            user={user} 
            onUpdateUser={handleUpdateUser} 
            onSwitchToAdmin={handleSwitchToAdminPanel} 
            onSwitchToNurse={handleSwitchToNursePanel}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans overflow-hidden relative">
      
      <BrandHeader />

      {/* Top Right Controls */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-3">
        {user && (
            <button 
                onClick={() => setShowProfile(true)}
                className="bg-white text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-full shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 transition-transform hover:scale-105"
            >
                <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700">
                    <User size={12} />
                </div>
                MY PROFILE
            </button>
        )}
        <button 
            onClick={handleLogout}
            className="bg-slate-900/90 text-white hover:bg-slate-800 p-2 md:px-4 md:py-2 rounded-full shadow-lg backdrop-blur border border-slate-700 text-xs font-bold flex items-center gap-2"
            title="Logout"
        >
            <LogOut size={14} /> <span className="hidden md:inline">LOGOUT</span>
        </button>
      </div>

      {/* GENERAL PROFILE MODAL */}
      {showProfile && user && (
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                  {/* Header */}
                  <div className="bg-slate-900 text-white p-6 sticky top-0 z-10 flex justify-between items-start">
                      <div>
                          <h2 className="text-2xl font-bold flex items-center gap-2">General Profile Record <ShieldCheck className="text-emerald-400" size={24}/></h2>
                          <p className="text-slate-400 text-sm mt-1">Unified data across Health & Wealth segments.</p>
                      </div>
                      <button onClick={() => setShowProfile(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 text-white"><X size={20}/></button>
                  </div>
                  
                  <div className="p-6 space-y-8">
                      {/* Section 1: Identity */}
                      <section className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><User size={16}/> Identity & Role</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                  <div className="text-xs text-slate-400">Full Name</div>
                                  <div className="font-bold text-lg text-slate-900">{user.name}</div>
                              </div>
                              <div>
                                  <div className="text-xs text-slate-400">Role</div>
                                  <div className="font-bold text-lg text-slate-900 capitalize flex items-center gap-2">
                                      {user.role} 
                                      {user.role === 'admin' && <ShieldCheck size={16} className="text-amber-500"/>}
                                      {user.role === 'nurse' && <Stethoscope size={16} className="text-purple-500"/>}
                                  </div>
                              </div>
                              <div>
                                  <div className="text-xs text-slate-400">Contact Email</div>
                                  <div className="font-medium text-slate-700 flex items-center gap-2"><Mail size={12}/> {user.email}</div>
                              </div>
                              <div>
                                  <div className="text-xs text-slate-400">Phone</div>
                                  <div className="font-medium text-slate-700 flex items-center gap-2"><Phone size={12}/> {user.phone}</div>
                              </div>
                              <div className="md:col-span-2 border-t border-slate-200 pt-4 mt-2">
                                  <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                      <div>
                                          <div className="text-xs text-slate-400">Verification Status</div>
                                          <div className={`font-bold text-sm ${user.verified ? 'text-emerald-600' : 'text-amber-600'}`}>
                                              {user.verified ? 'Verified Citizen (KYC Passed)' : 'Pending Verification'}
                                          </div>
                                      </div>
                                      {user.idDocumentUrl ? (
                                          <a href={user.idDocumentUrl} target="_blank" rel="noreferrer" className="text-xs bg-slate-200 px-3 py-1 rounded-full text-slate-600 hover:bg-slate-300 font-bold flex items-center gap-1">
                                              <FileText size={12}/> View ID Doc
                                          </a>
                                      ) : (
                                          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all">
                                              {isUploadingId ? <span className="animate-spin">⌛</span> : <Upload size={14}/>} 
                                              Upload National ID
                                              <input type="file" onChange={handleUploadId} className="hidden" accept="image/*"/>
                                          </label>
                                      )}
                                  </div>
                              </div>
                          </div>
                      </section>
                      
                      {/* Section 4: Support & Tickets */}
                      <section className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                           <div className="flex justify-between items-center mb-4">
                                <h3 className="text-sm font-bold text-blue-800 uppercase tracking-widest flex items-center gap-2"><HelpCircle size={16}/> Support & Claims</h3>
                                {!showTicketForm && (
                                    <button onClick={() => setShowTicketForm(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 flex items-center gap-1">
                                        <Plus size={12}/> New Ticket
                                    </button>
                                )}
                           </div>

                           {showTicketForm ? (
                               <div className="bg-white p-4 rounded-lg border border-blue-200 space-y-3">
                                   <div className="flex justify-between">
                                       <h4 className="font-bold text-sm">New Request</h4>
                                       <button onClick={() => setShowTicketForm(false)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                                   </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                                        <select className="w-full border p-2 rounded text-sm" value={newTicket.type} onChange={e => setNewTicket({...newTicket, type: e.target.value as any})}>
                                            <option value="help">General Help</option>
                                            <option value="complaint">Complaint</option>
                                            <option value="return">Return Request</option>
                                        </select>
                                    </div>
                                    <div>
                                        <input className="w-full border p-2 rounded text-sm" placeholder="Subject" value={newTicket.subject} onChange={e => setNewTicket({...newTicket, subject: e.target.value})}/>
                                    </div>
                                    <div>
                                        <textarea className="w-full border p-2 rounded text-sm" rows={2} placeholder="Message..." value={newTicket.message} onChange={e => setNewTicket({...newTicket, message: e.target.value})}></textarea>
                                    </div>
                                    <Button variant="primary" size="sm" onClick={handleSubmitTicket} className="w-full bg-blue-600">Submit</Button>
                               </div>
                           ) : (
                               <div className="space-y-2">
                                   {myTickets.length === 0 ? <p className="text-xs text-slate-400 italic">No tickets found.</p> : myTickets.map(t => (
                                       <div key={t.id} className="bg-white p-3 rounded border border-blue-100">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-bold text-slate-700">{t.subject}</span>
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${t.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                                            </div>
                                            <p className="text-xs text-slate-500">{t.message}</p>
                                            {t.adminReply && (
                                                <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-green-700 flex gap-1 bg-green-50 p-2 rounded">
                                                    <MessageSquare size={12} className="mt-0.5"/> <span className="font-bold">Reply:</span> {t.adminReply}
                                                </div>
                                            )}
                                       </div>
                                   ))}
                               </div>
                           )}
                      </section>

                      {/* Section 2: Wealth Record */}
                      <section className="bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                          <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Wallet size={16}/> Wealth & Business Record</h3>
                          <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                  <div className="text-2xl font-black text-indigo-900">KES {stats.earnings.toLocaleString()}</div>
                                  <div className="text-[10px] font-bold text-indigo-400 uppercase">Total Earnings</div>
                              </div>
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                  <div className="text-2xl font-black text-slate-700">KES {stats.spending.toLocaleString()}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Spent</div>
                              </div>
                              <div className="bg-white p-3 rounded-lg shadow-sm">
                                  <div className="text-2xl font-black text-amber-600">{stats.activeRentals}</div>
                                  <div className="text-[10px] font-bold text-amber-400 uppercase">Active Rentals</div>
                              </div>
                          </div>
                      </section>

                      {/* Section 3: Health Status */}
                      <section className="bg-rose-50 p-5 rounded-xl border border-rose-100">
                          <h3 className="text-sm font-bold text-rose-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Activity size={16}/> Health & Privacy Status</h3>
                          <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-rose-100 shadow-sm">
                              <div className="bg-rose-100 p-3 rounded-full text-rose-600"><ShieldCheck size={24}/></div>
                              <div className="flex-1">
                                  <div className="font-bold text-slate-900">Privacy-First Mode Active</div>
                                  <div className="text-xs text-slate-500">Your health interactions are anonymized by default.</div>
                              </div>
                              {user.role === 'nurse' && (
                                  <div className="text-right">
                                      <div className="font-black text-xl text-purple-700">{stats.nurseLogs}</div>
                                      <div className="text-[10px] text-purple-400 uppercase font-bold">Logs Saved</div>
                                  </div>
                              )}
                          </div>
                      </section>
                  </div>
                  
                  <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                      <button onClick={() => setShowProfile(false)} className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800">Close Profile</button>
                  </div>
              </div>
          </div>
      )}

      {/* LEFT PANEL: HEALTH (Scrollable/Flexible) */}
      <div 
        onClick={() => setCurrentSegment(Segment.HEALTH)}
        className="flex-1 min-h-[50vh] md:h-auto relative group cursor-pointer overflow-hidden transition-all duration-700 ease-in-out hover:flex-[1.5] border-b md:border-b-0 md:border-r border-white/20"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-rose-100 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-10 grayscale group-hover:grayscale-0 group-hover:opacity-20 transition-all duration-700"></div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 md:p-12 text-center">
          <div className="bg-white p-4 md:p-6 rounded-3xl shadow-2xl mb-6 md:mb-8 group-hover:scale-110 transition-transform duration-500 ring-4 ring-rose-50">
            <Heart className="w-8 h-8 md:w-12 md:h-12 text-rose-500" fill="currentColor" />
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-rose-900 mb-2 md:mb-4 tracking-tight">HEALTH</h2>
          <p className="text-rose-800/80 text-sm md:text-lg max-w-xs md:max-w-sm font-medium leading-relaxed">
            Privacy-first wellness. Anonymous AI consultations and discreet care for women.
          </p>
          
          <div className="mt-6 md:mt-10 md:opacity-0 transform translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-500">
            <span className="inline-flex items-center gap-2 bg-rose-600 text-white px-6 py-2 md:px-8 md:py-3 rounded-full font-bold shadow-lg hover:bg-rose-700 transition-colors text-sm md:text-base">
              Enter Privacy Hub <ArrowRight size={18} />
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: WEALTH (Scrollable/Flexible) */}
      <div 
        onClick={() => setCurrentSegment(Segment.WEALTH)}
        className="flex-1 min-h-[50vh] md:h-auto relative group cursor-pointer overflow-hidden transition-all duration-700 ease-in-out hover:flex-[1.5]"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950 z-0"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-20 group-hover:opacity-30 transition-all duration-700"></div>

        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 md:p-12 text-center">
          <div className="bg-amber-400 p-4 md:p-6 rounded-3xl shadow-2xl mb-6 md:mb-8 group-hover:scale-110 transition-transform duration-500 ring-4 ring-indigo-900/50">
            <Briefcase className="w-8 h-8 md:w-12 md:h-12 text-indigo-900" strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white mb-2 md:mb-4 tracking-tight">WEALTH</h2>
          <p className="text-indigo-200 text-sm md:text-lg max-w-xs md:max-w-sm font-medium leading-relaxed">
            Empowering entrepreneurship. Rent assets, manage income, and scale your business.
          </p>
          
          <div className="mt-6 md:mt-10 md:opacity-0 transform translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-500">
             <span className="inline-flex items-center gap-2 bg-amber-400 text-indigo-950 px-6 py-2 md:px-8 md:py-3 rounded-full font-bold shadow-lg hover:bg-amber-300 transition-colors text-sm md:text-base">
              Enter Business Hub <ArrowRight size={18} />
            </span>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default App;
