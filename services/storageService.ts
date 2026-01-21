
import { Asset, Transaction, UserProfile, AppSettings, ChatMessage, Product, UserRole, SupportTicket } from '../types';

// --- CONFIGURATION ---
const JSONBIN_BIN_ID = "6949350743b1c97be9fe7467";
const JSONBIN_API_KEY = "$2a$10$4e5y5TVrOfDDryzmJUUigerMTAI8.n5JDP4.vwU/pGhQGz7x7gAme";
const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`;

const CLOUDINARY_CLOUD_NAME = "dwvjtjmxo";
const CLOUDINARY_UPLOAD_PRESET = "dualpower_upload"; 
// Note: API Key (541182386814422) and Secret are typically used for server-side signing. 
// For this client-side demo, we use the unsigned upload preset.

// --- TYPES ---
interface DbSchema {
  users: UserProfile[];
  assets: Asset[];
  transactions: Transaction[];
  nurse_messages: ChatMessage[];
  products: Product[];
  tickets: SupportTicket[];
  settings: AppSettings;
}

const DEFAULT_DB: DbSchema = {
  users: [],
  assets: [],
  transactions: [],
  nurse_messages: [],
  products: [],
  tickets: [],
  settings: { orgName: 'Dual Power Women Hub', logoUrl: '' }
};

// --- CORE STORAGE ENGINE ---

// In-memory cache to reduce API calls
let dbCache: DbSchema | null = null;
let lastFetch = 0;
const CACHE_TTL = 2000; // 2 seconds cache to prevent spamming

const fetchDb = async (): Promise<DbSchema> => {
    const now = Date.now();
    if (dbCache && (now - lastFetch < CACHE_TTL)) {
        return dbCache;
    }

    try {
        const response = await fetch(JSONBIN_URL, {
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.warn("JSONBin Fetch Error:", response.statusText);
            // If bin is empty or new, return default
            return dbCache || DEFAULT_DB;
        }

        const data = await response.json();
        // JSONBin V3 returns data in `record` field
        const record = data.record || DEFAULT_DB;
        
        // Merge with default to ensure all collections exist
        dbCache = { ...DEFAULT_DB, ...record };
        lastFetch = now;
        return dbCache as DbSchema;
    } catch (e) {
        console.error("Storage Read Error:", e);
        return dbCache || DEFAULT_DB;
    }
};

const saveDb = async (newData: DbSchema): Promise<boolean> => {
    // Optimistic update
    dbCache = newData;
    lastFetch = Date.now();

    try {
        const response = await fetch(JSONBIN_URL, {
            method: 'PUT',
            headers: {
                'X-Master-Key': JSONBIN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newData)
        });
        return response.ok;
    } catch (e) {
        console.error("Storage Write Error:", e);
        return false;
    }
};

// --- AUTH SERVICES ---

export const getUserById = async (userId: string): Promise<UserProfile | null> => {
    // 1. Hardcoded Admin Check
    if (userId === 'admin_master_001') {
        return {
            id: 'admin_master_001',
            name: 'Davidson Otieno Omondi',
            email: 'davidsonotienoomondi91@gmail.com',
            phone: '0716602552',
            role: 'admin',
            verified: true,
            approvalStatus: 'approved'
        };
    }

    const db = await fetchDb();
    return db.users.find(u => u.id === userId) || null;
};

export const loginUser = async (email: string, password: string): Promise<UserProfile | string | null> => {
    try {
        // 1. Hardcoded Admin Check
        if (email && email.trim().toLowerCase() === 'davidsonotienoomondi91@gmail.com' && password === 'Rongo@20231234567890') {
            return {
                id: 'admin_master_001',
                name: 'Davidson Otieno Omondi',
                email: 'davidsonotienoomondi91@gmail.com',
                phone: '0716602552',
                role: 'admin',
                verified: true,
                approvalStatus: 'approved'
            };
        }

        const db = await fetchDb();
        const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (user) {
            // In a real app, verify hash. Here we compare plain text for demo.
            // @ts-ignore - Assuming password exists on stored object
            if (user.password === password) {
                 if (user.approvalStatus === 'pending' || user.approvalStatus === 'rejected') {
                     return "Your account is pending Admin approval. Please contact support.";
                 }
                 // Remove password before returning
                 const { password: _, ...safeUser } = user as any;
                 return safeUser as UserProfile;
            }
            return null;
        }
        return null;
    } catch (error) {
        console.error(error);
        return "Connection Error. Please check your internet.";
    }
};

export const registerUser = async (data: { name: string; email: string; phone: string; password: string }): Promise<UserProfile | string> => {
    try {
        const db = await fetchDb();
        
        if (db.users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) return "Email already exists.";
        if (db.users.some(u => u.phone === data.phone)) return "Phone number already exists.";

        const newId = Date.now().toString();
        const newUser = {
            id: newId,
            name: data.name,
            email: data.email.toLowerCase(),
            phone: data.phone,
            password: data.password, // Stored for demo purposes
            role: 'user' as const,
            verified: false,
            approvalStatus: 'pending' as const
        };

        db.users.push(newUser);
        await saveDb(db);

        const { password, ...safeUser } = newUser;
        return safeUser as UserProfile;
    } catch (e) {
        return "Registration Failed. Please try again.";
    }
};

export const resetUserPassword = async (email: string, phone: string, newPassword: string): Promise<boolean> => {
    if (email === 'davidsonotienoomondi91@gmail.com') {
        if (phone !== '0716602552') return false; 
    }

    const db = await fetchDb();
    const userIndex = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase() && u.phone === phone);
    
    if (userIndex >= 0) {
        // @ts-ignore
        db.users[userIndex].password = newPassword;
        await saveDb(db);
        return true;
    }
    return false;
};

export const updateUserProfile = async (updatedUser: UserProfile): Promise<void> => {
    const db = await fetchDb();
    const index = db.users.findIndex(u => u.id === updatedUser.id);
    if (index >= 0) {
        // Preserve password which isn't in UserProfile type
        const existing = db.users[index];
        db.users[index] = { ...existing, ...updatedUser };
        await saveDb(db);
    }
};

export const getAllUsers = async (): Promise<UserProfile[]> => {
    const db = await fetchDb();
    return db.users.map(u => {
        const { password, ...safe } = u as any;
        return safe as UserProfile;
    });
};

export const updateUserStatus = async (userId: string, status: 'approved' | 'rejected') => {
    const db = await fetchDb();
    const index = db.users.findIndex(u => u.id === userId);
    if (index >= 0) {
        db.users[index].approvalStatus = status;
        await saveDb(db);
    }
};

export const updateUserRole = async (userId: string, role: UserRole) => {
    const db = await fetchDb();
    const index = db.users.findIndex(u => u.id === userId);
    if (index >= 0) {
        db.users[index].role = role;
        await saveDb(db);
    }
};

// --- HEALTH SERVICES ---

export const getNurseMessages = async (): Promise<ChatMessage[]> => {
    const db = await fetchDb();
    return db.nurse_messages || [];
};

export const saveNurseMessage = async (msg: ChatMessage) => {
    const db = await fetchDb();
    db.nurse_messages.push(msg);
    await saveDb(db);
};

export const deleteNurseMessage = async (msgId: string) => {
    const db = await fetchDb();
    db.nurse_messages = db.nurse_messages.filter(m => m.id !== msgId);
    await saveDb(db);
};

// --- SHOP SERVICES ---

export const getProducts = async (): Promise<Product[]> => {
    const db = await fetchDb();
    return db.products || [];
};

export const saveProduct = async (product: Product) => {
    const db = await fetchDb();
    const index = db.products.findIndex(p => p.id === product.id);
    if (index >= 0) {
        db.products[index] = product;
    } else {
        db.products.push(product);
    }
    await saveDb(db);
};

export const deleteProduct = async (id: string) => {
    const db = await fetchDb();
    db.products = db.products.filter(p => p.id !== id);
    await saveDb(db);
};

// --- ASSETS & TRANSACTIONS ---

export const getAssets = async (): Promise<Asset[]> => {
    const db = await fetchDb();
    return db.assets || [];
};

export const addAsset = async (asset: Asset): Promise<void> => {
    const db = await fetchDb();
    db.assets.push(asset);
    await saveDb(db);
};

export const updateAsset = async (updatedAsset: Asset): Promise<void> => {
    const db = await fetchDb();
    const index = db.assets.findIndex(a => a.id === updatedAsset.id);
    if (index >= 0) {
        db.assets[index] = updatedAsset;
        await saveDb(db);
    }
};

export const updateAssetStatus = async (id: string, status: 'approved' | 'rejected', reason?: string): Promise<void> => {
    const db = await fetchDb();
    const index = db.assets.findIndex(a => a.id === id);
    if (index >= 0) {
        db.assets[index].moderationStatus = status;
        if (status === 'rejected') db.assets[index].rejectionReason = reason;
        await saveDb(db);
    }
};

export const deleteAsset = async (id: string) => {
    const db = await fetchDb();
    db.assets = db.assets.filter(a => a.id !== id);
    await saveDb(db);
};

export const getTransactions = async (): Promise<Transaction[]> => {
    const db = await fetchDb();
    return (db.transactions || []).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
};

export const createShopOrder = async (product: Product, buyer: UserProfile, deliveryDate: string, location: {lat: number, lng: number, accuracy: number}): Promise<void> => {
    const db = await fetchDb();
    
    // Update Stock
    const pIndex = db.products.findIndex(p => p.id === product.id);
    if (pIndex >= 0 && db.products[pIndex].stock > 0) {
        db.products[pIndex].stock -= 1;
    }

    const txId = Date.now().toString();
    const tx: Transaction = {
        id: txId,
        assetId: product.id,
        assetName: product.name,
        renterId: buyer.id,
        renterName: buyer.name,
        startDate: deliveryDate,
        totalCost: product.price,
        status: 'pending_approval',
        depositHeld: false,
        ownerId: 'SYSTEM_SHOP',
        deliveryLocation: location,
        deliveryNotes: 'Standard Shop Delivery'
    };

    db.transactions.push(tx);
    await saveDb(db);
};

export const rentAsset = async (
    assetId: string, 
    renter: UserProfile, 
    days: number, 
    location: {lat: number, lng: number, accuracy: number}
): Promise<void> => {
    const db = await fetchDb();
    const assetIndex = db.assets.findIndex(a => a.id === assetId);

    if (assetIndex >= 0 && db.assets[assetIndex].status === 'available') {
        // Update Asset
        db.assets[assetIndex].status = 'rented';

        const assetData = db.assets[assetIndex];
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + days);
        const totalCost = assetData.dailyRate * days;

        const txId = Date.now().toString();
        const tx: Transaction = {
            id: txId,
            assetId: assetData.id,
            assetName: assetData.name,
            renterId: renter.id,
            renterName: renter.name,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            totalCost: totalCost,
            status: 'pending_approval',
            depositHeld: true,
            ownerId: assetData.ownerId,
            deliveryLocation: location,
            deliveryNotes: 'Asset Rental Delivery'
        };

        db.transactions.push(tx);
        await saveDb(db);
    }
};

export const updateTransactionStatus = async (txId: string, status: Transaction['status']) => {
    const db = await fetchDb();
    const index = db.transactions.findIndex(t => t.id === txId);
    
    if (index >= 0) {
        db.transactions[index].status = status;
        
        if (status === 'returned') {
            db.transactions[index].endDate = new Date().toISOString();
            db.transactions[index].depositHeld = false;
            
            // Free the asset
            const assetId = db.transactions[index].assetId;
            const aIndex = db.assets.findIndex(a => a.id === assetId);
            if (aIndex >= 0) {
                db.assets[aIndex].status = 'available';
            }
        }
        await saveDb(db);
    }
};

export const returnAsset = async (txId: string): Promise<void> => {
    await updateTransactionStatus(txId, 'returned');
};

// --- TICKETS ---

export const getTickets = async (): Promise<SupportTicket[]> => {
    const db = await fetchDb();
    return (db.tickets || []).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addTicket = async (ticket: SupportTicket) => {
    const db = await fetchDb();
    db.tickets.push(ticket);
    await saveDb(db);
};

export const updateTicket = async (updated: SupportTicket) => {
    const db = await fetchDb();
    const index = db.tickets.findIndex(t => t.id === updated.id);
    if (index >= 0) {
        db.tickets[index] = updated;
        await saveDb(db);
    }
};

// --- SETTINGS ---

export const saveSettings = async (settings: AppSettings) => {
    const db = await fetchDb();
    db.settings = settings;
    await saveDb(db);
};

export const getSettings = async (): Promise<AppSettings> => {
    const db = await fetchDb();
    return db.settings || { orgName: 'Dual Power Women Hub', logoUrl: '' };
};

// --- MEDIA (Cloudinary) ---

export const uploadMedia = async (file: File): Promise<string> => {
  // Use the explicitly provided Cloudinary Cloud Name
  const cloudName = CLOUDINARY_CLOUD_NAME;
  const uploadPreset = CLOUDINARY_UPLOAD_PRESET;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    // Fallback for offline testing
    return URL.createObjectURL(file);
  }
};
