import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, error: 'Faltan variables de entorno de Supabase' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Supabase respondió ${res.status}` },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'No se pudo conectar con Supabase' },
      { status: 503 },
    );
  }
}
