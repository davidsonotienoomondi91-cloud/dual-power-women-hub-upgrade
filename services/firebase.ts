import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Helper to safely access environment variables
const getEnvVar = (key: string) => {
  // 1. Try standard Vite import.meta.env
  // Casting to any to avoid TS errors if types aren't set up for Vite
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  
  // 2. Try process.env (injected by Vite define or present in some envs)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }

  // 3. Fallback to avoid undefined crashes
  return '';
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID')
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
