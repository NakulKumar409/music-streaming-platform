require('dotenv').config();
const axios = require('axios');
const Razorpay = require('razorpay');

async function testPayment() {
  console.log("Not testing via live API because we don't have user tokens easily available, wait, we can mock it.");
}
testPayment();
