
import React, { useState, useEffect, useRef } from 'react';
import { Store, Wand2, Plus, MapPin, Video, DollarSign, Image as ImageIcon, Sparkles, CheckCircle, RefreshCw, Search, Briefcase, History, Upload, Shield, User, Filter, AlertCircle, ArrowUpDown, TrendingUp, Package, Truck, Clock, PackageCheck, LogOut, Stethoscope, Settings, ListPlus, HelpCircle, MessageSquare, AlertTriangle, FileText, X, Calendar, Layers, Video as VideoIcon, Info, LayoutDashboard } from 'lucide-react';
import Button from './Button';
import { Asset, GeoLocation, UserProfile, Transaction, SupportTicket } from '../types';
import { analyzeAsset, generateMarketingVideo, findLocalSuppliers, editAssetImage, validateAssetImages, validateKenyanID } from '../services/geminiService';
import { uploadMedia, getAssets, addAsset, rentAsset, getTransactions, returnAsset, updateUserProfile, getTickets, addTicket } from '../services/storageService';

const CATEGORIES = ['Tailoring', 'Events', 'Farming', 'Catering', 'Electronics', 'Construction', 'Transport', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Heavy Duty'];

interface WealthPortalProps {
    user: UserProfile;
    onUpdateUser: (updatedUser: UserProfile) => void;
    onSwitchToAdmin?: () => void;
    onSwitchToNurse?: () => void;
}

const WealthPortal: React.FC<WealthPortalProps> = ({ user, onUpdateUser, onSwitchToAdmin, onSwitchToNurse }) => {
  const [activeView, setActiveView] = useState<'market' | 'create' | 'tools' | 'rentals' | 'profile'>('market');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [myRentals, setMyRentals] = useState<Transaction[]>([]);
  
  // Verification State
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState(false);

  // Rental Modal State
  const [selectedAssetForRent, setSelectedAssetForRent] = useState<Asset | null>(null);
  const [rentDays, setRentDays] = useState(1);
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number, accuracy: number} | null>(null);

  // Tickets
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState<{type: 'complaint' | 'help' | 'return', subject: string, message: string}>({
      type: 'help', subject: '', message: ''
  });

  // Sorting
  const [sortOrder, setSortOrder] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');

  // Check if user is admin (case insensitive)
  const isUserAdmin = user?.role ? ['admin', 'administrator'].includes(user.role.trim().toLowerCase()) : false;

  useEffect(() => {
    const load = async () => {
        setAssets(await getAssets());
        const allTx = await getTransactions();
        setMyRentals(allTx.filter(t => t.renterId === user.id));
        const tickets = await getTickets();
        setMyTickets(tickets.filter(t => t.userId === user.id));
    };
    load();
  }, [activeView, user.id, showTicketModal, selectedAssetForRent]);

  const filteredAssets = assets
    .filter(a => a.moderationStatus === 'approved')
    .sort((a, b) => {
        if (sortOrder === 'price-asc') return a.dailyRate - b.dailyRate;
        if (sortOrder === 'price-desc') return b.dailyRate - a.dailyRate;
        return parseInt(b.id) - parseInt(a.id);
    });
    
  // My Listings (Created by me)
  const myListings = assets.filter(a => a.ownerId === user.id);

  const myEarnings = myRentals
    .filter(t => t.ownerId === user.id && t.status !== 'disputed' && t.status !== 'pending_approval')
    .reduce((sum, t) => sum + t.totalCost, 0);
  
  const requireVerification = (callback: () => void) => {
      if (user.idDocumentFront && user.idDocumentBack) {
          callback();
      } else {
          setShowVerificationModal(true);
      }
  };

  // Helper to convert File to Base64 Promise
  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
      });
  };

  const handleUploadId = async () => {
      if (!idFrontFile || !idBackFile) {
          alert("Both Front and Back of ID are required.");
          return;
      }
      setIsVerifyingId(true);
      
      try {
          // 1. Get Base64 for AI Verification (FAST & RELIABLE)
          const frontBase64 = await fileToBase64(idFrontFile);
          const backBase64 = await fileToBase64(idBackFile);
          
          // 2. AI Security Check (Direct Base64)
          const validation = await validateKenyanID(frontBase64, backBase64);
          
          if (!validation.valid) {
              setIsVerifyingId(false);
              alert(`SECURITY ALERT: ID REJECTED.\n\nREASON: ${validation.reason}\n\nWARNING: Uploading fake identification is a criminal offense under Kenyan Law.`);
              return;
          }

          // 3. Upload to Storage (Only if valid)
          const frontUrl = await uploadMedia(idFrontFile);
          const backUrl = await uploadMedia(idBackFile);

          // 4. Success
          const updatedUser = { 
              ...user, 
              idDocumentFront: frontUrl, 
              idDocumentBack: backUrl, 
              verified: false, 
              approvalStatus: 'pending' as const 
          };
          
          await updateUserProfile(updatedUser);
          onUpdateUser(updatedUser);
          setIsVerifyingId(false);
          setShowVerificationModal(false);
          alert("ID Submitted Successfully. Admin approval pending.");

      } catch (error) {
          console.error(error);
          setIsVerifyingId(false);
          alert("Verification failed due to connection error. Please try again.");
      }
  };

  // Create Listing State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [videoProofFile, setVideoProofFile] = useState<File | null>(null); 
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [previewImages, setPreviewImages] = useState<string[]>([]); // Array of base64
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({ 
      title: '', 
      category: '', 
      condition: '', 
      description: '', 
      price: '', 
      specialDetails: '' 
  });
  
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [mapQuery, setMapQuery] = useState('');
  const [mapResults, setMapResults] = useState<any[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);

  const onRentClick = (asset: Asset) => {
      requireVerification(() => {
          setSelectedAssetForRent(asset);
          setRentDays(1);
          setDeliveryCoords(null);
      });
  };

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

  const confirmRent = async () => {
      if (selectedAssetForRent && rentDays > 0 && deliveryCoords) {
          window.open('https://paywith.nobuk.africa/saacaxzyzb', '_blank');
          alert(`PAYMENT SIMULATION:\n\nPlease complete payment of KES ${(selectedAssetForRent.dailyRate * rentDays).toLocaleString()} on the opened tab.`);
          
          await rentAsset(selectedAssetForRent.id, user, rentDays, deliveryCoords);
          setSelectedAssetForRent(null);
          setRentDays(1);
          setDeliveryCoords(null);
          
          // Refresh data
          setAssets(await getAssets());
          const allTx = await getTransactions();
          setMyRentals(allTx.filter(t => t.renterId === user.id));
          onUpdateUser({ ...user }); 
          setActiveView('rentals');
      }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Cast to File[] explicitly to avoid 'unknown' inference in some environments
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);

    const newPreviews: string[] = [];
    for (const file of files) {
        const b64 = await fileToBase64(file);
        newPreviews.push(b64);
    }
    
    setPreviewImages(prev => [...prev, ...newPreviews]);

    // Analyze the FIRST image only for auto-fill
    if (!isAnalyzing && newPreviews.length > 0) {
        setIsAnalyzing(true);
        const rawJson = await analyzeAsset(newPreviews[0].split(',')[1]);
        try {
            const json = JSON.parse(rawJson.replace(/```json|```/g, ''));
            setFormData(prev => ({
                ...prev, 
                title: json.title || prev.title, 
                description: json.description || prev.description, 
                price: json.estimated_rate?.toString() || prev.price, 
                category: json.category || prev.category, 
                condition: json.condition || prev.condition
            }));
        } catch (e) {}
        setIsAnalyzing(false);
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function() {
          window.URL.revokeObjectURL(video.src);
          const duration = video.duration;
          setVideoDuration(duration);
          
          if (duration < 3 || duration > 60) {
              alert(`Video Duration Error!\n\nYour video is ${duration.toFixed(1)} seconds.\n\nRequirement: Between 3 and 60 seconds.`);
              setVideoProofFile(null);
              e.target.value = ''; 
          } else {
              setVideoProofFile(file);
          }
      };
      video.src = URL.createObjectURL(file);
  };

  const handleClearImages = () => {
      setSelectedFiles([]);
      setPreviewImages([]);
  };

  const handleCreateVideo = async () => {
    if (!videoPrompt) return;
    const win = window as any;
    if (win.aistudio && !(await win.aistudio.hasSelectedApiKey())) {
        try { await win.aistudio.openSelectKey(); } catch (e) { return; }
    }
    setIsGeneratingVideo(true);
    try {
      const imgBytes = previewImages.length > 0 ? previewImages[0].split(',')[1] : undefined;
      const result = await generateMarketingVideo(videoPrompt, imgBytes);
      setVideoUrl(result);
    } catch (e) {}
    setIsGeneratingVideo(false);
  };

  const handleMapSearch = async () => {
    setIsSearchingMap(true);
    const res = await findLocalSuppliers(mapQuery, { latitude: -1.2921, longitude: 36.8219 });
    setMapResults(res.chunks || []);
    setIsSearchingMap(false);
  };

  const handleSubmitListing = async () => {
     requireVerification(async () => {
        if (!formData.title || !formData.category || !formData.condition || !formData.description || !formData.price) {
             alert("INCOMPLETE FORM: Please fill in all required text fields.");
             return;
        }

        if (selectedFiles.length < 5) {
            alert(`MISSING IMAGES: You must upload at least 5 images of the product.`);
            return;
        }

        if (!videoProofFile) {
            alert("MISSING PROOF: You must upload a proof of ownership video.");
            return;
        }

        setIsUploading(true);

        // AI Security Check using local previews (Base64) - FAST
        const validation = await validateAssetImages(previewImages, formData.title);
        
        if (!validation.valid) {
            setIsUploading(false);
            const userWantsReview = window.confirm(
                `⚠️ AI SECURITY WARNING ⚠️\n\n` +
                `System Analysis Failed: ${validation.reason}\n\n` +
                `The system believes this listing may be invalid or low quality.\n\n` +
                `Click OK to submit for MANUAL ADMIN REVIEW.`
            );
            
            if (!userWantsReview) {
                return; 
            }
            setIsUploading(true); 
        }

        // Upload Images & Video to Storage
        const uploadedImageUrls: string[] = [];
        for (const file of selectedFiles) {
            const url = await uploadMedia(file);
            uploadedImageUrls.push(url);
        }
        
        const uploadedVideoUrl = await uploadMedia(videoProofFile);

        await addAsset({
            id: Date.now().toString(), 
            name: formData.title, 
            description: formData.description, 
            specialDetails: formData.specialDetails, 
            dailyRate: parseInt(formData.price), 
            images: uploadedImageUrls, 
            videoProof: uploadedVideoUrl, 
            verified: false, 
            status: 'available', 
            ownerId: user.id, 
            moderationStatus: validation.valid ? 'pending' : 'rejected',
            rejectionReason: validation.valid ? undefined : `AI Rejection: ${validation.reason}`
        });

        setIsUploading(false);
        
        if (validation.valid) {
            alert("✅ SUCCESS: Listing Submitted! Pending Admin approval.");
        } else {
            alert("⚠️ FLAGGED: Listing sent for Manual Review.");
        }

        setActiveView('profile');
        setFormData({ title: '', category: '', condition: '', description: '', price: '', specialDetails: '' });
        handleClearImages();
        setVideoProofFile(null);
     });
  };

  const handleSubmitTicket = async () => {
      if(!newTicket.subject || !newTicket.message) return;
      await addTicket({
          id: Date.now().toString(), userId: user.id, userName: user.name, type: newTicket.type, subject: newTicket.subject, message: newTicket.message, status: 'pending', createdAt: new Date().toISOString()
      });
      setNewTicket({ type: 'help', subject: '', message: '' });
      setShowTicketModal(false);
      const tickets = await getTickets();
      setMyTickets(tickets.filter(t => t.userId === user.id));
      alert("Ticket Submitted Successfully.");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative">
      {/* Verification Modal */}
      {showVerificationModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-8 border-2 border-slate-200">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-slate-900"><Shield className="text-indigo-600"/> Identity Verification</h2>
                  <p className="text-xs text-slate-500 mb-6">Strict KYC Protocol. Upload distinct front and back images of your National ID.</p>
                  
                  <div className="space-y-4 mb-6">
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">ID Front Side</label>
                          <input type="file" onChange={(e) => setIdFrontFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">ID Back Side</label>
                          <input type="file" onChange={(e) => setIdBackFile(e.target.files?.[0] || null)} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                      </div>
                  </div>

                  <div className="bg-amber-50 p-3 rounded text-xs text-amber-800 border border-amber-100 mb-4 font-medium">
                      <AlertTriangle size={14} className="inline mr-1 mb-0.5"/>
                      Security AI is active. Fake IDs will trigger an immediate account flag.
                  </div>

                  <Button variant="wealth" onClick={handleUploadId} isLoading={isVerifyingId} disabled={!idFrontFile || !idBackFile} className="w-full">
                      Verify Identity
                  </Button>
                  <button onClick={() => setShowVerificationModal(false)} className="w-full mt-4 text-slate-400 text-sm font-bold hover:text-slate-600">Cancel</button>
              </div>
          </div>
      )}

      {/* RENTAL CONFIRMATION MODAL */}
      {selectedAssetForRent && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <Calendar className="text-indigo-600"/> Rent Asset
                  </h3>
                  <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="font-bold text-slate-900">{selectedAssetForRent.name}</div>
                      <div className="text-sm text-slate-500">Rate: KES {selectedAssetForRent.dailyRate} / day</div>
                  </div>
                  
                  {selectedAssetForRent.specialDetails && (
                      <div className="mb-4 bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                          <strong className="block mb-1 flex items-center gap-1"><Info size={12}/> Handling Instructions:</strong>
                          {selectedAssetForRent.specialDetails}
                      </div>
                  )}
                  
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Number of Days</label>
                      <div className="flex items-center gap-3">
                          <button onClick={() => setRentDays(Math.max(1, rentDays - 1))} className="bg-slate-200 w-10 h-10 rounded-lg font-bold text-lg hover:bg-slate-300">-</button>
                          <div className="flex-1 text-center font-bold text-2xl">{rentDays}</div>
                          <button onClick={() => setRentDays(rentDays + 1)} className="bg-slate-200 w-10 h-10 rounded-lg font-bold text-lg hover:bg-slate-300">+</button>
                      </div>
                  </div>

                  {/* Delivery Location Section */}
                  <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <label className="block text-xs font-bold text-indigo-900 uppercase mb-2">Delivery / Pickup Location</label>
                      <p className="text-xs text-indigo-700 mb-3">You must allow location access for accurate delivery.</p>
                      
                      {!deliveryCoords ? (
                          <button 
                            onClick={handleGetLocation}
                            className="w-full py-3 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-2"
                          >
                              <MapPin size={16} /> Auto-Detect Delivery Location
                          </button>
                      ) : (
                          <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
                              <CheckCircle size={16} />
                              <div className="text-xs font-bold">Location Captured (Accuracy: {Math.round(deliveryCoords.accuracy)}m)</div>
                          </div>
                      )}
                  </div>

                  <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-100">
                      <span className="text-sm font-bold text-slate-500">Total Cost</span>
                      <span className="text-2xl font-black text-indigo-600">KES {(selectedAssetForRent.dailyRate * rentDays).toLocaleString()}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setSelectedAssetForRent(null)} className="px-4 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                      <Button variant="wealth" onClick={confirmRent} disabled={!deliveryCoords}>Confirm Rent</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Ticket Modal */}
      {showTicketModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold flex items-center gap-2"><HelpCircle className="text-indigo-600"/> Submit Request</h3>
                      <button onClick={() => setShowTicketModal(false)}><X className="text-slate-400 hover:text-red-500"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Request Type</label>
                          <select 
                              className="w-full border p-2 rounded-lg bg-slate-50 font-medium"
                              value={newTicket.type}
                              onChange={(e) => setNewTicket({...newTicket, type: e.target.value as any})}
                          >
                              <option value="complaint">Complaint</option>
                              <option value="help">General Help</option>
                              <option value="return">Return Request</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                          <input 
                              type="text" 
                              className="w-full border p-2 rounded-lg"
                              placeholder={newTicket.type === 'return' ? "Order ID / Item Name" : "Brief topic"}
                              value={newTicket.subject}
                              onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Message</label>
                          <textarea 
                              rows={4}
                              className="w-full border p-2 rounded-lg"
                              placeholder="Describe your issue or request details..."
                              value={newTicket.message}
                              onChange={(e) => setNewTicket({...newTicket, message: e.target.value})}
                          />
                      </div>
                      <Button variant="wealth" onClick={handleSubmitTicket} className="w-full">Submit Ticket</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-amber-400 p-1.5 rounded text-slate-900"><DollarSign size={20} strokeWidth={3} /></div>
            <div><h1 className="font-bold text-lg tracking-wide">Dual Power <span className="text-amber-400">Wealth</span></h1></div>
          </div>
          <div className="flex items-center gap-6">
             <div className="text-sm font-semibold">Wallet: <span className="text-amber-400 font-mono text-base">KES {myEarnings.toLocaleString()}</span></div>
          </div>
        </div>
      </header>

      {/* Navigation - Horizontal Scroll on Mobile */}
      <nav className="bg-white border-b border-slate-200 sticky top-[72px] z-10">
         <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide">
            {[{ id: 'market', icon: Store, label: 'Marketplace' }, { id: 'rentals', icon: History, label: 'My Rentals' }, { id: 'create', icon: Plus, label: 'List Asset' }, { id: 'tools', icon: Wand2, label: 'Business AI' }, { id: 'profile', icon: User, label: 'Profile' }].map(item => (
                <button key={item.id} onClick={() => setActiveView(item.id as any)} className={`px-4 md:px-8 py-4 md:py-5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeView === item.id ? 'border-indigo-600 text-indigo-900 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                    <item.icon size={18} /> {item.label}
                </button>
            ))}
         </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {activeView === 'market' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between mb-4 gap-2">
                <input type="text" placeholder="Search..." className="border p-2 rounded w-full md:w-64 text-slate-900" />
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="border p-2 rounded text-slate-900"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option></select>
            </div>
            {filteredAssets.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <Store className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-lg font-bold text-slate-600">No items available yet.</h3>
                    <p className="text-slate-500 text-sm mb-4">Be the first to list an asset and start earning!</p>
                    <button onClick={() => setActiveView('create')} className="text-indigo-600 font-bold hover:underline">List Item Now</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                    {filteredAssets.map(asset => (
                        <div key={asset.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group">
                            <div className="h-48 bg-slate-100 relative">
                                <img src={asset.images?.[0] || ''} className="w-full h-full object-cover"/>
                                {asset.status === 'rented' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">RENTED</div>}
                                {asset.images && asset.images.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                        <Layers size={10}/> +{asset.images.length - 1}
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-slate-900">{asset.name}</h3>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-indigo-900 font-bold">KES {asset.dailyRate}</span>
                                    <Button variant="wealth" size="sm" disabled={asset.status !== 'available'} onClick={() => onRentClick(asset)}>Rent</Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* Other views */}
        {activeView === 'profile' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Profile Header */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                    <div className="bg-indigo-100 p-6 rounded-full w-24 h-24 flex items-center justify-center"><User size={48} className="text-indigo-600" /></div>
                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                        <div className="text-sm text-slate-500">{user.email}</div>
                        <div className="mt-2 text-xs font-bold uppercase text-slate-400 bg-slate-100 inline-block px-2 py-1 rounded">{user.role}</div>
                    </div>
                </div>

                {/* Admin Quick Link - Prominent for Admins inside Wealth Portal */}
                {isUserAdmin && onSwitchToAdmin && (
                    <div className="bg-indigo-900 text-white p-4 rounded-xl shadow-lg mb-6 flex justify-between items-center border border-indigo-700">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-2 rounded-lg">
                                <LayoutDashboard className="text-amber-400" size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Admin Controls</h3>
                                <p className="text-xs text-indigo-200">Return to main dashboard directly.</p>
                            </div>
                        </div>
                        <Button variant="wealth" onClick={onSwitchToAdmin} className="bg-white text-indigo-900 hover:bg-indigo-50 border-0">
                            Go to Dashboard
                        </Button>
                    </div>
                )}

                {/* My Listings */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <ListPlus className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-slate-800">My Listings</h3>
                    </div>
                    {myListings.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <p>You haven't listed any items yet.</p>
                            <button onClick={() => setActiveView('create')} className="mt-2 text-indigo-600 font-bold text-sm hover:underline">Create your first listing</button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {myListings.map(item => (
                                <div key={item.id} className="p-4 hover:bg-slate-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden">
                                                <img src={item.images?.[0] || ''} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-900">{item.name}</div>
                                                <div className="text-xs text-slate-500">KES {item.dailyRate}/day</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                item.moderationStatus === 'approved' ? 'bg-green-100 text-green-700' : 
                                                item.moderationStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {item.moderationStatus}
                                            </span>
                                        </div>
                                    </div>
                                    {item.moderationStatus === 'rejected' && item.rejectionReason && (
                                        <div className="mt-2 bg-red-50 border border-red-100 p-2 rounded text-xs text-red-700 flex items-start gap-2">
                                            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                            <div>
                                                <span className="font-bold">Rejected:</span> {item.rejectionReason}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeView === 'rentals' && (
             <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
                 <h2 className="text-2xl font-bold mb-6">My Rentals</h2>
                 {myRentals.length === 0 ? (
                     <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">You have no active rentals.</div>
                 ) : (
                     <div className="space-y-4">
                         {myRentals.map(tx => (
                             <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                                 <div>
                                     <div className="font-bold text-lg">{tx.assetName}</div>
                                     <div className="text-xs text-slate-500">
                                         {new Date(tx.startDate).toLocaleDateString()} - {new Date(tx.endDate || '').toLocaleDateString()}
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <div className="font-bold text-indigo-600">KES {tx.totalCost}</div>
                                     <div className="text-[10px] font-bold uppercase text-slate-400">{tx.status}</div>
                                     <div className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded mt-1">Payment: {tx.depositHeld ? 'ON HOLD' : 'RELEASED'}</div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
        )}

        {activeView === 'create' && (
             <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-500">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Plus className="text-amber-500" /> List New Asset</h2>
                
                {/* AI Analysis Section */}
                <div className="mb-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="text-indigo-600" size={18} />
                        <h3 className="font-bold text-indigo-900 text-sm">AI Auto-Fill & Security Scan</h3>
                    </div>
                    <p className="text-xs text-indigo-700 mb-4">Upload at least 5 images + 1 Proof Video (3s - 60s).</p>
                    
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-4 items-start overflow-x-auto pb-2">
                            {/* Image Upload */}
                            <label className="flex-shrink-0 w-32 h-32 cursor-pointer bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg flex flex-col items-center justify-center transition-all">
                                <Upload className="text-indigo-300 mb-2" />
                                <span className="text-[10px] font-bold text-indigo-500 text-center px-2">Upload 5+ Images</span>
                                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageSelect} />
                            </label>
                            
                            {previewImages.map((img, idx) => (
                                <div key={idx} className="w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 relative">
                                    <img src={img} className="w-full h-full object-cover" />
                                    {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center font-bold">Cover</span>}
                                </div>
                            ))}
                        </div>

                        {/* Video Proof Upload */}
                        <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                            <label className="block text-xs font-bold text-indigo-900 uppercase mb-2">Proof of Ownership Video</label>
                            <div className="flex items-center gap-4">
                                <label className="flex-1 cursor-pointer bg-white border border-slate-300 rounded-lg p-3 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                                    <VideoIcon size={16} className="text-indigo-600"/>
                                    <span className="text-xs font-bold text-slate-600">
                                        {videoProofFile ? `Selected (${videoDuration.toFixed(1)}s)` : 'Upload Video'}
                                    </span>
                                    <input type="file" className="hidden" accept="video/*" onChange={handleVideoSelect} />
                                </label>
                                {videoProofFile && <CheckCircle size={20} className="text-green-500"/>}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                * Video must clearly show the item and proof of ownership. 
                                <span className="font-bold text-indigo-600 ml-1">Accepting duration: 3 to 60 seconds.</span>
                            </p>
                        </div>

                        {previewImages.length > 0 && (
                            <div className="flex justify-between items-center text-xs">
                                <span className={`${previewImages.length >= 5 ? 'text-green-600' : 'text-amber-600'} font-bold`}>
                                    {previewImages.length} images selected (Min 5 required)
                                </span>
                                <button onClick={handleClearImages} className="text-red-500 font-bold hover:underline">Clear Images</button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Asset Title</label>
                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full border p-3 rounded-lg bg-slate-50 focus:bg-white transition-colors" placeholder={isAnalyzing ? "Analyzing images..." : "e.g. Industrial Sewing Machine"} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Category</label>
                            <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full border p-3 rounded-lg bg-slate-50">
                                <option value="">Select...</option>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                             <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Condition</label>
                             <select value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} className="w-full border p-3 rounded-lg bg-slate-50">
                                <option value="">Select...</option>
                                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Daily Rate (KES)</label>
                        <input type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full border p-3 rounded-lg bg-slate-50" placeholder="0.00" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Description</label>
                        <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full border p-3 rounded-lg bg-slate-50" placeholder={isAnalyzing ? "Generating description..." : "Describe key features..."} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Special Handling Instructions (Optional)</label>
                        <textarea 
                            rows={2} 
                            value={formData.specialDetails} 
                            onChange={e => setFormData({...formData, specialDetails: e.target.value})} 
                            className="w-full border p-3 rounded-lg bg-slate-50" 
                            placeholder="e.g. Requires voltage stabilizer, fragile glass components..." 
                        />
                    </div>

                    <div className="pt-4">
                        <Button variant="wealth" onClick={handleSubmitListing} isLoading={isUploading} className="w-full py-4 text-lg shadow-lg">
                            Submit Listing
                        </Button>
                        <p className="text-center text-[10px] text-slate-400 mt-2">
                            AI Validation Active: Misleading listings are rejected immediately.
                        </p>
                    </div>
                </div>
             </div>
        )}
        
        {activeView === 'tools' && <div className="text-center text-slate-500 py-10">Use Business AI tab for Veo and Maps.</div>}
      </main>
    </div>
  );
};

export default WealthPortal;
