// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Dán config từ Firebase Console vào đây
const firebaseConfig = {
  apiKey: "AIzaSyAspKG8BldI14yg2tQfh0gIIVY0L1pV_qE",
  authDomain: "chamcongonline-7df7f.firebaseapp.com",
  projectId: "chamcongonline-7df7f",
  storageBucket: "chamcongonline-7df7f.firebasestorage.app",
  messagingSenderId: "80878628372",
  appId: "1:80878628372:web:480137f9899e7997aaa101"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);