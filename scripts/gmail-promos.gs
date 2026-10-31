// Google Apps Script (script.google.com, en la cuenta de Gmail que recibe
// los newsletters): manda a App Familiar los mails de promos de los bancos.
// Activador: según tiempo, cada hora, función `enviarPromos`.
// Los mails enviados con 200 quedan con la etiqueta `promos-enviado`.
// Ver "Promociones de tarjetas", punto 19, en CLAUDE.md.

const APP_URL = "https://TU-APP.vercel.app"; // dominio final de la app, SIN "/" al final
const SECRETO = "LA_MISMA_CLAVE_DE_PROMOS_MAIL_SECRET";
const REMITENTES = [
  "newsletter@sudamerismail.com.py",
  "basaenterarte@bancobasa.com.py",
  "newsletter@novedades.bancognb.com.py",
];
const ETIQUETA = "promos-enviado";

function enviarPromos() {
  const etiqueta = GmailApp.getUserLabelByName(ETIQUETA) || GmailApp.createLabel(ETIQUETA);
  const query = `from:(${REMITENTES.join(" OR ")}) -label:${ETIQUETA} newer_than:30d`;
  const hilos = GmailApp.search(query, 0, 20);

  for (const hilo of hilos) {
    let todoOk = true;
    for (const m of hilo.getMessages()) {
      const adjuntos = m.getAttachments({ includeInlineImages: true }).map((a) => ({
        Name: a.getName(),
        ContentType: a.getContentType(),
        Content: Utilities.base64Encode(a.getBytes()),
        ContentID: "",
      }));
      // Mismo formato JSON que el webhook de Postmark Inbound.
      const correo = {
        From: m.getFrom(),
        Subject: m.getSubject(),
        MessageID: m.getId(),
        TextBody: m.getPlainBody(),
        HtmlBody: m.getBody(),
        Headers: [{ Name: "Message-ID", Value: m.getHeader("Message-ID") || m.getId() }],
        Attachments: adjuntos,
      };
      // Sin seguir redirecciones: una redirección convierte el POST en GET
      // y la app responde 405 (pasó con una "/" al final de APP_URL).
      const res = UrlFetchApp.fetch(`${APP_URL}/api/inbound/promos`, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(correo),
        headers: { Authorization: "Basic " + Utilities.base64Encode("promos:" + SECRETO) },
        muteHttpExceptions: true,
        followRedirects: false,
      });
      Logger.log(`${res.getResponseCode()} ${m.getSubject()} → ${res.getHeaders()["Location"] || res.getContentText()}`);
      if (res.getResponseCode() !== 200) todoOk = false;
    }
    if (todoOk) hilo.addLabel(etiqueta);
  }
}
