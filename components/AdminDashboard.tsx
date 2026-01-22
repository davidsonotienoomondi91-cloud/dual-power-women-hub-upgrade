
import React, { useState, useEffect } from 'react';
import { getTransactions, saveSettings, getSettings, uploadMedia, updateAssetStatus, getAllUsers, updateUserStatus, updateTransactionStatus, getNurseMessages, deleteNurseMessage, getProducts, saveProduct, updateAsset, updateUserRole, deleteAsset, getTickets, updateTicket, getAssets, deleteProduct, getReferralRewards, markReferralPaid } from '../services/storageService';
import { editAssetImage, getSystemDiagnostics } from '../services/geminiService';
import { Transaction, AppSettings, Asset, UserProfile, ChatMessage, Product, SupportTicket, ReferralReward } from '../types';
import { LayoutDashboard, ShoppingCart, Users, Activity, MessageSquare, Settings, LogOut, Menu, Truck, CheckCircle, XCircle, AlertCircle, DollarSign, Edit3, Trash2, Info, RefreshCw, PackageCheck, FileText, MapPin, ExternalLink, Key, Plus, ShoppingBag, Wand2, Loader2, Shield, UserX, UserCheck, Server, Wifi, Cpu, Play, Link, CreditCard } from 'lucide-react';
import Button from './Button';

interface AdminDashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onSwitchToUser?: () => void;
  onImpersonate?: (user: UserProfile) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onSwitchToUser, onImpersonate }) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'users' | 'referrals' | 'health' | 'support' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [usersData, setUsersData] = useState<UserProfile[]>([]);
  const [nurseLogs, setNurseLogs] = useState<ChatMessage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [referralRewards, setReferralRewards] = useState<ReferralReward[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ orgName: '', logoUrl: '', geminiApiKey: '' });

  // AI Diagnostics State
  const [aiHealth, setAiHealth] = useState<{ status: 'online'|'offline', latency: number, keyType: string }>({ status: 'offline', latency: 0, keyType: 'unknown' });
  const [isTestingKey, setIsTestingKey] = useState(false);

  // Modal & Form States
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  
  // Product Shop State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Partial<Product>>({ name: '', price: 0, stock: 0, category: 'hygiene', image: '' });
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isEnhancingImage, setIsEnhancingImage] = useState(false);

  // Ticket Reply State
  const [replyText, setReplyText] = useState('');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Filters
  const [orderFilter, setOrderFilter] = useState('all');
  const [inventoryFilter, setInventoryFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
        setTransactions(await getTransactions());
        setAssets(await getAssets());
        setUsersData(await getAllUsers());
        setNurseLogs(await getNurseMessages());
        setProducts(await getProducts());
        setTickets(await getTickets());
        setReferralRewards(await getReferralRewards());
        setSettings(await getSettings());
        
        // Run Diagnostics quietly
        getSystemDiagnostics().then(res => setAiHealth({ status: res.status, latency: res.latency, keyType: res.keyType }));
    } catch (e) {
        console.error("Failed to load admin data", e);
    }
    setIsLoading(false);
  };

  const handleRefresh = () => {
      loadData();
  };

  // --- REFERRAL ACTIONS ---
  const handleMarkRewardPaid = async (rewardId: string) => {
      if(confirm("Confirm: You have manually sent KES 10 to this user via MPESA?")) {
          await markReferralPaid(rewardId);
          loadData();
      }
  };

  // --- LOGISTICS ACTIONS ---
  const handleOrderStatusChange = async (txId: string, newStatus: Transaction['status']) => {
      await updateTransactionStatus(txId, newStatus);
      loadData();
      alert(`Order updated to: ${newStatus.toUpperCase().replace('_', ' ')}`);
  };

  // --- ASSET ACTIONS ---
  const handleAssetApproval = async (id: string, status: 'approved' | 'rejected') => {
      if (status === 'rejected') {
          setSelectedAssetId(id);
          setRejectReason('');
          setIsRejectModalOpen(true);
      } else {
          await updateAssetStatus(id, 'approved');
          loadData();
      }
  };

  const confirmReject = async () => {
      if (selectedAssetId) {
          await updateAssetStatus(selectedAssetId, 'rejected', rejectReason);
          setIsRejectModalOpen(false);
          loadData();
      }
  };

  const saveAssetChanges = async () => {
      if (editingAsset) {
          await updateAsset(editingAsset);
          setEditingAsset(null);
          loadData();
      }
  };

  // --- PRODUCT / SHOP ACTIONS ---
  const handleAddProduct = () => {
    setProductForm({ name: '', price: 0, stock: 0, category: 'hygiene', image: '' });
    setProductImageFile(null);
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (p: Product) => {
    setProductForm(p);
    setProductImageFile(null);
    setEditingProduct(p);
    setIsProductModalOpen(true);
  };

  // Helper to convert Base64 string back to File object for uploading
  const base64ToFile = (dataurl: string, filename: string): File => {
      const arr = dataurl.split(',');
      const match = arr[0].match(/:(.*?);/);
      const mime = match ? match[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while(n--){
          u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, {type:mime});
  };

  const handleAIEnhanceProductImage = async () => {
      if (!productImageFile && !productForm.image) {
          alert("Please select an image first.");
          return;
      }
      
      setIsEnhancingImage(true);
      try {
          // 1. Get Base64 of current image
          let base64 = "";
          if (productImageFile) {
              base64 = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.readAsDataURL(productImageFile);
              });
          } else if (productForm.image?.startsWith('data:')) {
              base64 = productForm.image;
          } else {
              alert("Cannot enhance remote URL images directly. Please upload a file.");
              setIsEnhancingImage(false);
              return;
          }

          // 2. Call Gemini
          const enhancedBase64 = await editAssetImage(
              base64.split(',')[1], // remove header
              "Remove the background and place the product on a clean, pure white studio background. High quality commercial photography style."
          );

          if (enhancedBase64) {
              const fullBase64 = `data:image/png;base64,${enhancedBase64}`;
              // 3. Update Preview
              setProductForm(prev => ({ ...prev, image: fullBase64 }));
              // 4. Update File State so it uploads the NEW image on save
              setProductImageFile(base64ToFile(fullBase64, "enhanced_product.png"));
          } else {
              alert("AI Enhancement failed. Please try again.");
          }
      } catch (e) {
          console.error(e);
          alert("Error connecting to AI Studio.");
      }
      setIsEnhancingImage(false);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price) {
        alert("Please enter product name and price");
        return;
    }
    setIsSavingProduct(true);
    
    let imageUrl = productForm.image || '';
    if (productImageFile) {
        imageUrl = await uploadMedia(productImageFile);
    }

    const productToSave: Product = {
        id: editingProduct ? editingProduct.id : Date.now().toString(),
        name: productForm.name!,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        category: productForm.category as 'hygiene' | 'wellness',
        image: imageUrl || 'https://via.placeholder.com/150'
    };

    await saveProduct(productToSave);
    setIsProductModalOpen(false);
    loadData();
    setIsSavingProduct(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if(confirm("Are you sure you want to remove this product from the shop?")) {
        await deleteProduct(id);
        loadData();
    }
  };

  // --- TICKET ACTIONS ---
  const handleReplyTicket = async (ticketId: string) => {
      if (!replyText) return;
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket) {
          await updateTicket({ ...ticket, adminReply: replyText, status: 'resolved' });
          setReplyText('');
          setActiveTicketId(null);
          loadData();
      }
  };

  // --- USER ACTIONS ---
  const changeUserRole = async (userId: string, role: string) => {
      if(window.confirm(`Change user role to ${role}?`)) {
          await updateUserRole(userId, role as any);
          loadData();
      }
  };

  const handleUserStatusChange = async (userId: string, newStatus: 'approved' | 'rejected') => {
      const action = newStatus === 'approved' ? 'APPROVE' : 'SUSPEND';
      if (confirm(`Are you sure you want to ${action} this user?`)) {
          await updateUserStatus(userId, newStatus);
          loadData();
      }
  };

  // --- SETTINGS ---
  const handleSaveSettings = async () => {
      setIsSavingSettings(true);
      let url = settings.logoUrl;
      if (logoFile) {
          url = await uploadMedia(logoFile);
      }
      await saveSettings({ ...settings, logoUrl: url });
      loadData();
      setIsSavingSettings(false);
      alert("Settings Saved. Restart to apply API key changes.");
  };

  const handleTestKey = async () => {
      setIsTestingKey(true);
      // Temporarily save to test, or just use current
      await saveSettings(settings); // Save first to ensure getSystemDiagnostics uses it
      const diag = await getSystemDiagnostics();
      setAiHealth({ status: diag.status, latency: diag.latency, keyType: diag.keyType });
      alert(`Diagnostic Result:\nStatus: ${diag.status.toUpperCase()}\nLatency: ${diag.latency}ms\nKey Mode: ${diag.keyType.toUpperCase()}`);
      setIsTestingKey(false);
  };

  const StatusBadge = ({ status }: { status?: string }) => {
      if (!status) return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">UNKNOWN</span>;
      
      const styles: Record<string, string> = {
          approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          delivered: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          pending: 'bg-amber-100 text-amber-800 border-amber-200',
          pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
          in_transit: 'bg-blue-100 text-blue-800 border-blue-200',
          rejected: 'bg-red-100 text-red-800 border-red-200',
          disputed: 'bg-red-100 text-red-800 border-red-200',
          returned: 'bg-slate-100 text-slate-800 border-slate-200',
          maintenance: 'bg-slate-100 text-slate-800 border-slate-200',
          resolved: 'bg-green-100 text-green-800 border-green-200',
          sold: 'bg-purple-100 text-purple-800 border-purple-200',
          paid: 'bg-green-100 text-green-800 border-green-200',
      };
      
      let normalized = 'pending';
      try {
        normalized = status.toLowerCase();
      } catch (e) {
        normalized = 'pending';
      }
      
      const style = styles[normalized] || 'bg-gray-100 text-gray-800';
      return <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${style}`}>{status.replace('_', ' ')}</span>;
  };

  const filteredAssets = assets.filter(a => {
      if (inventoryFilter === 'pending') return a.moderationStatus === 'pending';
      if (inventoryFilter === 'approved') return a.moderationStatus === 'approved';
      if (inventoryFilter === 'rejected') return a.moderationStatus === 'rejected';
      return true;
  });

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
        {/* --- SIDEBAR --- */}
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 z-30 shadow-xl fixed md:relative h-full`}>
            <div className="h-16 flex items-center justify-center border-b border-slate-800">
                {isSidebarOpen ? <div className="font-bold text-xl tracking-wider text-white">ADMIN<span className="text-indigo-400">PANEL</span></div> : <div className="font-bold text-xl text-indigo-400">AP</div>}
            </div>
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
                {[
                    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
                    { id: 'orders', label: 'Orders & Logistics', icon: Truck },
                    { id: 'inventory', label: 'Marketplace', icon: ShoppingCart },
                    { id: 'users', label: 'User Management', icon: Users },
                    { id: 'referrals', label: 'Referral Payouts', icon: Link },
                    { id: 'health', label: 'Health Segment', icon: Activity },
                    { id: 'support', label: 'Support Tickets', icon: MessageSquare },
                    { id: 'settings', label: 'Settings', icon: Settings },
                ].map((item) => (
                    <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                        <item.icon size={20} strokeWidth={activeTab === item.id ? 2.5 : 2} className={activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                        {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-800 space-y-2">
                <button onClick={onSwitchToUser} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-indigo-400 hover:text-white hover:bg-slate-800 transition-colors">
                    <LogOut size={20} className="rotate-180" />
                    {isSidebarOpen && <span className="text-sm font-medium">Exit to App</span>}
                </button>
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:text-white hover:bg-red-900/50 transition-colors">
                    <LogOut size={20} />
                    {isSidebarOpen && <span className="text-sm font-medium">Logout</span>}
                </button>
            </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'ml-64 md:ml-0' : 'ml-20 md:ml-0'}`}>
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
                <div className="flex items-center gap-4">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 md:hidden"><Menu size={20} /></button>
                     <button onClick={handleRefresh} className={`p-2 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center gap-2 ${isLoading ? 'animate-spin' : ''}`} title="Refresh Data">
                         <RefreshCw size={20} />
                         <span className="text-xs font-bold hidden sm:inline">Refresh Data</span>
                     </button>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-slate-900">{user.name}</div>
                        <div className="text-xs text-slate-500">Super Admin</div>
                    </div>
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold border-2 border-white shadow-sm">{user.name.charAt(0)}</div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
                    
                    {/* DASHBOARD OVERVIEW */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-900">Platform Overview</h2>
                            
                            {/* AI System Health Widget */}
                            <div className={`p-5 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 ${aiHealth.status === 'online' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${aiHealth.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-red-100 text-red-600'}`}>
                                        <Cpu size={24} />
                                    </div>
                                    <div>
                                        <div className={`font-bold text-lg ${aiHealth.status === 'online' ? 'text-white' : 'text-red-900'}`}>
                                            AI System {aiHealth.status === 'online' ? 'Operational' : 'Offline'}
                                        </div>
                                        <div className={`text-xs ${aiHealth.status === 'online' ? 'text-slate-400' : 'text-red-700'}`}>
                                            Latency: {aiHealth.latency}ms • Key Mode: <span className="font-bold uppercase">{aiHealth.keyType}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {aiHealth.keyType === 'fallback' && (
                                        <div className="text-xs font-bold bg-amber-500 text-slate-900 px-3 py-1 rounded-full mb-1 inline-block">
                                            ⚠️ USING RESTRICTED FALLBACK KEY
                                        </div>
                                    )}
                                    <div className={`text-xs ${aiHealth.status === 'online' ? 'text-slate-500' : 'text-red-500'}`}>
                                        Diagnostics run on load. Check Settings to upgrade key.
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign size={20}/></div></div>
                                    <div className="text-2xl font-black text-slate-900">{transactions.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Total Orders</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Link size={20}/></div></div>
                                    <div className="text-2xl font-black text-slate-900">{referralRewards.filter(r => r.status === 'pending').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Pending Payouts</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-rose-50 rounded-lg text-rose-600"><Users size={20}/></div></div>
                                    <div className="text-2xl font-black text-slate-900">{usersData.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Total Users</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><CheckCircle size={20}/></div></div>
                                    <div className="text-2xl font-black text-slate-900">{assets.filter(a => a.status === 'rented').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Active Rentals</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ORDERS & LOGISTICS */}
                    {activeTab === 'orders' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="text-2xl font-bold text-slate-900">Orders & Logistics</h2>
                                <div className="flex gap-2 flex-wrap">
                                    {['all', 'pending_approval', 'in_transit', 'active'].map(filter => (
                                        <button 
                                            key={filter}
                                            onClick={() => setOrderFilter(filter)}
                                            className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-colors ${orderFilter === filter ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'}`}
                                        >
                                            {filter.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">Order ID</th>
                                                <th className="px-6 py-4">Item Details</th>
                                                <th className="px-6 py-4">Logistics Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {transactions
                                                .filter(t => orderFilter === 'all' || t.status === orderFilter)
                                                .map(tx => (
                                                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 font-mono text-xs text-slate-500">#{tx.id.slice(-6)}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900">{tx.assetName}</div>
                                                        <div className="text-xs text-slate-500">Renter: {tx.renterName}</div>
                                                        <div className="text-xs text-slate-500 mt-1">Duration: {new Date(tx.startDate).toLocaleDateString()} - {new Date(tx.endDate || '').toLocaleDateString()}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <StatusBadge status={tx.status} />
                                                            {tx.depositHeld && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">Payment Held</span>}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {tx.status === 'pending_approval' && (
                                                                <button onClick={() => handleOrderStatusChange(tx.id, 'in_transit')} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1">
                                                                    <Truck size={14}/> Dispatch
                                                                </button>
                                                            )}
                                                            {tx.status === 'in_transit' && (
                                                                <button onClick={() => handleOrderStatusChange(tx.id, 'active')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm flex items-center gap-1">
                                                                    <CheckCircle size={14}/> Confirm Delivery
                                                                </button>
                                                            )}
                                                            {tx.status === 'active' && (
                                                                <button onClick={() => handleOrderStatusChange(tx.id, 'returned')} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 shadow-sm flex items-center gap-1">
                                                                    <PackageCheck size={14}/> Process Return
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleOrderStatusChange(tx.id, 'disputed')} className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50" title="Flag Dispute">
                                                                <AlertCircle size={16}/>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {transactions.length === 0 && (
                                                <tr><td colSpan={4} className="p-8 text-center text-slate-500 italic">No orders found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* REFERRAL PAYOUTS (NEW) */}
                    {activeTab === 'referrals' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-slate-900">Referral Payouts</h2>
                                <div className="bg-white px-4 py-2 rounded-lg border shadow-sm text-xs font-bold">
                                    Pending: <span className="text-amber-600">KES {referralRewards.filter(r => r.status === 'pending').reduce((s,r) => s + r.amount, 0)}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">Referrer</th>
                                                <th className="px-6 py-4">Referred User</th>
                                                <th className="px-6 py-4">Amount</th>
                                                <th className="px-6 py-4">Date Earned</th>
                                                <th className="px-6 py-4 text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {referralRewards.map(r => (
                                                <tr key={r.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900">{r.referrerName}</div>
                                                        <div className="text-xs text-slate-500">ID: {r.referrerId}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-slate-700">{r.referredUserName}</div>
                                                        <div className="text-xs text-slate-500">New Creator</div>
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-indigo-600">KES {r.amount}</td>
                                                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        {r.status === 'pending' ? (
                                                            <button 
                                                                onClick={() => handleMarkRewardPaid(r.id)}
                                                                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm flex items-center gap-1 ml-auto"
                                                            >
                                                                <CreditCard size={14} /> Mark Paid
                                                            </button>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold uppercase">
                                                                <CheckCircle size={12} /> Paid
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {referralRewards.length === 0 && (
                                                <tr><td colSpan={5} className="p-8 text-center text-slate-500 italic">No referrals yet.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MARKETPLACE INVENTORY */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-8">
                             {/* Section 1: Rentals */}
                             <div>
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                                    <h2 className="text-2xl font-bold text-slate-900">Asset Management (Rentals)</h2>
                                    <div className="flex gap-2">
                                        <button onClick={() => setInventoryFilter('pending')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all ${inventoryFilter === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'bg-white border text-slate-500'}`}>Pending Review</button>
                                        <button onClick={() => setInventoryFilter('approved')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all ${inventoryFilter === 'approved' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-500'}`}>Approved</button>
                                        <button onClick={() => setInventoryFilter('rejected')} className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition-all ${inventoryFilter === 'rejected' ? 'bg-red-500 text-white shadow-md' : 'bg-white border text-slate-500'}`}>Rejected (AI)</button>
                                    </div>
                                </div>

                                {filteredAssets.length === 0 ? (
                                    <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                                        No items found in {inventoryFilter} status.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {filteredAssets.map(asset => (
                                            <div key={asset.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col group">
                                                {/* Media Area */}
                                                <div className="relative bg-slate-100">
                                                    {/* Video Player if available - show compact */}
                                                    {asset.videoProof && (
                                                        <div className="w-full aspect-video bg-black">
                                                            <video controls className="w-full h-full object-contain">
                                                                <source src={asset.videoProof} type="video/mp4"/>
                                                                Your browser does not support video.
                                                            </video>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Image Strip */}
                                                    <div className="flex overflow-x-auto p-2 gap-2 bg-slate-50 border-t border-slate-200 scrollbar-hide">
                                                        {asset.images?.map((img, i) => (
                                                            <img key={i} src={img} className="h-16 w-16 object-cover rounded border border-slate-200 flex-shrink-0" alt="asset part"/>
                                                        ))}
                                                    </div>

                                                    <div className="absolute top-2 right-2 flex gap-1">
                                                        <StatusBadge status={asset.moderationStatus} />
                                                    </div>
                                                </div>

                                                <div className="p-4 flex-1 flex flex-col">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <h3 className="font-bold text-slate-900 truncate flex-1">{asset.name}</h3>
                                                        <div className="font-bold text-indigo-600 text-sm">
                                                            KES {asset.listingType === 'sale' ? asset.salePrice : asset.dailyRate}
                                                            {asset.listingType === 'rent' && <span className="text-xs text-slate-400 font-normal">/day</span>}
                                                        </div>
                                                    </div>
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <span className={`text-[10px] uppercase font-bold px-1.5 rounded ${asset.listingType === 'sale' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                                                            {asset.listingType === 'sale' ? 'For Sale' : 'For Rent'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                                                            <MapPin size={10}/> {asset.location || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 line-clamp-2 mb-2 flex-1">{asset.description}</p>
                                                    
                                                    {asset.specialDetails && (
                                                        <div className="bg-amber-50 p-2 rounded text-[10px] text-amber-800 mb-3 border border-amber-100">
                                                            <span className="font-bold block flex items-center gap-1"><Info size={10}/> Handling Instructions:</span>
                                                            {asset.specialDetails}
                                                        </div>
                                                    )}

                                                    {asset.rejectionReason && (
                                                        <div className="bg-red-50 p-2 rounded text-[10px] text-red-800 mb-3 border border-red-100 font-bold">
                                                            Reason: {asset.rejectionReason}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-auto">
                                                        {asset.moderationStatus === 'pending' || asset.moderationStatus === 'rejected' ? (
                                                            <>
                                                                <button onClick={() => handleAssetApproval(asset.id, 'approved')} className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                                                    <CheckCircle size={14}/> {asset.moderationStatus === 'rejected' ? 'Override & Approve' : 'Approve'}
                                                                </button>
                                                                {asset.moderationStatus !== 'rejected' && (
                                                                    <button onClick={() => handleAssetApproval(asset.id, 'rejected')} className="flex-1 bg-red-50 text-red-700 hover:bg-red-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                                                                        <XCircle size={14}/> Reject
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => setEditingAsset(asset)} className="flex-1 bg-slate-50 text-slate-700 hover:bg-slate-100 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                                                                    <Edit3 size={14}/> Edit
                                                                </button>
                                                                <button onClick={async () => {if(confirm('Delete asset?')) { await deleteAsset(asset.id); await loadData(); }}} className="px-3 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 rounded-lg">
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                             </div>

                             {/* Section 2: Shop Products */}
                             <div className="border-t border-slate-200 pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ShoppingBag className="text-rose-500"/> Shop Products</h2>
                                    <Button variant="primary" size="sm" onClick={handleAddProduct}><Plus size={16}/> Add Product</Button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {products.map(product => (
                                        <div key={product.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            <img src={product.image} className="w-full h-32 object-cover bg-slate-100" />
                                            <div className="p-3">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">{product.category}</div>
                                                <div className="font-bold text-slate-900 text-sm truncate">{product.name}</div>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-indigo-600 font-bold text-sm">KES {product.price}</span>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => handleEditProduct(product)} className="p-1.5 bg-slate-100 rounded hover:bg-slate-200 text-slate-600"><Edit3 size={12}/></button>
                                                        <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 bg-red-50 rounded hover:bg-red-100 text-red-500"><Trash2 size={12}/></button>
                                                    </div>
                                                </div>
                                                <div className="mt-2 text-[10px] font-bold text-slate-500">Stock: {product.stock}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    )}

                    {/* USER MANAGEMENT */}
                    {activeTab === 'users' && (
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">User Directory</h2>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm max-w-[85vw] sm:max-w-full overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500 text-left">
                                        <tr>
                                            <th className="px-6 py-4 whitespace-nowrap">User Identity</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Role</th>
                                            <th className="px-6 py-4 whitespace-nowrap">Status</th>
                                            <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {usersData.map(u => (
                                            <tr key={u.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-slate-900">{u.name}</div>
                                                    <div className="text-xs text-slate-500">{u.email}</div>
                                                    <div className="text-xs text-slate-400">{u.phone}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                        u.role === 'admin' ? 'bg-red-100 text-red-800' : 
                                                        u.role === 'nurse' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>{u.role}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            u.approvalStatus === 'approved' ? 'bg-green-100 text-green-700' : 
                                                            u.approvalStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {u.approvalStatus || 'Pending'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                            KYC: {u.verified ? 'Verified' : 'Unverified'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                                    {onImpersonate && u.id !== user.id && (
                                                        <button onClick={() => onImpersonate(u)} className="text-indigo-600 hover:underline text-xs font-bold mr-2">Impersonate</button>
                                                    )}
                                                    
                                                    {/* Approval / Suspend Buttons */}
                                                    {u.id !== user.id && (
                                                        <>
                                                            {u.approvalStatus !== 'approved' && (
                                                                <button 
                                                                    onClick={() => handleUserStatusChange(u.id, 'approved')}
                                                                    className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 inline-block align-middle"
                                                                    title="Approve User"
                                                                >
                                                                    <UserCheck size={16}/>
                                                                </button>
                                                            )}
                                                            {u.approvalStatus !== 'rejected' && (
                                                                <button 
                                                                    onClick={() => handleUserStatusChange(u.id, 'rejected')}
                                                                    className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 inline-block align-middle ml-2"
                                                                    title="Suspend User"
                                                                >
                                                                    <UserX size={16}/>
                                                                </button>
                                                            )}
                                                        </>
                                                    )}

                                                    <select 
                                                        className="border rounded text-xs p-1 ml-2 align-middle"
                                                        value={u.role}
                                                        onChange={(e) => changeUserRole(u.id, e.target.value)}
                                                        disabled={u.id === user.id}
                                                    >
                                                        <option value="user">User</option>
                                                        <option value="nurse">Nurse</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* HEALTH SEGMENT */}
                    {activeTab === 'health' && (
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Activity className="text-rose-500"/> Nurse Logs & Triage</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {nurseLogs.length === 0 ? <p className="text-slate-500 italic">No triage logs found.</p> : nurseLogs.map(log => (
                                    <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${log.role === 'user' ? 'bg-slate-100 text-slate-600' : 'bg-purple-100 text-purple-600'}`}>{log.role}</span>
                                            <span className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg">{log.text}</p>
                                        <button 
                                            onClick={() => {if(confirm('Delete Log?')) { deleteNurseMessage(log.id); loadData(); }}}
                                            className="absolute top-4 right-4 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SUPPORT TICKETS */}
                    {activeTab === 'support' && (
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Support Tickets</h2>
                            <div className="space-y-4">
                                {tickets.length === 0 ? <div className="text-center py-10 text-slate-500">No support tickets found.</div> : tickets.map(ticket => (
                                    <div key={ticket.id} className={`bg-white p-6 rounded-xl border ${ticket.status === 'resolved' ? 'border-green-200' : 'border-slate-200'} shadow-sm`}>
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ticket.type === 'complaint' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{ticket.type}</span>
                                                    <h3 className="font-bold text-slate-900">{ticket.subject}</h3>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">From: <span className="font-bold">{ticket.userName}</span> • {new Date(ticket.createdAt).toLocaleString()}</div>
                                            </div>
                                            <StatusBadge status={ticket.status} />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-700 mb-4 border border-slate-100">
                                            {ticket.message}
                                        </div>
                                        
                                        {ticket.adminReply ? (
                                            <div className="bg-green-50 p-3 rounded-lg text-sm text-green-800 border border-green-100 flex gap-2">
                                                <MessageSquare size={16} className="mt-0.5 flex-shrink-0"/>
                                                <div><span className="font-bold">Admin Reply:</span> {ticket.adminReply}</div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                {activeTicketId === ticket.id ? (
                                                    <div className="flex-1 flex gap-2">
                                                        <input 
                                                            className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
                                                            placeholder="Type reply..."
                                                            value={replyText}
                                                            onChange={e => setReplyText(e.target.value)}
                                                        />
                                                        <button onClick={() => handleReplyTicket(ticket.id)} className="bg-green-600 text-white px-4 rounded font-bold text-xs hover:bg-green-700">Send</button>
                                                        <button onClick={() => setActiveTicketId(null)} className="text-slate-500 hover:text-slate-800 px-2">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setActiveTicketId(ticket.id)} className="text-indigo-600 font-bold text-xs hover:underline flex items-center gap-1">
                                                        <MessageSquare size={14}/> Reply to User
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SETTINGS */}
                    {activeTab === 'settings' && (
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">System Settings</h2>
                            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Organization Name</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 border border-slate-300 rounded-lg text-slate-900"
                                        value={settings.orgName}
                                        onChange={e => setSettings({...settings, orgName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Brand Logo</label>
                                    <div className="flex items-center gap-4">
                                        {settings.logoUrl && <img src={settings.logoUrl} className="h-12 w-12 object-contain bg-slate-100 rounded border border-slate-200"/>}
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={e => setLogoFile(e.target.files?.[0] || null)}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Gemini API Key (Optional Override)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 flex items-center gap-2">
                                            <Key size={16} className="text-slate-400"/>
                                            <input 
                                                type="password" 
                                                placeholder="Leave empty to use system default"
                                                className="w-full p-3 border border-slate-300 rounded-lg text-slate-900"
                                                value={settings.geminiApiKey || ''}
                                                onChange={e => setSettings({...settings, geminiApiKey: e.target.value})}
                                            />
                                        </div>
                                        <button 
                                            onClick={handleTestKey}
                                            disabled={isTestingKey}
                                            className="bg-indigo-50 text-indigo-700 font-bold px-4 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2"
                                        >
                                            {isTestingKey ? <Loader2 className="animate-spin"/> : <Wifi size={18}/>}
                                            Test
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Only set this if you have a custom paid enterprise key.</p>
                                </div>
                                <Button onClick={handleSaveSettings} isLoading={isSavingSettings}>Save Configuration</Button>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>

        {/* --- MODALS --- */}
        
        {/* REJECT ASSET MODAL */}
        {isRejectModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                    <h3 className="font-bold text-lg mb-4 text-slate-900">Reject Asset Listing</h3>
                    <p className="text-sm text-slate-500 mb-4">Please provide a reason for rejection. This will be visible to the user.</p>
                    <textarea 
                        className="w-full border border-slate-300 rounded-lg p-3 h-32 mb-4 text-sm"
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setIsRejectModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold text-sm">Cancel</button>
                        <button onClick={confirmReject} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700">Confirm Rejection</button>
                    </div>
                </div>
            </div>
        )}

        {/* PRODUCT MODAL */}
        {isProductModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-lg mb-4 text-slate-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Name</label>
                            <input className="w-full border p-2 rounded" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Price</label>
                                <input type="number" className="w-full border p-2 rounded" value={productForm.price} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Stock</label>
                                <input type="number" className="w-full border p-2 rounded" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Category</label>
                            <select className="w-full border p-2 rounded" value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as any})}>
                                <option value="hygiene">Hygiene</option>
                                <option value="wellness">Wellness</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Image</label>
                            
                            {/* Preview Area */}
                            {(productImageFile || productForm.image) && (
                                <div className="mb-3 relative group">
                                    <div className="w-32 h-32 rounded-lg overflow-hidden border border-slate-200">
                                        <img 
                                            src={productImageFile ? URL.createObjectURL(productImageFile) : productForm.image} 
                                            className="w-full h-full object-cover" 
                                            alt="Preview"
                                        />
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={handleAIEnhanceProductImage}
                                        disabled={isEnhancingImage}
                                        className="absolute bottom-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md flex items-center gap-1 hover:bg-indigo-700 transition-colors"
                                    >
                                        {isEnhancingImage ? <Loader2 size={10} className="animate-spin"/> : <Wand2 size={10}/>} 
                                        {isEnhancingImage ? 'Enhancing...' : 'AI Remove BG'}
                                    </button>
                                </div>
                            )}

                            <input type="file" accept="image/*" onChange={e => setProductImageFile(e.target.files?.[0] || null)} className="w-full text-xs" />
                            <p className="text-[10px] text-slate-400 mt-1">Upload an image, then click "AI Remove BG" to isolate the product.</p>
                        </div>
                        <Button onClick={handleSaveProduct} isLoading={isSavingProduct} className="w-full">Save Product</Button>
                        <button onClick={() => setIsProductModalOpen(false)} className="w-full text-center text-slate-400 text-xs font-bold mt-2">Cancel</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
