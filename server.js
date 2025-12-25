import express from "express";
import cors from "cors";
import midtransClient from "midtrans-client";

const app = express();
app.use(cors());
app.use(express.json());

/* ================= MIDTRANS ================= */

const snap = new midtransClient.Snap({
  isProduction: false, // true kalau LIVE
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

const coreApi = new midtransClient.CoreApi({
  isProduction: false, // true kalau LIVE
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

/* ================= ROUTES ================= */

// Health check
app.get("/", (req, res) => {
  res.send("Midtrans Backend OK");
});

// CREATE TRANSACTION
app.post("/create-transaction", async (req, res) => {
  try {
    const { order_id, gross_amount, customer } = req.body;

    if (!order_id || !gross_amount || !customer?.name) {
      return res.status(400).json({
        message: "Payload tidak lengkap",
      });
    }

    const parameter = {
      transaction_details: {
        order_id,
        gross_amount,
      },
      customer_details: {
        first_name: customer.name,
        email: customer.email || "customer@example.com", // Default email jika kosong
        phone: customer.phone || "081234567890", // Default phone jika kosong
      },
      // TAMBAHAN: Enabled payments untuk sandbox
      enabled_payments: [
        "credit_card",
        "bca_va",
        "bni_va",
        "bri_va",
        "permata_va",
        "other_va",
        "gopay",
        "shopeepay",
        "qris",
      ],
      // TAMBAHAN: Credit card config
      credit_card: {
        secure: true,
        bank: "bca",
        save_card: false,
      },
    };

    console.log("Creating transaction with parameter:", JSON.stringify(parameter, null, 2));

    const transaction = await snap.createTransaction(parameter);

    console.log("Transaction created:", {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });

    res.json({
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });
  } catch (err) {
    console.error("Create transaction error:", err);
    res.status(500).json({
      message: "Gagal membuat transaksi",
      error: err.message,
    });
  }
});

// CHECK STATUS TRANSACTION
app.post("/check-status", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        message: "orderId wajib dikirim",
      });
    }

    console.log("Checking status for order:", orderId);

    const statusResponse = await coreApi.transaction.status(orderId);
    
    console.log("Status response:", JSON.stringify(statusResponse, null, 2));

    res.json(statusResponse);
  } catch (err) {
    console.error("Check status error:", err);
    
    // PERBAIKAN: Handle error 404 (transaksi belum ada)
    if (err.httpStatusCode === 404) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan",
        transaction_status: "not_found",
        order_id: req.body.orderId,
      });
    }

    res.status(500).json({
      message: "Gagal cek status pembayaran",
      error: err.message,
    });
  }
});

// TAMBAHAN: Webhook Notification dari Midtrans
app.post("/notification", async (req, res) => {
  try {
    const notification = req.body;
    console.log("Received notification:", JSON.stringify(notification, null, 2));

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    console.log(`Transaction notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`);

    // Verifikasi notification dengan Midtrans
    const statusResponse = await coreApi.transaction.status(orderId);

    console.log("Verified status:", JSON.stringify(statusResponse, null, 2));

    // Anda bisa tambahkan logic untuk update database di sini
    // Misalnya update Firestore dari backend

    res.status(200).json({
      message: "Notification processed",
    });
  } catch (err) {
    console.error("Notification error:", err);
    res.status(500).json({
      message: "Error processing notification",
      error: err.message,
    });
  }
});

// TAMBAHAN: Manual Status Check (untuk testing)
app.get("/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log("Manual status check for:", orderId);
    
    const statusResponse = await coreApi.transaction.status(orderId);
    
    res.json(statusResponse);
  } catch (err) {
    console.error("Manual status check error:", err);
    
    if (err.httpStatusCode === 404) {
      return res.status(404).json({
        message: "Transaksi tidak ditemukan",
        order_id: req.params.orderId,
      });
    }
    
    res.status(500).json({
      message: "Error checking status",
      error: err.message,
    });
  }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   GET  /              - Health check`);
  console.log(`   POST /create-transaction - Create payment`);
  console.log(`   POST /check-status  - Check payment status`);
  console.log(`   POST /notification  - Webhook from Midtrans`);
  console.log(`   GET  /status/:orderId - Manual status check`);
});