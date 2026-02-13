// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {

  apiKey: "AIzaSyBz8OQ_p9QtGCPgK4O4OPsoIDoy5p5y3O4",
  authDomain: "qioptimizer.firebaseapp.com",
  projectId: "qioptimizer",
  storageBucket: "qioptimizer.firebasestorage.app",
  messagingSenderId: "440805841077",
  appId: "1:440805841077:web:e3319aadc68f6b7d97c6fc",
  measurementId: "G-QW87E4Z9TK"

};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);