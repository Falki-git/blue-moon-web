import { handleContact } from './contact';
import { handleAvailability, handleBooking, handleDecision } from './booking';
import { handleAdmin } from './admin';

export interface Env {
  ASSETS: { fetch(request: Request | string, init?: RequestInit): Promise<Response> };
  DB: D1Database;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CONTACT_TO_EMAIL: string;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact'        && request.method === 'POST') return handleContact(request, env, ctx);
    if (url.pathname === '/api/availability'   && request.method === 'GET')  return handleAvailability(request, env);
    if (url.pathname === '/api/booking'        && request.method === 'POST') return handleBooking(request, env, ctx);
    if (url.pathname === '/api/booking/decide'  && request.method === 'GET') return handleDecision(request, env, ctx);
    if (url.pathname === '/api/booking/resolve' && request.method === 'GET') return handleDecision(request, env, ctx);
    if (url.pathname.startsWith('/api/admin/')) return handleAdmin(request, env, ctx);

    return env.ASSETS.fetch(request);
  },
};
