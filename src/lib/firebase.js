import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export async function initFirebase(config) {
  const existing = getApps().find(a => a.name === 'homelist');
  if (existing) {
    try { await deleteApp(existing); } catch {}
  }
  const app = initializeApp(config, 'homelist');
  return { db: getFirestore(app), auth: getAuth(app) };
}
