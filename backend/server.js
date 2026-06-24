require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PayOS } = require('@payos/node');
const { db, admin } = require('./firebaseAdmin');

const app = express();
app.use(cors());
app.use(express.json());

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY
});

// Map để lưu orderCode -> userId (Trong thực tế nên lưu vào Firestore tạm)
// Nhưng để nhanh, ta có thể nhúng userId vào description hoặc dùng orderCode
const pendingOrders = new Map();

app.post('/create-payment-link', async (req, res) => {
  try {
    const { amount, userId } = req.body;
    if (!amount || !userId) {
      return res.status(400).json({ error: 'Missing amount or userId' });
    }

    const orderCode = Number(String(Date.now()).slice(-6)); 
    
    // Lưu tạm vào RAM để khi webhook gọi về biết là của ai
    pendingOrders.set(orderCode, { userId, amount });
    const YOUR_DOMAIN = process.env.FRONTEND_URL || 'http://localhost:5173'; // Frontend domain
    const body = {
      orderCode: orderCode,
      amount: amount,
      description: `NapTien ${String(orderCode)}`,
      returnUrl: `${YOUR_DOMAIN}/dashboard?status=success`,
      cancelUrl: `${YOUR_DOMAIN}/dashboard?status=cancel`
    };

    const paymentLinkRes = await payos.paymentRequests.create(body);
    return res.json({ checkoutUrl: paymentLinkRes.checkoutUrl });
  } catch (error) {
    console.error("Create payment link error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/payos-webhook', async (req, res) => {
  console.log("Webhook received:", req.body);
  try {
    const webhookData = payos.webhooks.verify(req.body);

    if (webhookData.code === '00') {
      const orderCode = webhookData.data.orderCode;
      const orderInfo = pendingOrders.get(orderCode);

      if (orderInfo) {
        console.log(`Payment success for user ${orderInfo.userId}, amount: ${orderInfo.amount}`);
        // Cập nhật Firebase
        if (db) {
          try {
            const userRef = db.collection('users').doc(orderInfo.userId);
            await userRef.update({
              balance: admin.firestore.FieldValue.increment(orderInfo.amount)
            });
            console.log("Balance updated successfully in Firebase.");
          } catch (dbErr) {
            console.error("Lỗi cập nhật Firebase:", dbErr.message);
          }
        } else {
          console.warn(`[Mock] Cập nhật ${orderInfo.amount}đ cho user ${orderInfo.userId} (Backend thiếu serviceAccountKey.json)`);
        }
        
        // Xóa khỏi pending
        pendingOrders.delete(orderCode);
      }
    }

    return res.json({
      error: 0,
      message: "Ok",
      data: webhookData
    });
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return res.status(500).json({ error: "Webhook verification failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
