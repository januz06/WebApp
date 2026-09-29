/* ---------------- Firebase Setup ---------------- */
const firebaseConfig = {
    apiKey: "AIzaSyAcrdkfITm86mI7GpB2quf2f21uW1N5NhA",
    authDomain: "learning-adventure-d304a.firebaseapp.com",
    databaseURL: "https://learning-adventure-d304a-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "learning-adventure-d304a",
    storageBucket: "learning-adventure-d304a.firebasestorage.app",
    messagingSenderId: "335074826330",
    appId: "1:335074826330:web:f7a6c04e3547c2c84ca063",
    measurementId: "G-40HM1J5GTN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();