const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

async function sendEmail(to, subject, htmlContent) {
  const mailOptions = {
    from: `"L'équipe ODIA" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html: htmlContent
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { sendEmail };