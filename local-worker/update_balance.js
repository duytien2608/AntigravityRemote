require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyD_3Fnb9VOiHlpu17xTmczd8fKC_UJZx7U",
  authDomain: "antigravityremote.firebaseapp.com",
  projectId: "antigravityremote",
  storageBucket: "antigravityremote.firebasestorage.app",
  messagingSenderId: "86927756991",
  appId: "1:86927756991:web:eacab4b4e122fc32b2400a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'users'), where('email', '==', 'tondz2905@gmail.com'));
  const snap = await getDocs(q);
  if (snap.empty) {
      console.log('No user found');
      return;
  }
  
  for (const d of snap.docs) {
      await updateDoc(doc(db, 'users', d.id), {
          balance: 10000000000
      });
      console.log('Success! Added 10 billion to ' + d.id);
  }
}

run().then(() => {
    setTimeout(() => process.exit(0), 1000);
}).catch(console.error);
