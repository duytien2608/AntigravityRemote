const admin = require('firebase-admin');

// Để chạy được, bạn cần file serviceAccountKey.json từ Firebase Console
// Hãy tải về và đổi tên thành serviceAccountKey.json để cùng cấp thư mục này.
let db;

try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("Firebase Admin initialized successfully.");
} catch (error) {
  console.error("LỖI BẢO MẬT: Không tìm thấy file serviceAccountKey.json. Webhook sẽ không thể cộng tiền vào DB!");
  console.error(error.message);
  // Không khởi tạo Firestore để tránh crash.
}

module.exports = { admin, db };
