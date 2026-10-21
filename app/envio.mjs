// Envío de mails por SMTP (Gmail con contraseña de aplicación), sin dependencias.
// Solo se usa para mensajes que Ignacio o Delfi aprobaron en la app.
import tls from "node:tls";
import { readFile } from "node:fs/promises";
import path from "node:path";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const encHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = (s) => s.replace(/.{1,76}/g, "$&\r\n");

export function smtpConfig() {
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return { host: process.env.SMTP_HOST || "smtp.gmail.com", port: Number(process.env.SMTP_PORT || 465), user, pass, fromName: process.env.SMTP_FROM_NAME || "Küme" };
}

export async function sendMail({ to, subject, text, attachments = [], replyTo }) {
  const cfg = smtpConfig();
  if (!cfg) throw new Error("Falta configurar el mail (SMTP_USER y SMTP_PASS en .env)");
  const boundary = "kume-" + Math.random().toString(36).slice(2);
  const files = [];
  for (const a of attachments) files.push({ name: a.name || path.basename(a.path), data: await readFile(a.path) });
  const headers = [
    `From: ${encHeader(cfg.fromName)} <${cfg.user}>`,
    `To: <${to}>`,
    `Subject: ${encHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${cfg.user.split("@")[1]}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean);
  let body = `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(text))}`;
  for (const f of files) {
    body += `--${boundary}\r\nContent-Type: application/pdf; name="${encHeader(f.name)}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${encHeader(f.name)}"\r\n\r\n${wrap76(f.data.toString("base64"))}`;
  }
  body += `--${boundary}--\r\n`;
  const msg = headers.join("\r\n") + "\r\n\r\n" + body;

  return new Promise((resolve, reject) => {
    const sock = tls.connect(cfg.port, cfg.host, { servername: cfg.host });
    let buf = "", step = 0;
    const steps = [
      [220, () => `EHLO kume-hq`],
      [250, () => `AUTH PLAIN ${Buffer.from(`\0${cfg.user}\0${cfg.pass}`).toString("base64")}`],
      [235, () => `MAIL FROM:<${cfg.user}>`],
      [250, () => `RCPT TO:<${to}>`],
      [250, () => `DATA`],
      [354, () => msg.replace(/\r\n\./g, "\r\n..") + "\r\n."],
      [250, () => `QUIT`],
    ];
    const fail = (e) => { sock.destroy(); reject(e); };
    sock.setTimeout(30000, () => fail(new Error("El servidor de mail no respondió")));
    sock.on("error", fail);
    sock.on("data", (d) => {
      buf += d.toString();
      // esperar la última línea de la respuesta (código + espacio)
      const lines = buf.split("\r\n").filter(Boolean);
      const last = lines[lines.length - 1] || "";
      if (!/^\d{3} /.test(last)) return;
      const code = Number(last.slice(0, 3)); buf = "";
      if (step >= steps.length) { sock.end(); return resolve(true); }
      const [expect, next] = steps[step];
      if (code !== expect) {
        const hint = code === 535 ? " (usuario o contraseña de aplicación incorrectos)" : "";
        return fail(new Error(`El servidor de mail rechazó el paso ${step + 1}: ${last}${hint}`));
      }
      step++;
      sock.write(next() + "\r\n");
    });
  });
}
