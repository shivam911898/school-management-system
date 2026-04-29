const nodemailer = require("nodemailer");

const getTransport = () => {
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: Ethereal for dev (no env set)
  return nodemailer.createTestAccount().then((acct) => {
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: acct.user,
        pass: acct.pass,
      },
    });
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = await getTransport();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || "no-reply@school.example",
    to,
    subject,
    text,
    html,
  });

  // If using Ethereal, return preview URL for convenience
  if (nodemailer.getTestMessageUrl) {
    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
    };
  }

  return { messageId: info.messageId };
};

module.exports = { sendEmail };
