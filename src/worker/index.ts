import { handleContact } from './contact';

export interface Env {
  ASSETS: { fetch(request: Request | string, init?: RequestInit): Promise<Response> };
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CONTACT_TO_EMAIL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/contact') {
      return handleContact(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
