import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔥 DÙNG KEY CHÍNH XÁC TỪ FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyAspK68BLdI14ygZtQfh6gIIVY0L1pV_qE",
  authDomain: "chamcongonline-7df7f.firebaseapp.com",
  projectId: "chamcongonline-7df7f",
  storageBucket: "chamcongonline-7df7f.firebasestorage.app",
  messagingSenderId: "80878628372",
  appId: "1:80878628372:web:480137f9899e7997aa8101"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;