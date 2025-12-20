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
        email: customer.email,
        phone: customer.phone,
      },
    };

    const transaction = await snap.createTransaction(parameter);

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

    const statusResponse = await coreApi.transaction.status(orderId);
    res.json(statusResponse);
  } catch (err) {
    console.error("Check status error:", err);
    res.status(500).json({
      message: "Gagal cek status pembayaran",
      error: err.message,
    });
  }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});