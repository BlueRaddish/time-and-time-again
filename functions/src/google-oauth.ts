/**
 * The OAuth half of the sync: turning an authorization code into a stored refresh token, and
 * that refresh token into short-lived access tokens.
 *
 * ## Where the secret lives
 *
 * The refresh token never reaches the client. It is written to `users/{uid}/private/google`,
 * which `firestore.rules` denies to every client including its owner, and read back only here
 * through the Admin SDK — which bypasses rules. The client secret comes from a Secret Manager
 * secret, not from config.
 *
 * ## `invalid_grant`
 *
 * A refresh token stops working when the user revokes access, changes their password, or —
 * the one that will actually happen during development — the OAuth consent screen is still in
 * **Testing** publishing status, where Google expires refresh tokens after **7 days**. See
 * `docs/PHASE-0.md`. It is a normal state, not an exception: it is recorded so the app can ask
 * the user to reconnect, and it is never retried, because retrying a dead grant just burns
 * quota.
 */

export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
] as const;

/** Raised when the stored grant is dead and the user has to reconnect. Never retried. */
export class InvalidGrantError extends Error {
  constructor(message = 'The stored Google authorization is no longer valid') {
    super(message);
    this.name = 'InvalidGrantError';
  }
}

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type TokenErrorBody = { error?: string; error_description?: string };

async function postForm(url: string, params: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
}

/** Google reports a dead grant as HTTP 400 with `error: "invalid_grant"`, not as a 401. */
export function isInvalidGrant(status: number, body: TokenErrorBody): boolean {
  return status === 400 && body.error === 'invalid_grant';
}

async function readTokenResponse(response: Response): Promise<TokenResponse> {
  const body = (await response.json().catch(() => ({}))) as TokenResponse & TokenErrorBody;

  if (!response.ok) {
    if (isInvalidGrant(response.status, body)) {
      throw new InvalidGrantError(body.error_description ?? undefined);
    }
    throw new Error(
      `Google token endpoint returned ${response.status}: ${body.error ?? 'unknown error'}`
    );
  }

  return body;
}

/**
 * Exchanges the one-time code the client obtained for a long-lived refresh token.
 *
 * `redirectUri` must be byte-identical to the one the client used or Google rejects the
 * exchange with `redirect_uri_mismatch`.
 */
export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const response = await postForm(GOOGLE_TOKEN_ENDPOINT, {
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  return readTokenResponse(response);
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<TokenResponse> {
  const response = await postForm(GOOGLE_TOKEN_ENDPOINT, {
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
  });

  return readTokenResponse(response);
}

/** Best-effort: an already-invalid token is the state we wanted anyway. */
export async function revokeToken(token: string): Promise<void> {
  await postForm(GOOGLE_REVOKE_ENDPOINT, { token }).catch(() => undefined);
}
