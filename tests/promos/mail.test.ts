import { describe, expect, it } from "vitest";
import {
  bancoDeRemitente,
  esConfirmacionGmail,
  imagenesDelHtml,
  textoDelMail,
  tipoImagen,
  urlImagenPermitida,
} from "@/lib/promos/mail";

describe("bancoDeRemitente", () => {
  it("reconoce los remitentes de los newsletters", () => {
    expect(bancoDeRemitente("Sudameris <newsletter@sudamerismail.com.py>")).toBe("sudameris");
    expect(bancoDeRemitente("basaenterarte@bancobasa.com.py")).toBe("basa");
    expect(bancoDeRemitente('"Banco GNB" <newsletter@novedades.bancognb.com.py>')).toBe("gnb");
  });

  it("no acepta dominios parecidos ni otros remitentes", () => {
    expect(bancoDeRemitente("x@bancobasa.com.py.evil.com")).toBeNull();
    expect(bancoDeRemitente("x@fakebancobasa.com.py")).toBeNull();
    expect(bancoDeRemitente("amigo@gmail.com")).toBeNull();
    expect(bancoDeRemitente("")).toBeNull();
  });

  it("detecta la confirmación de reenvío de Gmail", () => {
    expect(esConfirmacionGmail("Gmail Team <forwarding-noreply@google.com>")).toBe(true);
    expect(esConfirmacionGmail("newsletter@sudamerismail.com.py")).toBe(false);
  });
});

describe("imagenesDelHtml", () => {
  const html = `
    <img src="https://cdn.sudamerismail.com.py/logo-sudameris.png" width="200">
    <img src="https://cdn.sudamerismail.com.py/promo-enex.jpg" alt="10% de reintegro en Enex" width="600">
    <img src='https://cdn.sudamerismail.com.py/promo-enex.jpg'>
    <img src="https://cdn.sudamerismail.com.py/spacer.gif" width="1" height="1">
    <img src="https://cdn.sudamerismail.com.py/ic-facebook.png">
    <img src="https://cdn.sudamerismail.com.py/banner.png" width="40">
    <img src="http://inseguro.com/promo.jpg">
    <img src="cid:imagen001">
    <img src="https://cdn.x.com/a.jpg?x=1&amp;y=2">`;

  it("se queda con las que pueden tener la promo, sin repetir", () => {
    expect(imagenesDelHtml(html)).toEqual([
      { url: "https://cdn.sudamerismail.com.py/promo-enex.jpg", alt: "10% de reintegro en Enex" },
      { url: "cid:imagen001", alt: "" },
      { url: "https://cdn.x.com/a.jpg?x=1&y=2", alt: "" },
    ]);
  });
});

describe("urlImagenPermitida", () => {
  it("solo https a nombres públicos", () => {
    expect(urlImagenPermitida("https://cdn.bancobasa.com.py/a.png")).toBe(true);
    expect(urlImagenPermitida("http://cdn.bancobasa.com.py/a.png")).toBe(false);
    expect(urlImagenPermitida("https://169.254.169.254/latest")).toBe(false);
    expect(urlImagenPermitida("https://localhost/a.png")).toBe(false);
    expect(urlImagenPermitida("https://[::1]/a.png")).toBe(false);
    expect(urlImagenPermitida("https://servidor.internal/a.png")).toBe(false);
    expect(urlImagenPermitida("no es url")).toBe(false);
  });
});

describe("textoDelMail y tipoImagen", () => {
  it("arma asunto, cuerpo y alts", () => {
    const texto = textoDelMail({
      asunto: "Cargá en Enex",
      textBody: "",
      htmlBody: "<p>Válido hasta el 31/12/26.</p><style>p{}</style>",
      imagenes: [{ url: "https://x.com/a.jpg", alt: "10% reintegro" }],
    });
    expect(texto).toContain("Asunto: Cargá en Enex");
    expect(texto).toContain("Válido hasta el 31/12/26.");
    expect(texto).toContain("- 10% reintegro");
    expect(texto).not.toContain("p{}");
  });

  it("normaliza los tipos de imagen", () => {
    expect(tipoImagen("image/jpg")).toBe("image/jpeg");
    expect(tipoImagen("image/PNG; charset=binary")).toBe("image/png");
    expect(tipoImagen("image/gif")).toBe("image/gif");
    expect(tipoImagen("image/svg+xml")).toBeNull();
    expect(tipoImagen(null)).toBeNull();
  });
});
