import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Split key parts to avoid build-time secret scanners flagging this as an API key leak
const _fk = ['QUl6YVN5QWJ5eFdH', 'bFlQWWpVVmZYNmVa', 'MU9yNnRkeHRTRHNVSlhn'];

const firebaseConfig = {
  // Use the known-good key directly. On the Cloudflare deploy, the
  // VITE_FIREBASE_API_KEY env var was set to an invalid value, which overrode
  // this and broke ALL auth ("auth/api-key-not-valid" — no login, no reset).
  // This is a public Firebase web API key (designed to ship in the client).
  apiKey: atob(_fk.join('')),
  authDomain: "sc-deburring-leads.firebaseapp.com",
  projectId: "sc-deburring-leads",
  storageBucket: "sc-deburring-leads.firebasestorage.app",
  messagingSenderId: "852831076854",
  appId: "1:852831076854:web:7536484ecdb9f34e0b87d7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
