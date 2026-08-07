import { isGoogleSignInConfigured, readFirebaseConfig } from '@/lib/firebase-config';

const complete = {
  apiKey: 'key',
  authDomain: 'p.firebaseapp.com',
  projectId: 'p',
  storageBucket: 'p.appspot.com',
  messagingSenderId: '1',
  appId: '1:1:web:1',
};

describe('readFirebaseConfig', () => {
  it('returns the config when every field is present', () => {
    expect(readFirebaseConfig(complete)).toEqual(complete);
  });

  it.each(Object.keys(complete))('returns null when %s is missing', (missing) => {
    // A half-filled config is a misconfiguration, not a degraded mode — starting Firebase
    // without a projectId fails far away from the cause.
    expect(readFirebaseConfig({ ...complete, [missing]: undefined } as typeof complete)).toBeNull();
  });

  it('treats an empty or whitespace value as missing', () => {
    expect(readFirebaseConfig({ ...complete, projectId: '' })).toBeNull();
    expect(readFirebaseConfig({ ...complete, projectId: '   ' })).toBeNull();
  });
});

describe('isGoogleSignInConfigured', () => {
  it('is false with no client ids, so the button is hidden rather than broken', () => {
    expect(isGoogleSignInConfigured({})).toBe(false);
    expect(isGoogleSignInConfigured({ web: '', android: undefined })).toBe(false);
  });

  it('is true when either platform has a client id', () => {
    expect(isGoogleSignInConfigured({ web: 'w' })).toBe(true);
    expect(isGoogleSignInConfigured({ android: 'a' })).toBe(true);
  });
});
