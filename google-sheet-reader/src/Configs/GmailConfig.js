require("dotenv").config();

const EMAIL_CONFIG = {
    HOST: "smtp.gmail.com",
    PORT: 465,
    SECURE: true,

    USER: process.env.GMAIL_USER,
    APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,

    SENDER_NAME: "2022강원SW미래채움",
};

module.exports = EMAIL_CONFIG;