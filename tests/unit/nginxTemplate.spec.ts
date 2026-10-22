import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Sprint 138d D3: the access log must not carry query strings (`session_id`, `PayerID`, reset keys…).
 * nginx's default `combined` format logs `$request` — the full request line including the query.
 */
const template = readFileSync('nginx/default.conf.template', 'utf-8');
const logFormat = /^\s*log_format\s+headless\s+'([^']*)'\s*;/m.exec(template)?.[1] ?? '';

describe('nginx/default.conf.template — access log without query strings', () => {
  it('declares an explicit headless log format', () => {
    expect(logFormat).not.toBe('');
  });

  it('logs the path with $uri', () => {
    expect(logFormat).toContain('$uri');
  });

  it.each(['$request', '$request_uri', '$args', '$query_string', '$http_referer'])(
    'does not log %s',
    (variable) => {
      const found = new RegExp(`\\${variable}(?![A-Za-z_])`).test(logFormat);
      expect(found, `${variable} would put the query string into the log`).toBe(false);
    },
  );

  it('uses the format for the access log of the server', () => {
    expect(template).toMatch(/^\s*access_log\s+\S+\s+headless\s*;/m);
  });

  it('has no other access_log that falls back to a format with the query string', () => {
    const logs = [...template.matchAll(/^\s*access_log\s+(.*);/gm)].map((match) => match[1]);
    expect(logs.length).toBeGreaterThan(0);
    for (const directive of logs) {
      expect(directive, directive).toMatch(/\bheadless\b|^off$/);
    }
  });
});
