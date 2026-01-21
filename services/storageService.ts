
import { Asset, Transaction, UserProfile, AppSettings, ChatMessage, Product, UserRole, SupportTicket } from '../types';

// JSONBin Configuration
const BIN_ID = "6949350743b1c97be9fe7467";
const MASTER_KEY = "$2a$10$4e5y5TVrOfDDryzmJUUigerMTAI8.n5JDP4.vwU/pGhQGz7x7gAme";
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

interface DatabaseSchema {
  users: UserProfile[];
  assets: Asset[];
  transactions: Transaction[];
  nurse_messages: ChatMessage[];
  products: Product[];
  tickets: SupportTicket[];
  settings: AppSettings;
}

// Initial Empty State
const INITIAL_DB: DatabaseSchema = {
  users: [],
  assets: [],
  transactions: [],
  nurse_messages: [],
  products: [],
  tickets: [],
  settings: { orgName: 'Dual Power Women Hub', logoUrl: '' }
};

// --- CORE DATABASE FUNCTIONS ---

/**
 * Fetches the entire database from JSONBin.
 */
const fetchDB = async (): Promise<DatabaseSchema> => {
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'X-Master-Key': MASTER_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch DB');
    }

    const json = await response.json();
    const record = json.record as Partial<DatabaseSchema>;
    
    // Merge with initial structure to ensure all arrays exist
    return { ...INITIAL_DB, ...record };
  } catch (error) {
    console.error("DB Fetch Error:", error);
    return INITIAL_DB;
  }
};

/**
 * Saves the entire database to JSONBin.
 */
const saveDB = async (data: DatabaseSchema): Promise<boolean> => {
  try {
    const response = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'X-Master-Key': MASTER_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.ok;
  } catch (error) {
    console.error("DB Save Error:", error);
    return false;
  }
};

// --- AUTH SERVICES ---

export const loginUser = async (email: string, password: string): Promise<UserProfile | string | null> => {
  try {
    const db = await fetchDB();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (user) {
       // In a real app, passwords should be hashed. Here we compare directly for simplicity.
       // @ts-ignore - Assuming password is stored in the object even if not in type
       if (user.password === password) {
           if (user.approvalStatus === 'pending' || user.approvalStatus === 'rejected') {
               return "Your account is pending Admin approval. Please contact support.";
           }
           const { password: _, ...safeUser } = user as any;
           return safeUser;
       }
       return null;
    }

    // Admin Recovery Backdoor (Seeding)
    if (email === 'davidsonotienoomondi91@gmail.com' && password === 'Rongo@20231234567890') {
        const adminUser = {
            id: 'admin_recovery',
            name: 'Davidson Otieno Omondi',
            email: email,
            phone: '0716602552',
            role: 'admin' as UserRole,
            verified: true,
            approvalStatus: 'approved' as const,
            password: password
        };
        db.users.push(adminUser as any);
        await saveDB(db);
        const { password: _, ...safeAdmin } = adminUser;
        return safeAdmin as UserProfile;
    }

    return null;
  } catch (error) {
    return "Connection Error";
  }
};

export const registerUser = async (data: { name: string; email: string; phone: string; password: string }): Promise<UserProfile | string> => {
  const db = await fetchDB();
  
  if (db.users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return "Email already exists.";
  }

  const newUser = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      password: data.password, // Stored securely in real apps
      role: 'user' as const,
      verified: false,
      approvalStatus: 'pending' as const
  };

  db.users.push(newUser as any);
  await saveDB(db);

  return "Account created! Please wait for Admin approval.";
};

export const resetUserPassword = async (email: string, phone: string, newPassword: string): Promise<boolean> => {
  const db = await fetchDB();
  const userIndex = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase() && u.phone === phone);
  
  if (userIndex !== -1) {
      (db.users[userIndex] as any).password = newPassword;
      await saveDB(db);
      return true;
  }
  return false;
};

export const updateUserProfile = async (updatedUser: UserProfile): Promise<void> => {
    const db = await fetchDB();
    const index = db.users.findIndex(u => u.id === updatedUser.id);
    if (index !== -1) {
        // Preserve password
        const password = (db.users[index] as any).password;
        db.users[index] = { ...updatedUser, password } as any;
        await saveDB(db);
    }
};

// Admin Functions
export const getAllUsers = async (): Promise<UserProfile[]> => {
    const db = await fetchDB();
    return db.users.map(u => {
        const { password, ...safe } = u as any;
        return safe as UserProfile;
    });
};

export const updateUserStatus = async (userId: string, status: 'approved' | 'rejected') => {
    const db = await fetchDB();
    const index = db.users.findIndex(u => u.id === userId);
    if (index !== -1) {
        db.users[index].approvalStatus = status;
        await saveDB(db);
    }
};

export const updateUserRole = async (userId: string, role: UserRole) => {
    const db = await fetchDB();
    const index = db.users.findIndex(u => u.id === userId);
    if (index !== -1) {
        db.users[index].role = role;
        await saveDB(db);
    }
};

// --- HEALTH & NURSE SERVICES ---

export const getNurseMessages = async (): Promise<ChatMessage[]> => {
    const db = await fetchDB();
    return db.nurse_messages || [];
};

export const saveNurseMessage = async (msg: ChatMessage) => {
    const db = await fetchDB();
    if (!db.nurse_messages) db.nurse_messages = [];
    db.nurse_messages.push(msg);
    await saveDB(db);
};

export const deleteNurseMessage = async (msgId: string) => {
    const db = await fetchDB();
    db.nurse_messages = db.nurse_messages.filter(m => m.id !== msgId);
    await saveDB(db);
};

// --- PHARMACY / SHOP SERVICES ---

export const getProducts = async (): Promise<Product[]> => {
    const db = await fetchDB();
    return db.products || [];
};

export const saveProduct = async (product: Product) => {
    const db = await fetchDB();
    const index = db.products.findIndex(p => p.id === product.id);
    if (index !== -1) {
        db.products[index] = product;
    } else {
        db.products.push(product);
    }
    await saveDB(db);
};

export const deleteProduct = async (id: string) => {
    const db = await fetchDB();
    db.products = db.products.filter(p => p.id !== id);
    await saveDB(db);
};

// --- ASSET & ACCOUNTING SERVICES ---

export const getAssets = async (): Promise<Asset[]> => {
    const db = await fetchDB();
    return db.assets || [];
};

export const addAsset = async (asset: Asset): Promise<void> => {
    const db = await fetchDB();
    const newAsset = { ...asset, moderationStatus: asset.moderationStatus || 'pending' };
    db.assets.push(newAsset);
    await saveDB(db);
};

export const updateAsset = async (updatedAsset: Asset): Promise<void> => {
    const db = await fetchDB();
    const index = db.assets.findIndex(a => a.id === updatedAsset.id);
    if (index !== -1) {
        db.assets[index] = updatedAsset;
        await saveDB(db);
    }
};

export const updateAssetStatus = async (id: string, status: 'approved' | 'rejected', reason?: string): Promise<void> => {
    const db = await fetchDB();
    const index = db.assets.findIndex(a => a.id === id);
    if (index !== -1) {
        db.assets[index].moderationStatus = status;
        if (status === 'rejected') db.assets[index].rejectionReason = reason;
        await saveDB(db);
    }
};

export const deleteAsset = async (id: string) => {
    const db = await fetchDB();
    db.assets = db.assets.filter(a => a.id !== id);
    await saveDB(db);
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const db = await fetchDB();
    return (db.transactions || []).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
};

export const rentAsset = async (assetId: string, renter: UserProfile, days: number): Promise<void> => {
    const db = await fetchDB();
    const assetIndex = db.assets.findIndex(a => a.id === assetId);

    if (assetIndex !== -1 && db.assets[assetIndex].status === 'available') {
        // 1. Update Asset
        db.assets[assetIndex].status = 'rented';

        // 2. Calc
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + days);
        const totalCost = db.assets[assetIndex].dailyRate * days;

        // 3. Create Tx
        const tx: Transaction = {
            id: Date.now().toString(),
            assetId: db.assets[assetIndex].id,
            assetName: db.assets[assetIndex].name,
            renterId: renter.id,
            renterName: renter.name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalCost: totalCost,
            status: 'pending_approval',
            depositHeld: true,
            ownerId: db.assets[assetIndex].ownerId
        };
        db.transactions.push(tx);
        
        await saveDB(db);
    }
};

export const updateTransactionStatus = async (txId: string, status: Transaction['status']) => {
    const db = await fetchDB();
    const index = db.transactions.findIndex(t => t.id === txId);
    
    if (index !== -1) {
        db.transactions[index].status = status;
        
        if (status === 'returned') {
            db.transactions[index].endDate = new Date().toISOString();
            db.transactions[index].depositHeld = false;
            
            // Free the asset
            const assetId = db.transactions[index].assetId;
            const assetIndex = db.assets.findIndex(a => a.id === assetId);
            if (assetIndex !== -1) {
                db.assets[assetIndex].status = 'available';
            }
        }
        await saveDB(db);
    }
};

export const returnAsset = async (txId: string): Promise<void> => {
    await updateTransactionStatus(txId, 'returned');
};

// --- SUPPORT TICKETS ---

export const getTickets = async (): Promise<SupportTicket[]> => {
    const db = await fetchDB();
    return (db.tickets || []).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addTicket = async (ticket: SupportTicket) => {
    const db = await fetchDB();
    if (!db.tickets) db.tickets = [];
    db.tickets.push(ticket);
    await saveDB(db);
};

export const updateTicket = async (updated: SupportTicket) => {
    const db = await fetchDB();
    const index = db.tickets.findIndex(t => t.id === updated.id);
    if (index !== -1) {
        db.tickets[index] = updated;
        await saveDB(db);
    }
};

// --- SETTINGS ---

export const saveSettings = async (settings: AppSettings) => {
    const db = await fetchDB();
    db.settings = settings;
    await saveDB(db);
};

export const getSettings = async (): Promise<AppSettings> => {
    const db = await fetchDB();
    return db.settings || { orgName: 'Dual Power Women Hub', logoUrl: '' };
};

// --- MEDIA (Cloudinary) ---

export const uploadMedia = async (file: File): Promise<string> => {
  // Use provided cloud name default or env var
  // @ts-ignore
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME || "dwvjtjmxo";
  // @ts-ignore
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET || "dualpower_upload";

  if (cloudName && uploadPreset) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    try {
      // CHANGED: Use /auto/upload to handle both images and videos
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.secure_url;
    } catch (error) {
      console.error("Cloudinary upload failed:", error);
      return URL.createObjectURL(file); // Fallback for testing/offline
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
