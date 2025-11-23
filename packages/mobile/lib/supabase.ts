// @ts-nocheck

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://trlgorbysnlastxucfsu.supabase.co';
// JWT anon key (used for Authorization: Bearer header)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRybGdvcmJ5c25sYXN0eHVjZnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MzM3MDgsImV4cCI6MjA3OTQwOTcwOH0.wg-weqWOTRmKS2Z6oVf42piDQKJiGInOQz9msrXtrYM';
// Publishable API key (used for apikey header)
const SUPABASE_API_KEY = 'sb_publishable_lWumQ0uOWY7K19WtoybZjA_Pcm8JSw0';


// Fix for React Native URL read-only properties issue
// Supabase tries to modify URL.protocol, URL.pathname, etc. which are read-only in React Native
// We need to make these properties writable before Supabase client initializes
if (typeof URL !== 'undefined' && URL.prototype) {
  try {
    // Properties that Supabase might try to modify
    const writableProperties = ['protocol', 'pathname', 'hostname', 'host', 'port', 'search', 'hash', 'href'];
    
    writableProperties.forEach(prop => {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(URL.prototype, prop);
        if (descriptor && (!descriptor.writable || !descriptor.set)) {
          // Store original getter
          const originalGetter = descriptor.get;
          
          // Create a writable property with getter/setter
          Object.defineProperty(URL.prototype, prop, {
            get: originalGetter || function() {
              // Fallback: parse from href
              const urlObj = new (originalGetter ? this.constructor : URL)(this.href || '');
              // @ts-ignore
              return urlObj[prop];
            },
            set: function(value: any) {
              // When setting, reconstruct the URL
              try {
                // Create a temporary URL to parse
                const currentHref = this.href || '';
                const urlParts = currentHref.match(/^([^:]+):\/\/([^\/]+)(.*)$/) || [];
                const protocol = urlParts[1] || 'https';
                const host = urlParts[2] || '';
                const rest = urlParts[3] || '';
                
                // Build new URL based on which property is being set
                let newUrl: string;
                if (prop === 'protocol') {
                  const newProtocol = String(value).replace(':', '');
                  newUrl = `${newProtocol}://${host}${rest}`;
                } else if (prop === 'pathname') {
                  const search = this.search || '';
                  const hash = this.hash || '';
                  newUrl = `${protocol}://${host}${value}${search}${hash}`;
                } else if (prop === 'hostname') {
                  const pathname = this.pathname || '';
                  const search = this.search || '';
                  const hash = this.hash || '';
                  const port = this.port ? `:${this.port}` : '';
                  newUrl = `${protocol}://${value}${port}${pathname}${search}${hash}`;
                } else if (prop === 'href') {
                  newUrl = String(value);
                } else {
                  // For other properties, try to use URL constructor
                  const tempUrl = new URL(currentHref);
                  // @ts-ignore
                  tempUrl[prop] = value;
                  newUrl = tempUrl.href;
                }
                
                // Create new URL instance and copy properties
                const newUrlObj = new URL(newUrl);
                // Copy all properties from new URL to this
                ['protocol', 'hostname', 'port', 'pathname', 'search', 'hash', 'href'].forEach(p => {
                  try {
                    // @ts-ignore
                    Object.defineProperty(this, p, {
                      // @ts-ignore
                      value: newUrlObj[p],
                      writable: true,
                      configurable: true,
                      enumerable: true,
                    });
                  } catch (e) {
                    // Ignore if can't set property
                  }
                });
              } catch (e) {
                // If reconstruction fails, try to set value directly
                try {
                  Object.defineProperty(this, prop, {
                    value: value,
                    writable: true,
                    configurable: true,
                    enumerable: true,
                  });
                } catch (e2) {
                  // Ignore if still fails
                }
              }
            },
            configurable: true,
            enumerable: descriptor.enumerable !== false,
          });
        }
      } catch (e) {
        // Continue with next property if this one fails
      }
    });
  } catch (e) {
    // If patching fails, log warning but continue
    console.warn('URL properties patch warning (may cause Supabase issues):', e);
  }
}

// Custom fetch function that ensures both headers are set correctly
const customFetch = async (url: string, options: any = {}) => {
  // Normalize URL: remove trailing slash before query string (fixes PGRST125)
  // Supabase client adds /users/ but API expects /users?
  let normalizedUrl = url;
  if (normalizedUrl.includes('/rest/v1/')) {
    // Replace pattern like /users/? with /users?
    normalizedUrl = normalizedUrl.replace(/\/([^\/]+)\/\?/, '/$1?');
    // Also handle cases where there's a trailing slash before query params
    normalizedUrl = normalizedUrl.replace(/\/([^\/]+)\/(\?|&)/, '/$1?');
  }
  
  // Ensure headers object exists
  // Start with existing headers (Supabase client sets important ones like 'Prefer')
  const headers: Record<string, string> = {
    // Always set apikey to publishable key (override if exists)
    'apikey': SUPABASE_API_KEY,
    // Always set Authorization to JWT token (override if exists)
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    // Preserve existing headers from Supabase client (like 'Prefer', 'Content-Type', etc.)
    ...options.headers,
  };
  
  // For requests with body (POST, PUT, PATCH), ensure Content-Type is set
  const hasBody = options.body !== null && options.body !== undefined;
  const method = (options.method || 'GET').toUpperCase();
  if (hasBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    // Set Content-Type if not already set or if it's text/plain (wrong)
    if (!headers['Content-Type'] || headers['Content-Type'] === 'text/plain') {
      headers['Content-Type'] = 'application/json';
    }
  }
  
  // Log only if URL was changed (to reduce noise)
  if (normalizedUrl !== url) {
    console.log('[Supabase] URL normalized:', {
      original: url,
      normalized: normalizedUrl,
    });
  }
  
  // Use React Native's fetch with our custom headers and normalized URL
  return fetch(normalizedUrl, {
    ...options,
    headers,
  });
};

// Create Supabase client with JWT anon key
// Use custom fetch to ensure both headers are always set
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: customFetch,
    headers: {
      // Set default headers (custom fetch will override)
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  },
  db: {
    schema: 'public',
  },
});

// Log Supabase connection status
console.log('[Supabase] Client initialized:', {
  url: SUPABASE_URL,
  hasAnonKey: !!SUPABASE_ANON_KEY,
  hasApiKey: !!SUPABASE_API_KEY,
  anonKeyLength: SUPABASE_ANON_KEY?.length || 0,
  apiKeyLength: SUPABASE_API_KEY?.length || 0,
  usingBothKeys: !!(SUPABASE_ANON_KEY && SUPABASE_API_KEY),
});

// Validate API key format
if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  console.error('[Supabase] ❌ ERROR: SUPABASE_ANON_KEY is not set!');
  console.error('[Supabase] Please set your anon key in lib/supabase.ts');
  console.error('[Supabase] Get it from: Supabase Dashboard → Settings → API → "anon/public" key');
} else if (!SUPABASE_ANON_KEY.startsWith('eyJ')) {
  console.warn('[Supabase] ⚠️ WARNING: API key format looks wrong!');
  console.warn('[Supabase] Expected: JWT token starting with "eyJ"');
  console.warn('[Supabase] Got:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
  console.warn('[Supabase] If you\'re using Expo supabaseUrl plugin, use the actual anon key instead!');
}

// Test connection - verify table exists and is accessible
if (SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY_HERE') {
  // First test with direct fetch (matching Postman exactly)
  const testUrl = `${SUPABASE_URL}/rest/v1/users?select=id&limit=1`;
  console.log('[Supabase] Testing with direct fetch (Postman-style)...');
  fetch(testUrl, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_API_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  })
    .then((res) => {
      console.log('[Supabase] Direct fetch response:', {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries()),
      });
      return res.json();
    })
    .then((data) => {
      if (Array.isArray(data)) {
        console.log('[Supabase] ✅ Direct fetch successful! Found', data.length, 'rows');
      } else if (data && data.code) {
        console.error('[Supabase] ❌ Direct fetch error:', data);
      }
    })
    .catch((err) => {
      console.error('[Supabase] Direct fetch failed:', err);
    });

  // Then test with Supabase client
  supabase
    .from('users')
    .select('id')
    .limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('[Supabase] Supabase client test failed:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        
        if (error.code === 'PGRST125') {
          console.error('[Supabase] ⚠️ PGRST125: Invalid path specified in request URL');
          console.error('[Supabase] This means the headers might not be set correctly in Supabase client.');
          console.error('[Supabase] Try checking if direct fetch works (see above logs)');
        } else if (error.code === 'PGRST301') {
          console.error('[Supabase] ❌ Invalid API key!');
          console.error('[Supabase] Please check your SUPABASE_ANON_KEY in lib/supabase.ts');
          console.error('[Supabase] Get it from: Supabase Dashboard → Settings → API → "anon/public" key');
        }
      } else {
        console.log('[Supabase] ✅ Supabase client test successful - users table accessible');
        console.log('[Supabase] Table contains', data?.length || 0, 'rows');
      }
    })
    .catch((err) => {
      console.error('[Supabase] Supabase client test error:', err);
    });
}
