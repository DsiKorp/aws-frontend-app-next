/**
 * Computes the SECRET_HASH value required by AWS Cognito when the App
 * Client is configured with a generated client secret.
 *
 *   SECRET_HASH = base64(HMAC-SHA256(clientSecret, username + clientId))
 *
 * Uses the browser-native Web Crypto API (`crypto.subtle`), so no extra
 * npm dependency is required and the result is identical to the AWS
 * reference implementations. Returned as a base64 string ready to be sent
 * in the `SecretHash` field of the SignUp / ConfirmSignUp / InitiateAuth
 * Cognito REST requests.
 *
 * NOTE: amazon-cognito-identity-js v6.x removed built-in ClientSecret
 * support, so the application has to compute and inject SECRET_HASH
 * itself when bypassing the SDK.
 *
 * @param username     The user's username (or email when used as alias).
 * @param clientId     The Cognito App Client id.
 * @param clientSecret The Cognito App Client secret.
 * @returns The base64-encoded HMAC-SHA256 digest.
 */
export async function computeSecretHash(
  username: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  // Web Crypto's HMAC expects the "message" param; AWS docs define the
  // payload as `${username}${clientId}`.
  const message = encoder.encode(`${username}${clientId}`);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);

  // base64-encode the raw signature bytes (SubtleCrypto returns ArrayBuffer,
  // not a base64 string — `btoa` only takes binary strings, so we build one).
  let binary = '';
  const bytes = new Uint8Array(signature);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
