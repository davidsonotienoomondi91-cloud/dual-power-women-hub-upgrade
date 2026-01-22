
import React, { useState, useEffect, useRef } from 'react';
import { Store, Wand2, Plus, MapPin, Video, DollarSign, Image as ImageIcon, Sparkles, CheckCircle, RefreshCw, Search, Briefcase, History, Upload, Shield, User, Filter, AlertCircle, ArrowUpDown, TrendingUp, Package, Truck, Clock, PackageCheck, LogOut, Stethoscope, Settings, ListPlus, HelpCircle, MessageSquare, AlertTriangle, FileText, X, Calendar, Layers, Video as VideoIcon, Info, LayoutDashboard, ShoppingCart, ChevronLeft, ExternalLink, PlayCircle, Edit3, Trash2, Users, Copy, Navigation, Globe, ShoppingBasket, Minus } from 'lucide-react';
import Button from './Button';
import { Asset, GeoLocation, UserProfile, Transaction, SupportTicket } from '../types';
import { analyzeAsset, generateMarketingVideo, findLocalSuppliers, editAssetImage, validateAssetImages, validateKenyanID } from '../services/geminiService';
import { uploadMedia, getAssets, addAsset, updateAsset, deleteAsset, rentAsset, purchaseAsset, getTransactions, returnAsset, updateUserProfile, getTickets, addTicket, getUserById } from '../services/storageService';

const CATEGORIES = ['Tailoring', 'Events', 'Farming', 'Catering', 'Electronics', 'Construction', 'Transport', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Heavy Duty'];

interface WealthPortalProps {
    user: UserProfile;
    onUpdateUser: (updatedUser: UserProfile) => void;
    onSwitchToAdmin?: () => void;
    onSwitchToNurse?: () => void;
}

// Basket Item Interface
interface BasketItem {
    cartId: string;
    asset: Asset;
    type: 'rent' | 'buy';
    days: number; // Only relevant for rent, default 1
}

const WealthPortal: React.FC<WealthPortalProps> = ({ user, onUpdateUser, onSwitchToAdmin, onSwitchToNurse }) => {
  const [activeView, setActiveView] = useState<'market' | 'create' | 'tools' | 'rentals' | 'profile'>('market');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [myRentals, setMyRentals] = useState<Transaction[]>([]);
  
  // Cart/Basket State
  const [cart, setCart] = useState<BasketItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Verification State
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState(false);

  // Rental/Purchase Modal State
  const [selectedAssetForTransaction, setSelectedAssetForTransaction] = useState<Asset | null>(null);
  const [transactionType, setTransactionType] = useState<'rent' | 'buy'>('rent');
  const [rentDays, setRentDays] = useState(1);
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number, accuracy: number} | null>(null);

  // Asset Details View State (New)
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);
  const [viewingOwner, setViewingOwner] = useState<UserProfile | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Tickets
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState<{type: 'complaint' | 'help' | 'return', subject: string, message: string}>({
      type: 'help', subject: '', message: ''
  });

  // Business AI Tool State
  const [toolSubTab, setToolSubTab] = useState<'hub' | 'maps' | 'video'>('hub');
  
  // Business AI - Maps
  const [mapQuery, setMapQuery] = useState('');
  const [mapResults, setMapResults] = useState<any[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [mapSearchText, setMapSearchText] = useState(''); // The text response from AI

  // Business AI - Video
  const [videoToolPrompt, setVideoToolPrompt] = useState('');
  const [videoToolImage, setVideoToolImage] = useState<File | null>(null);
  const [videoToolResult, setVideoToolResult] = useState<string | null>(null);
  const [isVideoToolGenerating, setIsVideoToolGenerating] = useState(false);

  // Sorting & Filtering
  const [sortOrder, setSortOrder] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Create/Edit Listing State
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [videoProofFile, setVideoProofFile] = useState<File | null>(null); 
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [previewImages, setPreviewImages] = useState<string[]>([]); // Array of base64 or URLs
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({ 
      title: '', 
      category: '', 
      condition: '', 
      description: '', 
      price: '', 
      location: '', // New field for Locality
      specialDetails: '',
      listingType: 'rent' as 'rent' | 'sale'
  });

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
  }, [activeView, user.id, showTicketModal, selectedAssetForTransaction, viewingAsset]);

  const filteredAssets = assets
    .filter(a => {
        const matchesStatus = a.moderationStatus === 'approved' && a.status !== 'sold';
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
            a.name.toLowerCase().includes(searchLower) || 
            a.description.toLowerCase().includes(searchLower) ||
            (a.location && a.location.toLowerCase().includes(searchLower)); // Search by Location
        return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
        const priceA = a.listingType === 'sale' ? (a.salePrice || 0) : a.dailyRate;
        const priceB = b.listingType === 'sale' ? (b.salePrice || 0) : b.dailyRate;
        if (sortOrder === 'price-asc') return priceA - priceB;
        if (sortOrder === 'price-desc') return priceB - priceA;
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

  // --- BASKET LOGIC ---

  const handleAddToBasket = (asset: Asset, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      
      // Check if already in cart
      if (cart.some(item => item.asset.id === asset.id)) {
          alert("This item is already in your basket.");
          return;
      }

      const newItem: BasketItem = {
          cartId: Date.now().toString(),
          asset: asset,
          type: asset.listingType === 'sale' ? 'buy' : 'rent',
          days: 1
      };

      setCart([...cart, newItem]);
      // Small visual feedback could be added here
  };

  const handleRemoveFromBasket = (cartId: string) => {
      setCart(cart.filter(item => item.cartId !== cartId));
  };

  const updateBasketItemDays = (cartId: string, days: number) => {
      setCart(cart.map(item => item.cartId === cartId ? { ...item, days: Math.max(1, days) } : item));
  };

  const calculateBasketTotal = () => {
      return cart.reduce((total, item) => {
          if (item.type === 'buy') {
              return total + (item.asset.salePrice || 0);
          } else {
              return total + (item.asset.dailyRate * item.days);
          }
      }, 0);
  };

  const handleBulkCheckout = async () => {
      requireVerification(async () => {
          if (!deliveryCoords) {
              alert("Please enable location services to confirm delivery point.");
              return;
          }

          const totalCost = calculateBasketTotal();
          
          // Simulation Payment
          window.open('https://paywith.nobuk.africa/saacaxzyzb', '_blank');
          alert(`BULK CHECKOUT:\n\nPlease complete payment of KES ${totalCost.toLocaleString()} on the opened tab.`);

          // Process all items
          for (const item of cart) {
              if (item.type === 'buy') {
                  await purchaseAsset(item.asset.id, user, deliveryCoords);
              } else {
                  await rentAsset(item.asset.id, user, item.days, deliveryCoords);
              }
          }

          // Clear and Reset
          setCart([]);
          setIsCartOpen(false);
          setDeliveryCoords(null);
          setAssets(await getAssets()); // Refresh
          const allTx = await getTransactions();
          setMyRentals(allTx.filter(t => t.renterId === user.id));
          setActiveView('rentals');
          alert("Order Placed Successfully! Check 'My Rentals/Purchases' tab.");
      });
  };

  // --------------------

  const handleUploadId = async () => {
      if (!idFrontFile || !idBackFile) {
          alert("Both Front and Back of ID are required.");
          return;
      }
      setIsVerifyingId(true);
      
      try {
          const frontBase64 = await fileToBase64(idFrontFile);
          const backBase64 = await fileToBase64(idBackFile);
          const validation = await validateKenyanID(frontBase64, backBase64);
          
          if (!validation.valid) {
              setIsVerifyingId(false);
              alert(`SECURITY ALERT: ID REJECTED.\n\nREASON: ${validation.reason}\n\nWARNING: Uploading fake identification is a criminal offense under Kenyan Law.`);
              return;
          }

          const frontUrl = await uploadMedia(idFrontFile);
          const backUrl = await uploadMedia(idBackFile);

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

  const onTransactionClick = (asset: Asset) => {
      // Single item direct transaction (Legacy support, but we can direct to cart too. Keeping as direct buy for now)
      requireVerification(() => {
          setSelectedAssetForTransaction(asset);
          setTransactionType(asset.listingType === 'sale' ? 'buy' : 'rent');
          setRentDays(1);
          setDeliveryCoords(null);
          setViewingAsset(null);
      });
  };

  const handleViewAsset = async (asset: Asset) => {
      setViewingAsset(asset);
      setActiveMediaIndex(0);
      setViewingOwner(null);
      
      if (asset.ownerId) {
          const owner = await getUserById(asset.ownerId);
          setViewingOwner(owner);
      }
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

  const confirmTransaction = async () => {
      if (selectedAssetForTransaction && deliveryCoords) {
          const isSale = transactionType === 'buy';
          const cost = isSale ? (selectedAssetForTransaction.salePrice || 0) : (selectedAssetForTransaction.dailyRate * rentDays);

          window.open('https://paywith.nobuk.africa/saacaxzyzb', '_blank');
          alert(`PAYMENT SIMULATION:\n\nPlease complete payment of KES ${cost.toLocaleString()} on the opened tab.`);
          
          if (isSale) {
              await purchaseAsset(selectedAssetForTransaction.id, user, deliveryCoords);
          } else {
              await rentAsset(selectedAssetForTransaction.id, user, rentDays, deliveryCoords);
          }
          
          setSelectedAssetForTransaction(null);
          setRentDays(1);
          setDeliveryCoords(null);
          
          setAssets(await getAssets());
          const allTx = await getTransactions();
          setMyRentals(allTx.filter(t => t.renterId === user.id));
          onUpdateUser({ ...user }); 
          setActiveView('rentals');
      }
  };

  // Image & Video Handlers ... (Keep existing)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setSelectedFiles(prev => [...prev, ...files]);
    const newPreviews: string[] = [];
    for (const file of files) {
        const b64 = await fileToBase64(file);
        newPreviews.push(b64);
    }
    setPreviewImages(prev => [...prev, ...newPreviews]);
    if (!isAnalyzing && newPreviews.length > 0 && !editingAssetId) {
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
              setExistingVideoUrl(null); 
          }
      };
      video.src = URL.createObjectURL(file);
  };

  const handleClearImages = () => {
      setSelectedFiles([]);
      setPreviewImages([]);
  };

  const resetForm = () => {
      setEditingAssetId(null);
      setFormData({ title: '', category: '', condition: '', description: '', price: '', location: '', specialDetails: '', listingType: 'rent' });
      handleClearImages();
      setVideoProofFile(null);
      setExistingVideoUrl(null);
  };

  const handleEditAsset = (asset: Asset) => {
      setEditingAssetId(asset.id);
      setFormData({
          title: asset.name,
          category: asset.category || '',
          condition: asset.condition || '',
          description: asset.description,
          price: asset.listingType === 'sale' ? (asset.salePrice?.toString() || '') : (asset.dailyRate.toString() || ''),
          location: asset.location,
          specialDetails: asset.specialDetails || '',
          listingType: asset.listingType
      });
      setPreviewImages(asset.images);
      setExistingVideoUrl(asset.videoProof);
      setActiveView('create');
  };

  const handleDeleteAsset = async (id: string) => {
      if(window.confirm("Are you sure you want to permanently delete this listing? This cannot be undone.")) {
          await deleteAsset(id);
          const updatedAssets = await getAssets();
          setAssets(updatedAssets);
      }
  };

  // AI & Submission Handlers ... (Keep existing)
  const handleMapSearch = async () => {
    if (!mapQuery.trim()) return;
    setIsSearchingMap(true);
    setMapResults([]);
    try {
        const res = await findLocalSuppliers(mapQuery, { latitude: -1.2921, longitude: 36.8219 });
        setMapSearchText(res.text);
        setMapResults(res.chunks || []);
    } catch (e) {
        setMapSearchText("Could not connect to Google Maps service.");
    }
    setIsSearchingMap(false);
  };

  const handleCreateVideoAd = async () => {
    if (!videoToolPrompt) {
        alert("Please enter a text prompt for your video.");
        return;
    }
    setIsVideoToolGenerating(true);
    setVideoToolResult(null);
    try {
      let imgBytes = undefined;
      if (videoToolImage) {
          const b64 = await fileToBase64(videoToolImage);
          imgBytes = b64.split(',')[1];
      }
      const result = await generateMarketingVideo(videoToolPrompt, imgBytes);
      if (result) {
          setVideoToolResult(result);
      } else {
          alert("Video generation not available. \n\nReason: You may be using the free shared key which does not support Veo.\n\nPlease select a paid API Key from your Google Cloud project using the key selector if prompted.");
      }
    } catch (e) {
        console.error(e);
        alert("An error occurred during generation.");
    }
    setIsVideoToolGenerating(false);
  };

  const handleSubmitListing = async () => {
     requireVerification(async () => {
        if (!formData.title || !formData.category || !formData.condition || !formData.description || !formData.price || !formData.location) {
             alert("INCOMPLETE FORM: Please fill in all required text fields including Location.");
             return;
        }
        if (previewImages.length < 5) {
            alert(`MISSING IMAGES: You must have at least 5 images of the product. Currently: ${previewImages.length}`);
            return;
        }
        if (!videoProofFile && !existingVideoUrl) {
            alert("MISSING PROOF: You must upload a proof of ownership video.");
            return;
        }

        setIsUploading(true);
        let validation: { valid: boolean; reason?: string } = { valid: true, reason: '' };
        if (selectedFiles.length > 0) {
             validation = await validateAssetImages(previewImages, formData.title);
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
        }

        const uploadedImageUrls: string[] = [];
        for (const file of selectedFiles) {
            const url = await uploadMedia(file);
            uploadedImageUrls.push(url);
        }
        
        const keptExistingImages = previewImages.filter(url => url.startsWith('http'));
        const finalImages = [...keptExistingImages, ...uploadedImageUrls];

        let finalVideoUrl = existingVideoUrl || '';
        if (videoProofFile) {
            finalVideoUrl = await uploadMedia(videoProofFile);
        }

        const price = parseInt(formData.price);

        const assetData: Asset = {
            id: editingAssetId || Date.now().toString(), 
            name: formData.title, 
            description: formData.description, 
            location: formData.location, 
            category: formData.category,
            condition: formData.condition,
            specialDetails: formData.specialDetails, 
            listingType: formData.listingType,
            dailyRate: formData.listingType === 'rent' ? price : 0, 
            salePrice: formData.listingType === 'sale' ? price : undefined,
            images: finalImages, 
            videoProof: finalVideoUrl, 
            verified: false, 
            status: 'available', 
            ownerId: user.id, 
            moderationStatus: validation.valid ? 'pending' : 'rejected',
            rejectionReason: validation.valid ? undefined : `AI Rejection: ${validation.reason}`
        };

        if (editingAssetId) {
            await updateAsset(assetData);
            alert("✅ Listing Updated! Pending Admin Re-Approval.");
        } else {
            await addAsset(assetData);
            if (validation.valid) {
                alert("✅ SUCCESS: Listing Submitted! Pending Admin approval.");
            } else {
                alert("⚠️ FLAGGED: Listing sent for Manual Review.");
            }
        }

        setIsUploading(false);
        setActiveView('profile');
        resetForm();
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
      
      {/* --- BASKET DRAWER / MODAL --- */}
      {isCartOpen && (
          <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                      <h2 className="text-xl font-bold flex items-center gap-2"><ShoppingBasket className="text-amber-400"/> Your Basket</h2>
                      <button onClick={() => setIsCartOpen(false)}><X className="text-white/70 hover:text-white"/></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {cart.length === 0 ? (
                          <div className="text-center py-20 text-slate-400">
                              <ShoppingBasket size={48} className="mx-auto mb-4 opacity-50"/>
                              <p>Your basket is empty.</p>
                              <button onClick={() => setIsCartOpen(false)} className="mt-4 text-indigo-600 font-bold hover:underline">Browse Market</button>
                          </div>
                      ) : (
                          cart.map((item) => (
                              <div key={item.cartId} className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex gap-3 relative group">
                                  <img src={item.asset.images[0]} className="w-20 h-20 object-cover rounded-lg bg-slate-100" />
                                  <div className="flex-1">
                                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">{item.type === 'buy' ? 'Purchase' : 'Rental'}</div>
                                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.asset.name}</h4>
                                      
                                      {item.type === 'rent' && (
                                          <div className="flex items-center gap-3 mt-2">
                                              <button onClick={() => updateBasketItemDays(item.cartId, item.days - 1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Minus size={12}/></button>
                                              <span className="text-xs font-bold w-12 text-center">{item.days} Days</span>
                                              <button onClick={() => updateBasketItemDays(item.cartId, item.days + 1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Plus size={12}/></button>
                                          </div>
                                      )}
                                      
                                      <div className="mt-2 font-bold text-indigo-600 text-sm">
                                          KES {(item.type === 'buy' ? (item.asset.salePrice || 0) : (item.asset.dailyRate * item.days)).toLocaleString()}
                                      </div>
                                  </div>
                                  <button onClick={() => handleRemoveFromBasket(item.cartId)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                          ))
                      )}
                  </div>

                  <div className="p-6 bg-slate-50 border-t border-slate-200">
                      {/* Location Picker for Bulk */}
                      <div className="mb-4">
                          {!deliveryCoords ? (
                              <button 
                                  onClick={handleGetLocation}
                                  className="w-full py-3 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-2 text-xs"
                              >
                                  <MapPin size={14} /> Set Delivery Location
                              </button>
                          ) : (
                              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2 rounded-lg border border-green-200 text-xs font-bold justify-center">
                                  <CheckCircle size={14} /> Location Set
                              </div>
                          )}
                      </div>

                      <div className="flex justify-between items-center mb-4">
                          <span className="text-slate-500 font-bold">Total</span>
                          <span className="text-2xl font-black text-slate-900">KES {calculateBasketTotal().toLocaleString()}</span>
                      </div>
                      <Button variant="wealth" className="w-full py-3 shadow-xl" disabled={cart.length === 0} onClick={handleBulkCheckout}>
                          Checkout ({cart.length} Items)
                      </Button>
                  </div>
              </div>
          </div>
      )}

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

      {/* ASSET DETAILS MODAL */}
      {viewingAsset && (
          <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-2 md:p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl w-full max-w-5xl h-full md:h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative">
                  
                  {/* Close Button */}
                  <button 
                      onClick={() => setViewingAsset(null)}
                      className="absolute top-4 right-4 z-20 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-all"
                  >
                      <X size={24}/>
                  </button>

                  {/* Left: Media Gallery */}
                  <div className="md:w-3/5 bg-black flex flex-col justify-center relative">
                      {/* Main Viewer */}
                      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
                          {activeMediaIndex >= (viewingAsset.images?.length || 0) && viewingAsset.videoProof ? (
                              <video controls autoPlay className="w-full h-full object-contain max-h-[60vh] md:max-h-full">
                                  <source src={viewingAsset.videoProof} type="video/mp4"/>
                                  Your browser does not support the video tag.
                              </video>
                          ) : (
                              <img 
                                  src={viewingAsset.images?.[activeMediaIndex] || ''} 
                                  className="w-full h-full object-contain max-h-[60vh] md:max-h-full"
                                  alt="Product View"
                              />
                          )}
                      </div>

                      {/* Thumbnails */}
                      <div className="h-20 bg-black/80 flex items-center gap-2 overflow-x-auto p-2 scrollbar-hide shrink-0">
                          {viewingAsset.images?.map((img, idx) => (
                              <button 
                                  key={idx}
                                  onClick={() => setActiveMediaIndex(idx)}
                                  className={`h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${activeMediaIndex === idx ? 'border-amber-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
                              >
                                  <img src={img} className="w-full h-full object-cover"/>
                              </button>
                          ))}
                          {viewingAsset.videoProof && (
                              <button 
                                  onClick={() => setActiveMediaIndex((viewingAsset.images?.length || 0))}
                                  className={`h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border-2 flex items-center justify-center bg-slate-800 transition-all ${activeMediaIndex >= (viewingAsset.images?.length || 0) ? 'border-amber-500 opacity-100' : 'border-transparent opacity-50 hover:opacity-80'}`}
                              >
                                  <PlayCircle size={24} className="text-white"/>
                              </button>
                          )}
                      </div>
                  </div>

                  {/* Right: Info & Actions */}
                  <div className="md:w-2/5 bg-white flex flex-col h-full overflow-y-auto">
                      <div className="p-6 flex-1 space-y-6">
                          
                          {/* Header */}
                          <div>
                              <div className="flex justify-between items-start">
                                  <div>
                                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{viewingAsset.category} • {viewingAsset.condition}</div>
                                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">{viewingAsset.name}</h2>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-xl md:text-2xl font-black text-indigo-600">
                                          KES {viewingAsset.listingType === 'sale' ? viewingAsset.salePrice?.toLocaleString() : viewingAsset.dailyRate.toLocaleString()}
                                      </div>
                                      {viewingAsset.listingType === 'rent' && <div className="text-xs text-slate-400 font-bold uppercase">Per Day</div>}
                                  </div>
                              </div>
                          </div>

                          {/* Seller Info */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                                  {viewingOwner?.name?.charAt(0) || <User size={18}/>}
                              </div>
                              <div className="flex-1">
                                  <div className="text-xs text-slate-400 font-bold uppercase">Listed By</div>
                                  <div className="font-bold text-slate-900">{viewingOwner?.name || 'Verified Seller'}</div>
                              </div>
                              {viewingOwner?.verified && (
                                  <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                                      <Shield size={10}/> KYC Verified
                                  </div>
                              )}
                          </div>

                          {/* Location Block - Double Verification */}
                          <div className="space-y-3">
                              <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-100 pb-2">Location Intelligence</h3>
                              <div className="flex items-start gap-3">
                                  <MapPin className="text-slate-400 mt-0.5" size={18}/>
                                  <div>
                                      <div className="text-xs font-bold text-slate-500 uppercase">Listed Location</div>
                                      <div className="text-sm font-medium text-slate-900">{viewingAsset.location}</div>
                                  </div>
                              </div>
                              <div className="flex items-start gap-3">
                                  <Navigation className={`mt-0.5 ${viewingOwner?.lastLocation ? 'text-indigo-600' : 'text-slate-300'}`} size={18}/>
                                  <div>
                                      <div className="text-xs font-bold text-slate-500 uppercase">Verified GPS Signal</div>
                                      {viewingOwner?.lastLocation ? (
                                          <div>
                                              <a 
                                                  href={`https://www.google.com/maps?q=${viewingOwner.lastLocation.lat},${viewingOwner.lastLocation.lng}`} 
                                                  target="_blank" 
                                                  rel="noreferrer"
                                                  className="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                              >
                                                  View Real-Time Location <ExternalLink size={12}/>
                                              </a>
                                              <div className="text-[10px] text-slate-400 mt-0.5">
                                                  Last ping: {new Date(viewingOwner.lastLocation.timestamp).toLocaleDateString()}
                                              </div>
                                          </div>
                                      ) : (
                                          <div className="text-sm text-slate-400 italic">GPS data unavailable for this seller.</div>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* Description */}
                          <div>
                              <h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-100 pb-2 mb-2">Description</h3>
                              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{viewingAsset.description}</p>
                          </div>

                          {viewingAsset.specialDetails && (
                              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                  <h4 className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-2"><Info size={14}/> Special Instructions</h4>
                                  <p className="text-xs text-amber-900">{viewingAsset.specialDetails}</p>
                              </div>
                          )}

                      </div>

                      {/* Footer Actions */}
                      <div className="p-6 border-t border-slate-200 bg-slate-50 sticky bottom-0">
                          {viewingAsset.ownerId === user.id ? (
                              <div className="text-center text-sm font-bold text-slate-500 bg-slate-200 py-3 rounded-xl">
                                  You own this listing.
                              </div>
                          ) : (
                              <div className="flex gap-2">
                                  <button 
                                      onClick={(e) => {
                                          handleAddToBasket(viewingAsset, e);
                                          setIsCartOpen(true);
                                          setViewingAsset(null);
                                      }}
                                      className="flex-1 bg-white border border-indigo-200 text-indigo-600 font-bold py-4 rounded-xl hover:bg-indigo-50 shadow-sm transition-colors flex items-center justify-center gap-2"
                                  >
                                      <ShoppingBasket size={20} /> Add to Basket
                                  </button>
                                  <Button 
                                      variant="wealth" 
                                      onClick={() => onTransactionClick(viewingAsset)}
                                      className="flex-1 py-4 text-lg shadow-xl"
                                  >
                                      {viewingAsset.listingType === 'sale' ? 'Purchase Now' : 'Rent This Item'}
                                  </Button>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* RENTAL / BUY CONFIRMATION MODAL */}
      {selectedAssetForTransaction && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      {transactionType === 'buy' ? <ShoppingCart className="text-indigo-600"/> : <Calendar className="text-indigo-600"/>} 
                      {transactionType === 'buy' ? 'Confirm Purchase' : 'Rent Asset'}
                  </h3>
                  <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="font-bold text-slate-900">{selectedAssetForTransaction.name}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {selectedAssetForTransaction.location}</div>
                      <div className="text-sm text-slate-700 font-bold mt-2">
                          {transactionType === 'buy' ? `Price: KES ${selectedAssetForTransaction.salePrice}` : `Rate: KES ${selectedAssetForTransaction.dailyRate} / day`}
                      </div>
                  </div>
                  
                  {selectedAssetForTransaction.specialDetails && (
                      <div className="mb-4 bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-800">
                          <strong className="block mb-1 flex items-center gap-1"><Info size={12}/> Handling Instructions:</strong>
                          {selectedAssetForTransaction.specialDetails}
                      </div>
                  )}
                  
                  {transactionType === 'rent' && (
                      <div className="mb-6">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Number of Days</label>
                          <div className="flex items-center gap-3">
                              <button onClick={() => setRentDays(Math.max(1, rentDays - 1))} className="bg-slate-200 w-10 h-10 rounded-lg font-bold text-lg hover:bg-slate-300">-</button>
                              <div className="flex-1 text-center font-bold text-2xl">{rentDays}</div>
                              <button onClick={() => setRentDays(rentDays + 1)} className="bg-slate-200 w-10 h-10 rounded-lg font-bold text-lg hover:bg-slate-300">+</button>
                          </div>
                      </div>
                  )}

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
                      <span className="text-2xl font-black text-indigo-600">
                          KES {transactionType === 'buy' 
                              ? (selectedAssetForTransaction.salePrice || 0).toLocaleString() 
                              : (selectedAssetForTransaction.dailyRate * rentDays).toLocaleString()}
                      </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setSelectedAssetForTransaction(null)} className="px-4 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                      <Button variant="wealth" onClick={confirmTransaction} disabled={!deliveryCoords}>
                          {transactionType === 'buy' ? 'Buy Now' : 'Confirm Rent'}
                      </Button>
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
             <div className="text-sm font-semibold hidden md:block">Wallet: <span className="text-amber-400 font-mono text-base">KES {myEarnings.toLocaleString()}</span></div>
             
             {/* BASKET TRIGGER */}
             <button 
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 hover:bg-slate-800 rounded-full transition-colors"
             >
                 <ShoppingBasket size={24} className="text-white"/>
                 {cart.length > 0 && (
                     <span className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
                         {cart.length}
                     </span>
                 )}
             </button>
          </div>
        </div>
      </header>

      {/* Navigation - Horizontal Scroll on Mobile */}
      <nav className="bg-white border-b border-slate-200 sticky top-[72px] z-10">
         <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide">
            {[
                { id: 'market', icon: Store, label: 'Marketplace' }, 
                { id: 'rentals', icon: History, label: 'My Rentals/Purchases' }, 
                { id: 'create', icon: Plus, label: editingAssetId ? 'Edit Listing' : 'List Asset' }, 
                { id: 'tools', icon: Wand2, label: 'Business AI' }, 
                { id: 'profile', icon: User, label: 'Profile' }
            ].map(item => (
                <button key={item.id} onClick={() => { setActiveView(item.id as any); setToolSubTab('hub'); if(item.id === 'create') resetForm(); }} className={`px-4 md:px-8 py-4 md:py-5 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeView === item.id ? 'border-indigo-600 text-indigo-900 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                    <item.icon size={18} /> {item.label}
                </button>
            ))}
         </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {activeView === 'market' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between mb-4 gap-2">
                <input 
                    type="text" 
                    placeholder="Search items, locations..." 
                    className="border p-2 rounded w-full md:w-64 text-slate-900"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="border p-2 rounded text-slate-900"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option></select>
            </div>
            {filteredAssets.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <Store className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                    <h3 className="text-lg font-bold text-slate-600">No items available.</h3>
                    <p className="text-slate-500 text-sm mb-4">Try adjusting your search or list an item!</p>
                    <button onClick={() => setActiveView('create')} className="text-indigo-600 font-bold hover:underline">List Item Now</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
                    {filteredAssets.map(asset => (
                        <div 
                            key={asset.id} 
                            onClick={() => handleViewAsset(asset)}
                            className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group cursor-pointer hover:shadow-lg transition-all hover:border-indigo-300 relative"
                        >
                            <div className="h-48 bg-slate-100 relative">
                                <img src={asset.images?.[0] || ''} className="w-full h-full object-cover"/>
                                {asset.status === 'rented' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">RENTED</div>}
                                {asset.images && asset.images.length > 1 && (
                                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                        <Layers size={10}/> +{asset.images.length - 1}
                                    </div>
                                )}
                                <div className="absolute top-2 right-2">
                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase shadow-sm ${
                                        asset.listingType === 'sale' ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-black'
                                    }`}>
                                        {asset.listingType === 'sale' ? 'FOR SALE' : 'FOR RENT'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-slate-900">{asset.name}</h3>
                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                    <MapPin size={12} className="text-slate-400"/> {asset.location || 'Unknown Location'}
                                </div>
                                <div className="flex justify-between items-center mt-4">
                                    <span className="text-indigo-900 font-bold">
                                        KES {asset.listingType === 'sale' ? asset.salePrice : asset.dailyRate}
                                        {asset.listingType === 'rent' && <span className="text-xs font-normal text-slate-500">/day</span>}
                                    </span>
                                    
                                    {/* Action Buttons on Card */}
                                    <div className="flex gap-2">
                                        {asset.ownerId !== user.id && asset.status === 'available' && (
                                            <button 
                                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                onClick={(e) => handleAddToBasket(asset, e)}
                                                title="Add to Basket"
                                            >
                                                <ShoppingBasket size={16} />
                                            </button>
                                        )}
                                        <button 
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm ${asset.listingType === 'sale' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-amber-500 hover:bg-amber-600'}`}
                                            disabled={asset.status !== 'available'} 
                                            onClick={(e) => {
                                                e.stopPropagation(); 
                                                onTransactionClick(asset);
                                            }}
                                        >
                                            {asset.listingType === 'sale' ? 'Buy Now' : 'Rent'}
                                        </button>
                                    </div>
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

                {/* Referral Section (Added here for better visibility) */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-1">
                                <Users size={24} className="text-white"/> Partner Program
                            </h3>
                            <p className="text-amber-100 text-sm mb-4">
                                Invite friends. Earn <span className="font-bold text-white">KES 10</span> when they list their first item.
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg font-mono text-xl font-bold tracking-widest border border-white/30">
                                    {user.referralCode || 'GEN-CODE...'}
                                </div>
                                <button 
                                    onClick={() => {navigator.clipboard.writeText(user.referralCode || ''); alert("Code Copied!")}}
                                    className="p-2 bg-white text-amber-600 rounded-lg hover:bg-amber-50 transition-colors"
                                    title="Copy Code"
                                >
                                    <Copy size={20}/>
                                </button>
                            </div>
                        </div>
                        <div className="text-center md:text-right bg-black/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <div className="text-xs font-bold uppercase opacity-80 mb-1">Total Earnings</div>
                            <div className="text-3xl font-black">KES {(user.referralEarnings || 0).toLocaleString()}</div>
                            <div className="text-[10px] opacity-75 mt-1">Paid via MPESA</div>
                        </div>
                    </div>
                    {/* Decorative background icon */}
                    <Users className="absolute -right-6 -bottom-6 text-white opacity-10 w-48 h-48" />
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
                                <div 
                                    key={item.id} 
                                    onClick={() => handleViewAsset(item)}
                                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                                                <img src={item.images?.[0] || ''} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                                    {item.name}
                                                    <span className={`text-[10px] px-1.5 rounded uppercase font-bold ${item.listingType === 'sale' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                                                        {item.listingType}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    {item.listingType === 'sale' ? `KES ${item.salePrice}` : `KES ${item.dailyRate}/day`}
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1"><MapPin size={10}/> {item.location}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 justify-end w-full md:w-auto">
                                            <div className="text-right mr-2">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                    item.moderationStatus === 'approved' ? 'bg-green-100 text-green-700' : 
                                                    item.moderationStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {item.moderationStatus}
                                                </span>
                                            </div>
                                            
                                            {/* EDIT & DELETE ACTIONS */}
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditAsset(item); }}
                                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                                title="Edit Listing"
                                            >
                                                <Edit3 size={16}/>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteAsset(item.id); }}
                                                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
                                                title="Delete Listing"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
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
                 <h2 className="text-2xl font-bold mb-6">My Rentals & Purchases</h2>
                 {myRentals.length === 0 ? (
                     <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">You have no active transactions.</div>
                 ) : (
                     <div className="space-y-4">
                         {myRentals.map(tx => (
                             <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                                 <div>
                                     <div className="font-bold text-lg">{tx.assetName}</div>
                                     <div className="text-xs text-slate-500 flex gap-2">
                                         {tx.transactionType === 'sale' ? <span className="bg-indigo-100 text-indigo-800 px-1 rounded font-bold uppercase text-[10px]">Purchase</span> : 
                                         <span className="bg-amber-100 text-amber-800 px-1 rounded font-bold uppercase text-[10px]">Rental</span>}
                                         <span>{new Date(tx.startDate).toLocaleDateString()}</span>
                                     </div>
                                 </div>
                                 <div className="text-right">
                                     <div className="font-bold text-indigo-600">KES {tx.totalCost}</div>
                                     <div className="text-[10px] font-bold uppercase text-slate-400">{tx.status}</div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
             </div>
        )}

        {activeView === 'create' && (
             <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        {editingAssetId ? <Edit3 className="text-indigo-600" /> : <Plus className="text-amber-500" />} 
                        {editingAssetId ? 'Edit Listing' : 'List New Asset'}
                    </h2>
                    {editingAssetId && (
                        <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-800 underline">Cancel Edit</button>
                    )}
                </div>
                
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
                                <span className="text-[10px] font-bold text-indigo-500 text-center px-2">
                                    {editingAssetId ? "Add More Images" : "Upload 5+ Images"}
                                </span>
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
                            
                            {existingVideoUrl && !videoProofFile ? (
                                <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-indigo-200">
                                    <div className="flex-1 text-xs text-slate-600 font-bold truncate">Existing Proof Video Loaded</div>
                                    <button 
                                        onClick={() => setExistingVideoUrl(null)} 
                                        className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded font-bold hover:bg-red-200"
                                    >
                                        Replace
                                    </button>
                                </div>
                            ) : (
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
                            )}
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
                    {/* Listing Type Toggle */}
                    <div className="bg-slate-50 p-1 rounded-lg flex border border-slate-200">
                        <button 
                            type="button" 
                            onClick={() => setFormData({...formData, listingType: 'rent'})}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.listingType === 'rent' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            For Rent (Daily Rate)
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setFormData({...formData, listingType: 'sale'})}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${formData.listingType === 'sale' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            For Sale (One-Time Price)
                        </button>
                    </div>

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
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Location (Town/Estate)</label>
                        <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full border p-3 rounded-lg bg-slate-50" placeholder="e.g. Nairobi, Westlands" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                            {formData.listingType === 'sale' ? 'Selling Price (KES)' : 'Daily Rental Rate (KES)'}
                        </label>
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
                            {editingAssetId ? 'Update Listing' : `Submit ${formData.listingType === 'sale' ? 'Sale' : 'Rental'} Listing`}
                        </Button>
                        <p className="text-center text-[10px] text-slate-400 mt-2">
                            AI Validation Active: Misleading listings are rejected immediately.
                        </p>
                    </div>
                </div>
             </div>
        )}
        
        {activeView === 'tools' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
                {toolSubTab === 'hub' && (
                    <div className="space-y-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-indigo-900 mb-2">Business AI Studio</h2>
                            <p className="text-slate-500">Advanced generative tools to scale your business.</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Card 1: Market Finder */}
                            <div 
                                onClick={() => setToolSubTab('maps')}
                                className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 hover:border-indigo-300 hover:shadow-xl transition-all cursor-pointer group"
                            >
                                <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-indigo-600">
                                    <MapPin size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">Market Finder</h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    Locate suppliers, wholesalers, and market hotspots instantly using Google Maps Grounding.
                                </p>
                                <div className="text-indigo-600 font-bold text-xs flex items-center gap-1 uppercase tracking-wide">
                                    Launch Tool <ExternalLink size={12} />
                                </div>
                            </div>

                            {/* Card 2: Ad Creator */}
                            <div 
                                onClick={() => setToolSubTab('video')}
                                className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer group text-white"
                            >
                                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform backdrop-blur-sm">
                                    <VideoIcon size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Ad Studio (Veo)</h3>
                                <p className="text-sm text-indigo-200 mb-4">
                                    Generate professional marketing videos from text or images using Google Veo AI.
                                </p>
                                <div className="text-white font-bold text-xs flex items-center gap-1 uppercase tracking-wide">
                                    Open Studio <PlayCircle size={12} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MAPS TOOL INTERFACE */}
                {toolSubTab === 'maps' && (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center gap-3">
                            <button onClick={() => setToolSubTab('hub')} className="p-2 hover:bg-white rounded-full transition-colors">
                                <ChevronLeft className="text-indigo-900"/>
                            </button>
                            <h3 className="font-bold text-indigo-900">Market & Supplier Finder</h3>
                        </div>
                        
                        <div className="p-6">
                            <div className="flex gap-2 mb-6">
                                <input 
                                    type="text" 
                                    className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-3 focus:border-indigo-500 focus:outline-none transition-colors"
                                    placeholder="e.g. 'Wholesale fabric suppliers in Eastleigh, Nairobi' or 'Electronics market'"
                                    value={mapQuery}
                                    onChange={(e) => setMapQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleMapSearch()}
                                />
                                <Button variant="wealth" onClick={handleMapSearch} isLoading={isSearchingMap}>
                                    Search
                                </Button>
                            </div>

                            {/* Results Area */}
                            <div className="space-y-4">
                                {isSearchingMap && (
                                    <div className="text-center py-10 text-slate-400">
                                        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                        Searching Google Maps...
                                    </div>
                                )}

                                {!isSearchingMap && mapResults.length > 0 && (
                                    <>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap mb-4">
                                            {mapSearchText}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {mapResults.map((chunk, idx) => (
                                                <a 
                                                    key={idx} 
                                                    href={chunk.web?.uri || chunk.maps?.googleMapsUri || '#'} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="block p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group"
                                                >
                                                    <div className="font-bold text-indigo-900 group-hover:underline flex items-center gap-2">
                                                        <MapPin size={16} className="text-indigo-500"/>
                                                        {chunk.web?.title || "Map Result"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1 truncate">
                                                        {chunk.web?.uri || "View on Google Maps"}
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {!isSearchingMap && mapResults.length === 0 && mapSearchText && (
                                    <div className="text-center py-10 text-slate-500">
                                        {mapSearchText}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* VIDEO TOOL INTERFACE */}
                {toolSubTab === 'video' && (
                    <div className="bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden border border-slate-800">
                        <div className="bg-white/5 p-4 border-b border-white/10 flex items-center gap-3">
                            <button onClick={() => setToolSubTab('hub')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
                                <ChevronLeft />
                            </button>
                            <div>
                                <h3 className="font-bold text-lg">Veo Ad Studio</h3>
                                <p className="text-xs text-slate-400">Powered by Google Veo-3.1</p>
                            </div>
                        </div>

                        <div className="p-6 md:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Controls */}
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-indigo-300 uppercase mb-2">Video Prompt</label>
                                        <textarea 
                                            rows={4}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
                                            placeholder="Describe the video you want. E.g., 'Cinematic slow motion shot of a refreshing fruit juice bottle with water droplets, sunny background'."
                                            value={videoToolPrompt}
                                            onChange={(e) => setVideoToolPrompt(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-indigo-300 uppercase mb-2">Reference Image (Optional)</label>
                                        <div className="flex items-center gap-4">
                                            <label className="flex-1 cursor-pointer bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
                                                <ImageIcon size={20} className="text-indigo-400"/>
                                                <span className="text-sm font-medium text-slate-300">
                                                    {videoToolImage ? "Change Image" : "Upload Image"}
                                                </span>
                                                <input type="file" className="hidden" accept="image/*" onChange={(e) => setVideoToolImage(e.target.files?.[0] || null)} />
                                            </label>
                                            {videoToolImage && (
                                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-600 relative group">
                                                    <img src={URL.createObjectURL(videoToolImage)} className="w-full h-full object-cover"/>
                                                    <button 
                                                        onClick={() => setVideoToolImage(null)}
                                                        className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={16} className="text-white"/>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <Button 
                                        variant="wealth" 
                                        className="w-full py-4 text-lg bg-indigo-600 hover:bg-indigo-500 border-0"
                                        onClick={handleCreateVideoAd}
                                        isLoading={isVideoToolGenerating}
                                    >
                                        Generate Video
                                    </Button>
                                    
                                    <p className="text-xs text-slate-500 text-center">
                                        Note: Requires a supported Google Cloud Project with Veo access. 
                                        Standard generation takes 1-2 minutes.
                                    </p>
                                </div>

                                {/* Preview Area */}
                                <div className="bg-black/50 rounded-xl border border-slate-800 flex items-center justify-center min-h-[300px] relative overflow-hidden">
                                    {isVideoToolGenerating && (
                                        <div className="text-center p-8">
                                            <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                                            <h4 className="font-bold text-white mb-2">Generating Video...</h4>
                                            <p className="text-slate-400 text-sm">This may take a moment. Veo is rendering your vision.</p>
                                        </div>
                                    )}

                                    {!isVideoToolGenerating && !videoToolResult && (
                                        <div className="text-center text-slate-600">
                                            <VideoIcon size={48} className="mx-auto mb-4 opacity-50"/>
                                            <p>Your generated video will appear here.</p>
                                        </div>
                                    )}

                                    {!isVideoToolGenerating && videoToolResult && (
                                        <video controls autoPlay loop className="w-full h-full object-contain">
                                            <source src={videoToolResult} type="video/mp4"/>
                                            Your browser does not support the video tag.
                                        </video>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
};

export default WealthPortal;
