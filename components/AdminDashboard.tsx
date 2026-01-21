
import React, { useState, useEffect } from 'react';
import { getTransactions, saveSettings, getSettings, uploadMedia, updateAssetStatus, getAllUsers, updateUserStatus, updateTransactionStatus, getNurseMessages, deleteNurseMessage, getProducts, saveProduct, updateAsset, updateUserRole, deleteAsset, getTickets, updateTicket, getAssets, deleteProduct } from '../services/storageService';
import { Transaction, AppSettings, Asset, UserProfile, ChatMessage, Product, SupportTicket } from '../types';
import { LayoutDashboard, ShoppingCart, Users, Activity, MessageSquare, Settings, LogOut, Menu, Truck, CheckCircle, XCircle, AlertCircle, DollarSign, Edit3, Trash2, Info, RefreshCw, PackageCheck, FileText, MapPin, ExternalLink, Key, Plus, ShoppingBag } from 'lucide-react';
import Button from './Button';

interface AdminDashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onSwitchToUser?: () => void;
  onImpersonate?: (user: UserProfile) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onSwitchToUser, onImpersonate }) => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'users' | 'health' | 'support' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [usersData, setUsersData] = useState<UserProfile[]>([]);
  const [nurseLogs, setNurseLogs] = useState<ChatMessage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ orgName: '', logoUrl: '', geminiApiKey: '' });

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
        setSettings(await getSettings());
    } catch (e) {
        console.error("Failed to load admin data", e);
    }
    setIsLoading(false);
  };

  const handleRefresh = () => {
      loadData();
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
      alert("Settings Saved.");
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
        <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white flex flex-col transition-all duration-300 z-30 shadow-xl`}>
            <div className="h-16 flex items-center justify-center border-b border-slate-800">
                {isSidebarOpen ? <div className="font-bold text-xl tracking-wider text-white">ADMIN<span className="text-indigo-400">PANEL</span></div> : <div className="font-bold text-xl text-indigo-400">AP</div>}
            </div>
            <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
                {[
                    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
                    { id: 'orders', label: 'Orders & Logistics', icon: Truck },
                    { id: 'inventory', label: 'Marketplace', icon: ShoppingCart },
                    { id: 'users', label: 'User Management', icon: Users },
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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-20">
                <div className="flex items-center gap-4">
                     <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"><Menu size={20} /></button>
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

            <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
                    
                    {/* DASHBOARD OVERVIEW */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-900">Platform Overview</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><DollarSign size={20}/></div></div>
                                    <div className="text-2xl font-black text-slate-900">{transactions.length}</div>
                                    <div className="text-xs text-slate-500 font-medium">Total Orders</div>
                                </div>
                                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-2"><div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Truck size={20}/></div></div>
                                    <div className="text-2xl font-black text-slate-900">{transactions.filter(t => t.status === 'in_transit').length}</div>
                                    <div className="text-xs text-slate-500 font-medium">In Transit</div>
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
                                <div className="flex gap-2">
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

                    {/* MARKETPLACE INVENTORY */}
                    {activeTab === 'inventory' && (
                        <div className="space-y-6">
                             <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
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
                                                    <div className="font-bold text-indigo-600 text-sm">KES {asset.dailyRate}</div>
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
                    )}

                    {/* USER MANAGEMENT */}
                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-4">User Details</th>
                                                <th className="px-6 py-4">Role</th>
                                                <th className="px-6 py-4">Verification</th>
                                                <th className="px-6 py-4">Location</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {usersData.map(u => (
                                                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900">{u.name}</div>
                                                        <div className="text-xs text-slate-500">{u.email}</div>
                                                        <div className="text-xs text-slate-400 mt-1">{u.phone}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <select 
                                                            value={u.role || 'user'}
                                                            onChange={(e) => changeUserRole(u.id, e.target.value)}
                                                            className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-lg p-2 font-bold uppercase cursor-pointer hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                        >
                                                            <option value="user">User</option>
                                                            <option value="nurse">Nurse</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                        {/* IMPERSONATION BUTTON */}
                                                        {onImpersonate && (
                                                            <button 
                                                                onClick={() => onImpersonate(u)} 
                                                                className="mt-2 text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                                                                title="Login as this user to view their portal"
                                                            >
                                                                <LogOut size={10} className="rotate-180"/> Login As User
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {(u.approvalStatus || 'pending') === 'pending' ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold uppercase"><AlertCircle size={12}/> Pending</span>
                                                        ) : (
                                                            <StatusBadge status={u.approvalStatus} />
                                                        )}
                                                        {u.verified && <div className="text-[10px] text-green-600 font-bold mt-1 flex items-center gap-1"><CheckCircle size={10}/> AI Verified</div>}
                                                        
                                                        {/* Documents View */}
                                                        {u.idDocumentFront && (
                                                            <div className="flex gap-2 mt-2">
                                                                <a href={u.idDocumentFront} target="_blank" className="text-[10px] bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 border border-slate-300 flex items-center gap-1"><FileText size={10}/> ID Front</a>
                                                                {u.idDocumentBack && (
                                                                    <a href={u.idDocumentBack} target="_blank" className="text-[10px] bg-slate-100 px-2 py-1 rounded hover:bg-slate-200 border border-slate-300 flex items-center gap-1"><FileText size={10}/> ID Back</a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {u.lastLocation ? (
                                                            <div>
                                                                <a 
                                                                    href={`https://www.google.com/maps?q=${u.lastLocation.lat},${u.lastLocation.lng}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-1 text-indigo-600 font-bold text-xs hover:underline"
                                                                >
                                                                    <MapPin size={12} /> View Map <ExternalLink size={10}/>
                                                                </a>
                                                                <div className="text-[10px] text-slate-400 mt-1">
                                                                    {new Date(u.lastLocation.timestamp).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">N/A</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {u.approvalStatus === 'pending' && (
                                                                <button onClick={async () => {await updateUserStatus(u.id, 'approved'); await loadData();}} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm">
                                                                    Approve
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HEALTH SEGMENT (SHOP & NURSE LOGS) */}
                    {activeTab === 'health' && (
                        <div className="space-y-8">
                            {/* SHOP INVENTORY SECTION */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">Shop Inventory</h2>
                                        <p className="text-xs text-slate-500">Manage products for the Women's Health Store (Pads, Safety Gear, etc).</p>
                                    </div>
                                    <button onClick={handleAddProduct} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-rose-700 shadow-md">
                                        <Plus size={16}/> Add Product
                                    </button>
                                </div>
                                
                                {products.length === 0 ? (
                                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 italic">
                                        No products in the shop. Add some items to get started.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {products.map(p => (
                                            <div key={p.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group hover:shadow-md transition-shadow">
                                                <div className="h-40 bg-slate-100 relative">
                                                    <img src={p.image} className="w-full h-full object-cover"/>
                                                    {p.stock < 5 && <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">Low Stock: {p.stock}</span>}
                                                </div>
                                                <div className="p-4">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="font-bold text-slate-900 truncate text-sm flex-1 mr-2">{p.name}</div>
                                                        <div className="text-[10px] font-bold uppercase text-slate-400 border border-slate-200 px-1.5 rounded">{p.category}</div>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center mb-4">
                                                        <span className="font-bold text-rose-600">KES {p.price}</span>
                                                        <span className="text-xs font-bold text-slate-500">Qty: {p.stock}</span>
                                                    </div>
                                                    
                                                    <div className="flex gap-2 border-t border-slate-100 pt-3">
                                                        <button onClick={() => handleEditProduct(p)} className="flex-1 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center gap-1">
                                                            <Edit3 size={12}/> Edit
                                                        </button>
                                                        <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                            <Trash2 size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* NURSE LOGS SECTION */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h2 className="text-xl font-bold text-slate-900 mb-4">Nurse Chat Logs</h2>
                                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                    {nurseLogs.length === 0 ? (
                                        <div className="p-8 text-center text-slate-500 italic">No saved nurse logs available.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-200">
                                            {nurseLogs.map(log => (
                                                <div key={log.id} className="p-4 flex justify-between items-start hover:bg-white transition-colors">
                                                    <div>
                                                        <div className="text-xs text-slate-400 mb-1">{new Date(log.timestamp).toLocaleString()}</div>
                                                        <p className="text-sm text-slate-800 font-medium">{log.text}</p>
                                                        <span className="inline-block mt-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase">{log.role}</span>
                                                    </div>
                                                    <button onClick={async () => {await deleteNurseMessage(log.id); await loadData();}} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded transition-colors">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SUPPORT TICKETS */}
                    {activeTab === 'support' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-900">Support Tickets</h2>
                            <div className="grid gap-4">
                                {tickets.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500 italic bg-white rounded-xl border border-slate-200">No active tickets.</div>
                                ) : (
                                    tickets.map(ticket => (
                                        <div key={ticket.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">{ticket.subject}</span>
                                                        <StatusBadge status={ticket.status} />
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">From: {ticket.userName} • {new Date(ticket.createdAt).toLocaleDateString()}</div>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase bg-slate-100 px-2 py-1 rounded text-slate-500">{ticket.type}</span>
                                            </div>
                                            <p className="text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded">{ticket.message}</p>
                                            
                                            {ticket.adminReply ? (
                                                <div className="bg-green-50 p-3 rounded border border-green-100 text-sm text-green-800">
                                                    <span className="font-bold block text-xs uppercase mb-1">Admin Reply:</span>
                                                    {ticket.adminReply}
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input 
                                                        className="flex-1 border p-2 rounded text-sm"
                                                        placeholder="Type a reply..."
                                                        value={activeTicketId === ticket.id ? replyText : ''}
                                                        onChange={(e) => {
                                                            setActiveTicketId(ticket.id);
                                                            setReplyText(e.target.value);
                                                        }}
                                                    />
                                                    <button 
                                                        onClick={() => handleReplyTicket(ticket.id)}
                                                        disabled={activeTicketId !== ticket.id || !replyText}
                                                        className="bg-indigo-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                                                    >
                                                        Reply & Resolve
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* SETTINGS */}
                    {activeTab === 'settings' && (
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">System Settings</h2>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Organization Name</label>
                                    <input 
                                        value={settings.orgName}
                                        onChange={(e) => setSettings({...settings, orgName: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                
                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <label className="block text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                        <Key size={16}/> Gemini API Key (Enterprise)
                                    </label>
                                    <div className="relative">
                                        <input 
                                            type="password"
                                            value={settings.geminiApiKey || ''}
                                            onChange={(e) => setSettings({...settings, geminiApiKey: e.target.value})}
                                            className="w-full border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none pr-10 bg-white"
                                            placeholder="AIzaSy..."
                                        />
                                        <div className="absolute right-3 top-3.5 text-indigo-300">
                                            <Key size={14}/>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-indigo-700 mt-2">
                                        <span className="font-bold">Deployment Fix:</span> Enter your key here to ensure AI components work on deployed versions where env vars are missing.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Logo Upload</label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                            {logoFile ? (
                                                <img src={URL.createObjectURL(logoFile)} className="w-full h-full object-contain" />
                                            ) : settings.logoUrl ? (
                                                <img src={settings.logoUrl} className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-xs text-slate-400">No Logo</span>
                                            )}
                                        </div>
                                        <input 
                                            type="file" 
                                            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                    </div>
                                </div>
                                <Button variant="wealth" onClick={handleSaveSettings} isLoading={isSavingSettings}>
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>

        {/* REJECT MODAL */}
        {isRejectModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                    <h3 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2"><XCircle size={20}/> Reject Listing</h3>
                    <p className="text-sm text-slate-600 mb-4">Please provide a reason for the user.</p>
                    <textarea 
                        className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none mb-4 h-24 resize-none"
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg">Cancel</button>
                        <button onClick={confirmReject} disabled={!rejectReason} className="flex-1 py-2 bg-red-600 text-white font-bold text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">Confirm</button>
                    </div>
                </div>
            </div>
        )}

        {/* EDIT ASSET MODAL */}
        {editingAsset && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Edit3 size={18}/> Edit Asset</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Name</label>
                            <input value={editingAsset.name} onChange={e => setEditingAsset({...editingAsset, name: e.target.value})} className="w-full border p-2 rounded-lg text-sm"/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                            <textarea value={editingAsset.description} onChange={e => setEditingAsset({...editingAsset, description: e.target.value})} className="w-full border p-2 rounded-lg text-sm" rows={3}/>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Rate (KES)</label>
                            <input type="number" value={editingAsset.dailyRate} onChange={e => setEditingAsset({...editingAsset, dailyRate: parseInt(e.target.value)})} className="w-full border p-2 rounded-lg text-sm"/>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-6">
                        <button onClick={() => setEditingAsset(null)} className="flex-1 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg">Cancel</button>
                        <button onClick={saveAssetChanges} className="flex-1 py-2 bg-indigo-600 text-white font-bold text-sm rounded-lg hover:bg-indigo-700">Save Changes</button>
                    </div>
                </div>
            </div>
        )}

        {/* ADD/EDIT PRODUCT MODAL */}
        {isProductModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        {editingProduct ? <Edit3 size={18}/> : <Plus size={18}/>} 
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h3>
                    
                    <div className="space-y-4">
                        {/* Image Upload */}
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                                {productImageFile ? (
                                    <img src={URL.createObjectURL(productImageFile)} className="w-full h-full object-cover" />
                                ) : productForm.image ? (
                                    <img src={productForm.image} className="w-full h-full object-cover" />
                                ) : (
                                    <ShoppingBag size={24} className="text-slate-300"/>
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Image</label>
                                <input type="file" onChange={e => setProductImageFile(e.target.files?.[0] || null)} className="block w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"/>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Product Name</label>
                            <input value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className="w-full border p-2 rounded-lg text-sm bg-slate-50" placeholder="e.g. Sanitary Pads Pack"/>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Price (KES)</label>
                                <input type="number" value={productForm.price} onChange={e => setProductForm({...productForm, price: Number(e.target.value)})} className="w-full border p-2 rounded-lg text-sm bg-slate-50"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Stock Qty</label>
                                <input type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: Number(e.target.value)})} className="w-full border p-2 rounded-lg text-sm bg-slate-50"/>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                            <select value={productForm.category} onChange={e => setProductForm({...productForm, category: e.target.value as any})} className="w-full border p-2 rounded-lg text-sm bg-slate-50">
                                <option value="hygiene">Hygiene (Pads, Sanitizers)</option>
                                <option value="wellness">Wellness (Vitamins, Supplements)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-6">
                        <button onClick={() => setIsProductModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-lg">Cancel</button>
                        <Button variant="health" onClick={handleSaveProduct} isLoading={isSavingProduct} className="flex-1">
                            Save Product
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;
