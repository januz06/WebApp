/* ---------------- Firebase Setup ---------------- */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "learning-adventure-d304a.firebaseapp.com",
    databaseURL: "https://learning-adventure-d304a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "learning-adventure-d304a",
    storageBucket: "learning-adventure-d304a.firebasestorage.app",
    messagingSenderId: "335074826330",
    appId: "1:335074826330:web:f7a6c04e3547c2c84ca063",
    measurementId: "G-40HM1J5GTN"
};

// Initialize Firebase with a modified API URL
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Function to make authenticated requests
async function firebaseRequest(path, options = {}) {
  const response = await fetch(`/firebase-api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error('Firebase request failed');
  }
  
  return response.json();
}

export { auth, firebaseRequest };
