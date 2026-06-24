const { db, admin } = require('./firebaseAdmin');

async function addBalance() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', 'tondz2905@gmail.com').get();
  
  if (snapshot.empty) {
    console.log('No user found with that email.');
    return;
  }

  for (const doc of snapshot.docs) {
    await doc.ref.update({
      balance: admin.firestore.FieldValue.increment(10000000000)
    });
    console.log(`Successfully added 10 billion to user: ${doc.id}`);
  }
}

addBalance().then(() => {
    setTimeout(() => process.exit(0), 1000);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
