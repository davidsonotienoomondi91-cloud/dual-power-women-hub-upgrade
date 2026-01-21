
import { Asset, Transaction, UserProfile, AppSettings, ChatMessage, Product, UserRole, SupportTicket } from '../types';

// Helper to safely access env vars
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return typeof process !== 'undefined' ? process.env[key] : '';
  } catch (e) {
    return '';
  }
};

// --- MOCK DATABASE ---

const INITIAL_ASSETS: Asset[] = [];
const INITIAL_PRODUCTS: Product[] = [];

// Extended User Interface for internal storage (includes password)
interface StoredUser extends UserProfile {
  password?: string;
}

const MOCK_USERS: StoredUser[] = [
  { 
    id: 'u1', 
    name: 'Mama Fatuma', 
    email: 'user@dualpower.ke', 
    phone: '0700000000',
    role: 'user', 
    verified: false,
    approvalStatus: 'approved', 
    idDocumentFront: undefined,
    idDocumentBack: undefined,
    password: 'User@1234567890'
  },
  { 
    id: 'a1', 
    name: 'Davidson Otieno Omondi', 
    email: 'davidsonotienoomondi91@gmail.com', 
    // This is the private recovery number, hidden from public UI.
    phone: '0716602552',
    role: 'admin', 
    verified: true,
    approvalStatus: 'approved',
    idDocumentFront: 'https://via.placeholder.com/150',
    idDocumentBack: 'https://via.placeholder.com/150',
    password: 'Rongo@20231234567890' 
  },
  { 
    id: 'n1', 
    name: 'Sister Mary (Nurse)', 
    email: 'nurse@dualpower.ke', 
    phone: '0711111111',
    role: 'nurse', 
    verified: true,
    approvalStatus: 'approved',
    password: 'Nurse@1234567890'
  },
];

// --- AUTH SERVICES ---

// Helper to get users from storage or init
const getUsers = (): StoredUser[] => {
    const stored = localStorage.getItem('app_users_v2');
    if (stored) return JSON.parse(stored);
    // Initialize with mock users if empty
    localStorage.setItem('app_users_v2', JSON.stringify(MOCK_USERS));
    return MOCK_USERS;
};

const saveUsers = (users: StoredUser[]) => {
    localStorage.setItem('app_users_v2', JSON.stringify(users));
};

export const loginUser = async (email: string, password: string): Promise<UserProfile | string | null> => {
  await new Promise(r => setTimeout(r, 800)); // Simulate network
  const users = getUsers();
  
  // Find user by email
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  // Verify password
  if (user && user.password === password) {
     if (user.approvalStatus === 'pending' || user.approvalStatus === 'rejected') {
         return "Your account is pending Admin approval. Please contact support.";
     }
     // Return user without password field
     const { password: _, ...safeUser } = user;
     return safeUser;
  }
  return null;
};

export const registerUser = async (data: { name: string; email: string; phone: string; password: string }): Promise<UserProfile | string> => {
  await new Promise(r => setTimeout(r, 800));
  const users = getUsers();
  
  // Check duplicates
  if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return "Email already exists.";
  }
  
  // Create new user
  const newUser: StoredUser = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: 'user',
      verified: false,
      approvalStatus: 'pending' // Default to pending for Admin approval
  };
  
  saveUsers([...users, newUser]);
  
  // We return a string message indicating pending state, or the object
  return "Account created! Please wait for Admin approval to login.";
};

export const resetUserPassword = async (email: string, phone: string, newPassword: string): Promise<boolean> => {
  await new Promise(r => setTimeout(r, 1500)); // Simulate processing
  const users = getUsers();
  
  // Find user matching BOTH email and phone
  const index = users.findIndex(u => 
      u.email.toLowerCase() === email.trim().toLowerCase() && 
      u.phone === phone.trim()
  );

  if (index > -1) {
      users[index].password = newPassword;
      saveUsers(users);
      return true;
  }
  return false;
};

export const updateUserProfile = (updatedUser: UserProfile): void => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === updatedUser.id);
    if (index > -1) {
        // Preserve password when updating profile
        users[index] = { ...users[index], ...updatedUser };
        saveUsers(users);
    }
};

export const updateUserLocation = (userId: string, lat: number, lng: number) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index > -1) {
        users[index].lastLocation = {
            lat,
            lng,
            timestamp: new Date().toISOString()
        };
        saveUsers(users);
    }
};

// Admin Functions
export const getAllUsers = (): UserProfile[] => {
    return getUsers().map(({ password, ...user }) => user);
};

export const updateUserStatus = (userId: string, status: 'approved' | 'rejected') => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index > -1) {
        users[index].approvalStatus = status;
        saveUsers(users);
    }
};

export const updateUserRole = (userId: string, role: UserRole) => {
    const users = getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index > -1) {
        users[index].role = role;
        saveUsers(users);
    }
};

// --- HEALTH & NURSE SERVICES ---

export const getNurseMessages = (): ChatMessage[] => {
    const stored = localStorage.getItem('nurse_messages_db');
    if (stored) return JSON.parse(stored);
    return [];
};

export const saveNurseMessage = (msg: ChatMessage) => {
    const msgs = getNurseMessages();
    const existingIndex = msgs.findIndex(m => m.id === msg.id);
    if (existingIndex >= 0) {
        msgs[existingIndex] = msg;
    } else {
        msgs.push(msg);
    }
    localStorage.setItem('nurse_messages_db', JSON.stringify(msgs));
};

export const deleteNurseMessage = (msgId: string) => {
    const msgs = getNurseMessages();
    const filtered = msgs.filter(m => m.id !== msgId);
    localStorage.setItem('nurse_messages_db', JSON.stringify(filtered));
};

// --- PHARMACY / SHOP SERVICES ---

export const getProducts = (): Product[] => {
    const stored = localStorage.getItem('pharmacy_products');
    if (stored) return JSON.parse(stored);
    localStorage.setItem('pharmacy_products', JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
};

export const saveProduct = (product: Product) => {
    const products = getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) {
        products[index] = product;
    } else {
        products.push(product);
    }
    localStorage.setItem('pharmacy_products', JSON.stringify(products));
};

export const deleteProduct = (id: string) => {
    const products = getProducts().filter(p => p.id !== id);
    localStorage.setItem('pharmacy_products', JSON.stringify(products));
};

// --- ASSET & ACCOUNTING SERVICES ---

export const getAssets = (): Asset[] => {
  const stored = localStorage.getItem('wealth_assets');
  if (stored) return JSON.parse(stored);
  return INITIAL_ASSETS;
};

export const addAsset = (asset: Asset): void => {
  const current = getAssets();
  // New assets are pending by default
  const newAsset = { ...asset, moderationStatus: asset.moderationStatus || 'pending' };
  const updated = [newAsset, ...current];
  localStorage.setItem('wealth_assets', JSON.stringify(updated));
};

export const updateAsset = (updatedAsset: Asset): void => {
    const assets = getAssets();
    const index = assets.findIndex(a => a.id === updatedAsset.id);
    if (index > -1) {
        assets[index] = updatedAsset;
        localStorage.setItem('wealth_assets', JSON.stringify(assets));
    }
};

// UPDATED: Now accepts optional rejection reason
export const updateAssetStatus = (id: string, status: 'approved' | 'rejected', reason?: string): void => {
    const assets = getAssets();
    const index = assets.findIndex(a => a.id === id);
    if (index > -1) {
        assets[index].moderationStatus = status;
        if (status === 'rejected' && reason) {
            assets[index].rejectionReason = reason;
        } else {
            assets[index].rejectionReason = undefined; // Clear reason if approved
        }
        localStorage.setItem('wealth_assets', JSON.stringify(assets));
    }
};

export const deleteAsset = (id: string) => {
    const assets = getAssets().filter(a => a.id !== id);
    localStorage.setItem('wealth_assets', JSON.stringify(assets));
};

export const getTransactions = (): Transaction[] => {
  const stored = localStorage.getItem('accounting_ledger');
  if (stored) return JSON.parse(stored);
  return [];
};

export const rentAsset = (assetId: string, renter: UserProfile, days: number): void => {
  const assets = getAssets();
  const assetIndex = assets.findIndex(a => a.id === assetId);
  
  if (assetIndex > -1 && assets[assetIndex].status === 'available') {
    // 1. Update Asset Status
    assets[assetIndex].status = 'rented';
    localStorage.setItem('wealth_assets', JSON.stringify(assets));

    // 2. Calculate Dates & Cost
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + days);
    
    const totalCost = assets[assetIndex].dailyRate * days;

    // 3. Create Transaction Record (Safe Accounting)
    const tx: Transaction = {
      id: Date.now().toString(),
      assetId: assets[assetIndex].id,
      assetName: assets[assetIndex].name,
      renterId: renter.id,
      renterName: renter.name,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalCost: totalCost,
      status: 'pending_approval', // Starts as pending order (Money held)
      depositHeld: true,
      ownerId: assets[assetIndex].ownerId
    };
    
    const ledger = getTransactions();
    localStorage.setItem('accounting_ledger', JSON.stringify([tx, ...ledger]));
  }
};

export const updateTransactionStatus = (txId: string, status: Transaction['status']) => {
    const ledger = getTransactions();
    const index = ledger.findIndex(t => t.id === txId);
    if (index > -1) {
        ledger[index].status = status;
        if (status === 'returned') {
            ledger[index].endDate = new Date().toISOString();
            ledger[index].depositHeld = false;
            
            // Free up asset
            const assets = getAssets();
            const aIdx = assets.findIndex(a => a.id === ledger[index].assetId);
            if (aIdx > -1) {
                assets[aIdx].status = 'available';
                localStorage.setItem('wealth_assets', JSON.stringify(assets));
            }
        }
        localStorage.setItem('accounting_ledger', JSON.stringify(ledger));
    }
};

export const returnAsset = (txId: string): void => {
  updateTransactionStatus(txId, 'returned');
};

// --- SUPPORT TICKETS ---

export const getTickets = (): SupportTicket[] => {
    const stored = localStorage.getItem('app_support_tickets');
    if (stored) return JSON.parse(stored);
    return [];
};

export const addTicket = (ticket: SupportTicket) => {
    const tickets = getTickets();
    localStorage.setItem('app_support_tickets', JSON.stringify([ticket, ...tickets]));
};

export const updateTicket = (updated: SupportTicket) => {
    const tickets = getTickets();
    const idx = tickets.findIndex(t => t.id === updated.id);
    if (idx > -1) {
        tickets[idx] = updated;
        localStorage.setItem('app_support_tickets', JSON.stringify(tickets));
    }
};

// --- SETTINGS & BRANDING ---

export const saveSettings = (settings: AppSettings) => {
  localStorage.setItem('app_settings', JSON.stringify(settings));
};

export const getSettings = (): AppSettings => {
  const stored = localStorage.getItem('app_settings');
  if (stored) return JSON.parse(stored);
  return { orgName: 'Dual Power Women Hub', logoUrl: '' };
};

// --- MEDIA ---

export const uploadMedia = async (file: File): Promise<string> => {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const uploadPreset = getEnv('CLOUDINARY_UPLOAD_PRESET');

  if (cloudName && uploadPreset) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Cloudinary upload failed:", error);
      return URL.createObjectURL(file);
    }
  } else {
    // Local fallback
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
};
