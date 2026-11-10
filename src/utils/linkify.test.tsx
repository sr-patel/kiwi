import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { linkifyText, renderClickableUrl } from './linkify';

const countLinks = (html: string): number => (html.match(/<a /g) ?? []).length;

describe('linkifyText', () => {
  it('links every URL in a multi-URL note', () => {
    // Regression: the module-level regex kept `lastIndex` between `test()`
    // calls, so only every other URL was turned into a link.
    const html = renderToStaticMarkup(
      <>
        {linkifyText('see https://a.example.com/x and https://b.example.com/y and https://c.example.com/z')}
      </>,
    );

    expect(countLinks(html)).toBe(3);
    expect(html).toContain('https://a.example.com/x');
    expect(html).toContain('https://b.example.com/y');
    expect(html).toContain('https://c.example.com/z');
  });

  it('leaves plain text untouched', () => {
    const html = renderToStaticMarkup(<>{linkifyText('no links here')}</>);
    expect(countLinks(html)).toBe(0);
    expect(html).toContain('no links here');
  });

  it('promotes bare www hosts to https', () => {
    const html = renderToStaticMarkup(<>{linkifyText('visit www.example.com')}</>);
    expect(html).toContain('href="https://www.example.com"');
  });

  it('marks external links as safe', () => {
    const html = renderToStaticMarkup(<>{linkifyText('https://example.com')}</>);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });
});

describe('renderClickableUrl', () => {
  it('returns text for an invalid URL instead of a dead anchor', () => {
    const html = renderToStaticMarkup(<>{renderClickableUrl('not a url')}</>);
    expect(countLinks(html)).toBe(0);
    expect(html).toContain('not a url');
  });

  it('renders a valid URL as an anchor', () => {
    const html = renderToStaticMarkup(<>{renderClickableUrl('https://example.com', 'Example')}</>);
    expect(countLinks(html)).toBe(1);
    expect(html).toContain('>Example</a>');
  });
});
