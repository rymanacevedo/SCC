import type { MiddlewareHandler } from 'hono';

const UNKNOWN_COUNTRY_CODE = 'XX';
const REGION_DENIED_RESPONSE = { error: 'Access denied: region not supported' };

type GeoRestrictionConfig = {
  allowedCountries: Iterable<string>;
};

function normalizeCountryCode(countryCode: string): string {
  return countryCode.trim().toUpperCase();
}

export function createGeoRestrictionMiddleware({
  allowedCountries,
}: GeoRestrictionConfig): MiddlewareHandler {
  const allowedCountrySet = new Set(
    [...allowedCountries].map(normalizeCountryCode),
  );

  return async (c, next) => {
    const country = c.req.raw.cf?.country;
    const normalizedCountry =
      typeof country === 'string' ? normalizeCountryCode(country) : undefined;

    if (
      !normalizedCountry ||
      normalizedCountry === UNKNOWN_COUNTRY_CODE ||
      !allowedCountrySet.has(normalizedCountry)
    ) {
      console.log({
        event: 'geo_blocked',
        country: normalizedCountry,
        path: new URL(c.req.url).pathname,
        method: c.req.method,
        timestamp: new Date().toISOString(),
      });

      return c.json(REGION_DENIED_RESPONSE, 403);
    }

    await next();
  };
}
