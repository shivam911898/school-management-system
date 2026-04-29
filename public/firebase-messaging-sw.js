/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyClsJrgev4BIqGZ2VK6VfYC-DayQdudp0c",
  authDomain: "school-management-14dad.firebaseapp.com",
  projectId: "school-management-14dad",
  messagingSenderId: "218547620799",
  appId: "1:218547620799:web:f14a11c8709665aa2e2f0a",
};

const hasPlaceholders = Object.values(firebaseConfig).some((value) => String(value).startsWith('REPLACE_WITH_'));

if (!hasPlaceholders) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM] Background notification received:', payload);

    const title = payload?.notification?.title || 'Notification';
    const options = {
      body: payload?.notification?.body || '',
      data: payload?.data || {}
    };

    self.registration.showNotification(title, options);
  });
}
