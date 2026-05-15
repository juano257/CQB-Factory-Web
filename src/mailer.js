const nodemailer = require("nodemailer");

function parseBooleanEnv(name) {
  const rawValue = process.env[name];
  if (rawValue === undefined) return undefined;
  return ["1", "true", "yes", "on"].includes(String(rawValue).trim().toLowerCase());
}

function getMailerConfig() {
  const host = String(process.env.SMTP_HOST || "smtp-relay.brevo.com").trim();
  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = parseBooleanEnv("SMTP_SECURE") ?? port === 465;
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const from = String(process.env.MAIL_FROM || user || "").trim();

  return {
    host,
    port,
    secure,
    from,
    auth: user && pass ? { user, pass } : null,
  };
}

function isMailerConfigured() {
  const config = getMailerConfig();
  return Boolean(config.host && config.port && config.from && config.auth?.user && config.auth?.pass);
}

let transporterPromise = null;

async function getTransporter() {
  if (!isMailerConfigured()) {
    throw new Error("SMTP no configurado");
  }

  if (!transporterPromise) {
    const config = getMailerConfig();
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth,
      })
    );
  }

  return transporterPromise;
}

async function sendVerificationEmail({ to, name, verificationUrl }) {
  const config = getMailerConfig();
  const transporter = await getTransporter();
  const safeName = String(name || "Operador").trim() || "Operador";

  return transporter.sendMail({
    from: config.from,
    to,
    subject: "Verifica tu correo | CQB Factory",
    text: [
      `Hola ${safeName},`,
      "",
      "Gracias por crear tu cuenta en CQB Factory.",
      "Verifica tu correo abriendo este enlace:",
      verificationUrl,
      "",
      "Este enlace vence en 24 horas.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #182118; max-width: 560px; margin: 0 auto;">
        <h2 style="margin-bottom: 12px;">CQB Factory</h2>
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Gracias por crear tu cuenta. Para activar tus reservas, verifica tu correo haciendo clic en el siguiente boton:</p>
        <p style="margin: 24px 0;">
          <a href="${verificationUrl}" style="background:#556b2f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:700;">
            Verificar correo
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>Este enlace vence en 24 horas.</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail({ to, name, resetUrl }) {
  const config = getMailerConfig();
  const transporter = await getTransporter();
  const safeName = String(name || "Operador").trim() || "Operador";

  return transporter.sendMail({
    from: config.from,
    to,
    subject: "Recuperar contrasena | CQB Factory",
    text: [
      `Hola ${safeName},`,
      "",
      "Recibimos una solicitud para restablecer tu contrasena.",
      "Abre este enlace para continuar:",
      resetUrl,
      "",
      "Este enlace vence en 30 minutos.",
      "Si no solicitaste este cambio, puedes ignorar este correo.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #182118; max-width: 560px; margin: 0 auto;">
        <h2 style="margin-bottom: 12px;">CQB Factory</h2>
        <p>Hola <strong>${safeName}</strong>,</p>
        <p>Recibimos una solicitud para restablecer tu contrasena.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background:#556b2f;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;font-weight:700;">
            Restablecer contrasena
          </a>
        </p>
        <p>Si el boton no funciona, copia y pega este enlace:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Este enlace vence en 30 minutos. Si no solicitaste este cambio, puedes ignorar este correo.</p>
      </div>
    `,
  });
}

module.exports = {
  isMailerConfigured,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
