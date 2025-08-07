// Import fungsi yang dibutuhkan dari Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// JANGAN LUPA GANTI DENGAN KONFIGURASI FIREBASE ANDA
const firebaseConfig = {
    apiKey: "AIzaSyD8HjXwynugy5q-_KlqLajw27PDgUJ4QUk",
    authDomain: "bubuwi-pro.firebaseapp.com",
    projectId: "bubuwi-pro",
    storageBucket: "bubuwi-pro.firebasestorage.app",
    messagingSenderId: "741891119074",
    appId: "1:741891119074:web:93cc65fb2cd94033aa4bbb"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Event listener ini akan mencari tombol login di halaman manapun
// dan menjalankan proses login saat diklik.
document.addEventListener('click', (e) => {
    // Cek apakah elemen yang diklik memiliki ID 'loginBtn'
    if (e.target && e.target.id === 'loginBtn') {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider)
            .then((result) => {
                // Setelah login berhasil, kita reload halaman.
                // Ini akan membuat request baru ke server, dan server akan tahu
                // bahwa kita sudah login dan memberikan halaman yang sesuai.
                window.location.reload();
            })
            .catch((error) => {
                console.error("Login Gagal:", error);
                alert("Gagal login: " + error.message);
            });
    }

    // Anda bisa menambahkan listener untuk tombol logout di sini juga
    if (e.target && e.target.id === 'logoutBtn') {
        // Logika untuk logout
    }
});
