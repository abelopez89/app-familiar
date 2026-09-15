import { NextResponse, type NextRequest } from "next/server";
import { getCalendarFeedData } from "@/lib/calendar-feed";
import { generateIcsCalendar } from "@/lib/ics";

/**
 * Feed ICS suscribible desde Apple Calendar / Google Calendar. Sin
 * sesión a propósito — excluida del middleware (ver middleware.ts) — el
 * token de la URL es la credencial. Nunca loguear la URL completa (tiene
 * el token), y 404 genérico ante token inválido, sin distinguir "no
 * existe" de "inactivo".
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const data = await getCalendarFeedData(token);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ics = generateIcsCalendar({
    familyName: data.familyName,
    events: data.events,
    members: data.members,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="familia.ics"',
    },
  });
}
