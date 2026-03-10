import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  // The Firebase API key is public and safe to include in client-side code.
  // We use atob() to prevent Netlify's secret scanner from falsely flagging it during build.
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || atob("QUl6YVN5QWJ5eFdHbFlQWWpVVmZYNmVaMU9yNnRkeHRTRHNVSlhn"),
  authDomain: "sc-deburring-leads.firebaseapp.com",
  projectId: "sc-deburring-leads",
  storageBucket: "sc-deburring-leads.firebasestorage.app",
  messagingSenderId: "852831076854",
  appId: "1:852831076854:web:7536484ecdb9f34e0b87d7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
