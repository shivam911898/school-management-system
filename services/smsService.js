const twilio = require("twilio");

let twilioClient = null;

const initializeTwilio = () => {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials not configured. SMS will be disabled.");
    return null;
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
};

const sendSMS = async ({ to, message }) => {
  const client = initializeTwilio();
  if (!client) {
    throw new Error(
      "SMS service not configured. Please set TWILIO environment variables.",
    );
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to,
  });

  return { messageSid: result.sid };
};

module.exports = { sendSMS, initializeTwilio };
