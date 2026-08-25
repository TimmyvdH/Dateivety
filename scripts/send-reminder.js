#!/usr/bin/env node
/**
 * scripts/send-reminder.js
 *
 * Stuurt een pushmelding naar alle gebruikers die meldingen hebben ingeschakeld
 * (notificationsEnabled === true in Firestore, met een geldig fcmToken).
 *
 * Draait ALLEEN handmatig via de GitHub Actions workflow
 * (.github/workflows/send-reminder.yml, "Run workflow"-knop) — er staat bewust
 * geen schedule op, zodat dit nooit vanzelf op een vast moment afgaat.
 *
 * Vereist de secret FIREBASE_SERVICE_ACCOUNT (de volledige JSON van een
 * Firebase service-account-sleutel) als GitHub Actions-secret op de repo.
 */

const admin = require('firebase-admin');

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT secret ontbreekt.');
  process.exit(1);
}

const serviceAccount = JSON.parse(raw);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const MESSAGE_TITLE = 'Dateivety';
const MESSAGE_BODY = 'Zin in een date dit weekend? 💛 Kies in 30 seconden iets leuks.';

async function main() {
  const db = admin.firestore();
  const snap = await db.collection('users')
    .where('notificationsEnabled', '==', true)
    .get();

  const tokens = snap.docs
    .map(d => d.data().fcmToken)
    .filter(Boolean);

  if (!tokens.length) {
    console.log('Geen gebruikers met meldingen aan — niets verstuurd.');
    return;
  }

  const message = {
    notification: { title: MESSAGE_TITLE, body: MESSAGE_BODY },
    tokens,
  };

  const res = await admin.messaging().sendEachForMulticast(message);
  console.log(`Verstuurd naar ${tokens.length} gebruiker(s): ${res.successCount} gelukt, ${res.failureCount} mislukt.`);
  res.responses.forEach((r, i) => {
    if (!r.success) console.log(`  mislukt voor token ${i}: ${r.error && r.error.message}`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
