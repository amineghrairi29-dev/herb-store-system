import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { safeReturn } from './customer-config.js';
import type { GoogleIdentity } from './customer-auth.service.js';
const stateSecret = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
interface Flow {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  expires: number;
  entry?: boolean;
}
const signature = (value: string) =>
  createHmac('sha256', stateSecret)
    .update('customer-oauth:' + value)
    .digest('base64url');
@Injectable()
export class GoogleAuthService {
  enabled() {
    return !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
    );
  }
  private client() {
    if (!this.enabled())
      throw new ServiceUnavailableException(
        'Connexion Google indisponible. Utilisez votre email.',
      );
    return new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }
  async start(returnTo: unknown, entry = false) {
    const client = this.client();
    const pkce = await client.generateCodeVerifierAsync();
    const flow: Flow = {
      state: randomBytes(32).toString('base64url'),
      nonce: randomBytes(32).toString('base64url'),
      verifier: pkce.codeVerifier,
      returnTo: safeReturn(returnTo),
      expires: Date.now() + 600000,
      entry,
    };
    const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
    return {
      cookie: payload + '.' + signature(payload),
      url: client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        state: flow.state,
        nonce: flow.nonce,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
        prompt: 'select_account',
      }),
    };
  }
  readFlow(cookie: string | undefined, state: unknown): Flow {
    try {
      if (!cookie || cookie.length > 3000 || typeof state !== 'string')
        throw new Error();
      const [payload, sig, extra] = cookie.split('.');
      const expected = signature(payload);
      if (
        extra ||
        !sig ||
        sig.length !== expected.length ||
        !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      )
        throw new Error();
      const f = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as Flow;
      if (f.state !== state || f.expires <= Date.now()) throw new Error();
      return f;
    } catch {
      throw new UnauthorizedException('Connexion Google expirée. Réessayez.');
    }
  }
  async verify(token: string, nonce: string): Promise<GoogleIdentity> {
    try {
      const ticket = await this.client().verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const p = ticket.getPayload();
      if (
        !p ||
        !p.sub ||
        !p.email ||
        p.email_verified !== true ||
        !['accounts.google.com', 'https://accounts.google.com'].includes(
          p.iss,
        ) ||
        (p as typeof p & { nonce?: string }).nonce !== nonce
      )
        throw new Error();
      return {
        sub: p.sub,
        email: p.email.toLowerCase(),
        name: p.name,
        authoritative: p.email.toLowerCase().endsWith('@gmail.com') || !!p.hd,
      };
    } catch {
      throw new UnauthorizedException('Identité Google non vérifiée.');
    }
  }
  async finish(code: unknown, flow: Flow) {
    if (typeof code !== 'string' || !code || code.length > 4096)
      throw new UnauthorizedException('Réponse Google invalide.');
    try {
      const { tokens } = await this.client().getToken({
        code,
        codeVerifier: flow.verifier,
      });
      if (!tokens.id_token) throw new Error();
      return await this.verify(tokens.id_token, flow.nonce);
    } catch {
      throw new UnauthorizedException(
        'Connexion Google impossible. Réessayez ou utilisez votre email.',
      );
    }
  }
}
