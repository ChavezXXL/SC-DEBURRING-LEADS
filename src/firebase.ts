import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbyxWGlYPYjUVfX6eZ1Or6tdxtSDsUJXg",
  authDomain: "sc-deburring-leads.firebaseapp.com",
  projectId: "sc-deburring-leads",
  storageBucket: "sc-deburring-leads.firebasestorage.app",
  messagingSenderId: "852831076854",
  appId: "1:852831076854:web:7536484ecdb9f34e0b87d7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
