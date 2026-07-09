import nodemailer from 'nodemailer';

/**
 * Servicio de envío de correos.
 *
 * El transporter se configura por variables de entorno (pensado para
 * Mailtrap en desarrollo, pero sirve para cualquier SMTP):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
 *
 * El transporter se crea de forma perezosa (lazy) para no fallar al
 * importar el módulo si todavía faltan las variables de entorno.
 */

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 2525,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
};

/**
 * Envía el correo de notificación de cuenta aprobada.
 *
 * No captura sus propios errores: quien la invoca decide qué hacer si
 * el envío falla (en el flujo de aprobación se trata como best-effort).
 *
 * @param {{ nombre: string, apellido: string, email: string }} usuario
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
const enviarMailAprobacion = async (usuario) => {
  const html = `
    <h2>¡Tu cuenta fue aprobada!</h2>
    <p>Hola ${usuario.nombre} ${usuario.apellido},</p>
    <p>
      Tu cuenta en el sistema de gestión de laboratorios fue aprobada por
      un administrador. Ya podés iniciar sesión con tu correo y contraseña.
    </p>
    <p>Saludos,<br/>El equipo de gestión de laboratorios</p>
  `;

  return getTransporter().sendMail({
    from: process.env.MAIL_FROM || 'no-reply@laboratorios.local',
    to: usuario.email,
    subject: 'Tu cuenta fue aprobada',
    html
  });
};

export { enviarMailAprobacion };
