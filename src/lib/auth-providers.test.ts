import { availableAuthProviders, type AuthProviderSpec } from '@/lib/auth-providers';

function spec(id: string, configured: boolean): AuthProviderSpec {
  return {
    id: id as AuthProviderSpec['id'],
    label: id,
    kind: id === 'password' ? 'password' : 'oauth',
    isConfigured: () => configured,
  };
}

describe('availableAuthProviders', () => {
  it('drops providers whose credentials are absent', () => {
    const providers = [spec('password', true), spec('google', false)];
    expect(availableAuthProviders(providers).map((p) => p.id)).toEqual(['password']);
  });

  it('keeps order, so the primary method stays first', () => {
    const providers = [spec('password', true), spec('google', true)];
    expect(availableAuthProviders(providers).map((p) => p.id)).toEqual(['password', 'google']);
  });

  it('can return nothing at all without throwing', () => {
    expect(availableAuthProviders([spec('password', false)])).toEqual([]);
  });
});

describe('the real provider list', () => {
  it('always offers email and password, which needs no extra credentials', () => {
    // Google can be unconfigured; if password ever could be too, an unconfigured project
    // would render a sign-in screen with no way to sign in.
    const password = availableAuthProviders().find((p) => p.id === 'password');
    expect(password).toBeDefined();
  });
});
