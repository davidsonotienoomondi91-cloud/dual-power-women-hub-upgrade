
export enum Segment {
  LANDING = 'LANDING',
  HEALTH = 'HEALTH',
  WEALTH = 'WEALTH',
  ADMIN = 'ADMIN',
  LOGIN = 'LOGIN'
}

export type UserRole = 'admin' | 'nurse' | 'user';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  verified: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected'; // Admin approval status
  idDocumentFront?: string; // URL of ID Front
  idDocumentBack?: string;  // URL of ID Back
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'nurse';
  text: string;
  timestamp: Date;
  isEscalated?: boolean;
  isSaved?: boolean; // For Nurse to save critical messages
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  category: 'hygiene' | 'wellness';
}

export interface Asset {
  id: string;
  name: string;
  description: string;
  specialDetails?: string; // Optional handling instructions
  dailyRate: number;
  images: string[]; 
  videoProof: string; // URL/Base64 of the 15-18s proof video
  videoUrl?: string; // Generated marketing video (Veo)
  verified: boolean;
  ownerId?: string;
  status: 'available' | 'rented' | 'maintenance';
  moderationStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string; // Reason for rejection by admin or AI
}

export interface Transaction {
  id: string;
  assetId: string;
  assetName: string;
  renterId: string;
  renterName: string;
  startDate: string;
  endDate?: string;
  totalCost: number;
  status: 'active' | 'returned' | 'disputed' | 'pending_approval' | 'in_transit' | 'delivered';
  depositHeld: boolean;
  ownerId?: string; 
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  type: 'complaint' | 'help' | 'return';
  subject: string;
  message: string;
  status: 'pending' | 'resolved';
  adminReply?: string;
  createdAt: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface AppSettings {
  logoUrl?: string;
  orgName: string;
}
