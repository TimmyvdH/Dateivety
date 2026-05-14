importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDBjkY2rT8DotNBFPYkzgXcmelPPkqSTV4",
  authDomain: "dateivety-6bab6.firebaseapp.com",
  projectId: "dateivety-6bab6",
  storageBucket: "dateivety-6bab6.firebasestorage.app",
  messagingSenderId: "854384318411",
  appId: "1:854384318411:web:3d68ba6658fbc79d81484e"
});

const messaging = firebase.messaging();

// Meldingen ontvangen terwijl de app op de achtergrond is
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'Dateivety', {
    body: n.body || '',
    icon: n.icon || '/Dateivety/icon-192.png'
  });
});
