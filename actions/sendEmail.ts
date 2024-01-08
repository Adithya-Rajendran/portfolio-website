"use server";

import React from "react";
import nodemailer from "nodemailer";
import { validateString, getErrorMessage, validateEmail } from "@/lib/utils";
import ContactFormEmail from "@/email/contact-form-email";

const emailCredentials = {
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
};

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: true,
  auth: {
    user: emailCredentials.user,
    pass: emailCredentials.pass,
  },
});

export const sendEmail = async (formData: FormData) => {
  const senderEmail = formData.get("senderEmail");
  const message = formData.get("message");

  // simple server-side validation
  if (!validateEmail(senderEmail, 500)) {
    return {
      error: "Invalid sender email",
    };
  }
  if (!validateString(message, 5000)) {
    return {
      error: "Invalid message",
    };
  }

  let data;
  try {
    data = await transporter.sendMail({
      from: '"Contact Form" <${emailCredentials.user}>',
      to: "adithyaraj@gmail.com, work@adithya-rajendran.com",
      subject: "Contact Form for My Website",
      html: React.createElement(ContactFormEmail, {
        message: message,
        senderEmail: senderEmail,
      }).toString(),
    });
  } catch (error: unknown) {
    return {
      error: getErrorMessage(error),
    };
  }

  return {
    data,
  };
};
