import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

const isPlaceholder = (value) => String(value || '').startsWith('REPLACE_WITH_');

const validateFirebaseConfig = () => {
  const config = window.FIREBASE_WEB_CONFIG || {};
  const vapidKey = window.FIREBASE_VAPID_KEY;

  const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
  for (const key of requiredConfigKeys) {
    if (!config[key] || isPlaceholder(config[key])) {
      throw new Error(`Set FIREBASE_WEB_CONFIG.${key} in admin-dashboard.html`);
    }
  }

  if (!vapidKey || isPlaceholder(vapidKey)) {
    throw new Error('Set FIREBASE_VAPID_KEY in admin-dashboard.html');
  }

  return { config, vapidKey };
};

const ensureServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported in this browser');
  }
  return navigator.serviceWorker.register('/firebase-messaging-sw.js');
};

const generateToken = async () => {
  const { config, vapidKey } = validateFirebaseConfig();

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  const registration = await ensureServiceWorker();
  const app = initializeApp(config);
  const messaging = getMessaging(app);

  onMessage(messaging, (payload) => {
    console.log('[FCM] Foreground notification received:', payload);
    if (window.ui?.toast) {
      const title = payload?.notification?.title || 'Notification';
      window.ui.toast(`${title} received`, 'info');
    }
  });

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('Failed to generate FCM token');
  }

  console.log('[FCM] Token generated from Firebase SDK:', token);
  return token;
};

window.fcmClient = {
  generateToken
};
