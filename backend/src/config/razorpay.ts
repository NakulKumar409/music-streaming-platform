import Razorpay from "razorpay";
import dotenv from "dotenv";
dotenv.config();

const key_id = (process.env.RAZORPAY_KEY_ID ?? "").toString().trim();
const key_secret = (process.env.RAZORPAY_KEY_SECRET ?? "").toString().trim();

if (!key_id || !key_secret) {
  console.warn("⚠️ Razorpay keys are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
}

export const razorpayClient = new Razorpay({
  key_id,
  key_secret,
});
