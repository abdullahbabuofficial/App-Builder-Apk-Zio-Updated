importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBot3ZyzJNQUqbvXgNDYgx1qDnQ_6Uo0qw',
  authDomain: 'apkzio.firebaseapp.com',
  projectId: 'apkzio',
  storageBucket: 'apkzio.firebasestorage.app',
  messagingSenderId: '225854218526',
  appId: '1:225854218526:web:ea407fb836c076b4b4a90f',
  measurementId: 'G-CGEYCN6ZYM',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'ApkZio';
  const options = {
    body: payload?.notification?.body || '',
    icon: payload?.notification?.icon || '/favicon.ico',
    data: payload?.data || {},
  };
  self.registration.showNotification(title, options);
});

