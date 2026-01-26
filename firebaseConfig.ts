// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// 🔥 KEY CHÍNH XÁC TỪ FIREBASE CONSOLE - SỬA LỖI ĐĂNG NHẬP
const firebaseConfig = {
  apiKey: "AIzaSyAspKG80Ld1T4yg2tQfh0gIIVY0L1pV_qE",
  authDomain: "chamcongonline-7df7f.firebaseapp.com",
  projectId: "chamcongonline-7df7f",
  storageBucket: "chamcongonline-7df7f.firebasestorage.app",
  messagingSenderId: "80878628372",
  appId: "1:80878628372:web:480137f9899e7997aa8101"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

export default app;
