"""Web search tool using Scrapling."""

import sys
import os
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from server import register_tool, log
from tools.search_text import sanitize_search_text


def _parse_google_results(page, num_results: int) -> list:
    """Parse Google search result page with multiple fallback selectors."""
    results = []

    # Try multiple container selectors (Google changes these frequently)
    containers = (
        page.css('div.g')
        or page.css('[data-sokoban-container]')
        or page.css('.tF2Cxc')
        or page.css('.MjjYud')
        or page.css('div[data-hveid]')
    )

    for container in containers[:num_results]:
        # Title: try multiple selectors
        title = ''
        for sel in ['h3', 'h3.LC20lb', 'h3.DKVWMd', '.LC20lb']:
            title_el = container.css(sel)
            if title_el:
                title = title_el[0].text.strip()
                if title:
                    break

        # Link
        url = ''
        link_el = container.css('a[href]')
        if link_el:
            href = link_el[0].attrib.get('href', '')
            if href.startswith('http'):
                url = href

        # Snippet: try multiple selectors
        snippet = ''
        for sel in [
            '[data-sncf]', '.VwiC3b', '.IsZvec',
            '[style*="-webkit-line-clamp"]', '.lEBKkf',
            'span.st', '.s3v9rd'
        ]:
            snippet_el = container.css(sel)
            if snippet_el:
                snippet = snippet_el[0].text.strip()
                if snippet:
                    break

        if title and url:
            results.append({
                'title': title,
                'url': url,
                'snippet': snippet,
            })

    return results


def _parse_bing_results(page, num_results: int) -> list:
    """Parse Bing search result page with fallback selectors."""
    results = []

    containers = (
        page.css('#b_results .b_algo')
        or page.css('.b_algo')
        or page.css('#b_results li')
    )

    for container in containers[:num_results]:
        # Title + Link
        title = ''
        url = ''
        for sel in ['h2 a', 'h2', '.b_title a']:
            title_el = container.css(sel)
            if title_el:
                title = title_el[0].text.strip()
                href = title_el[0].attrib.get('href', '')
                if href.startswith('http'):
                    url = href
                if title:
                    break

        # Snippet
        snippet = ''
        for sel in ['.b_caption p', '.b_algoSlug', '.b_paractl', '.qna_snippet']:
            snippet_el = container.css(sel)
            if snippet_el:
                snippet = snippet_el[0].text.strip()
                if snippet:
                    break

        if title and url:
            results.append({
                'title': title,
                'url': url,
                'snippet': snippet,
            })

    return results


def _do_search(params: dict) -> dict:
    """Execute web search with Google -> Bing fallback."""
    from scrapling.fetchers import Fetcher

    query = sanitize_search_text(params.get('query', ''))
    if not query:
        return {'results': [], 'error': 'Empty query'}

    num_results = min(params.get('numResults', 5), 10)
    timeout = min(params.get('timeout', 8), 20)
    encoded_query = urllib.parse.quote(query)

    # Try Bing first. Google often times out in China-like network paths and
    # can burn the whole tool budget before the fallback has a chance to run.
    bing_url = f'https://www.bing.com/search?q={encoded_query}&setlang=zh-CN&count={num_results}'
    log(f"Searching Bing: {bing_url}")

    try:
        page = Fetcher.get(bing_url, stealthy_headers=True, impersonate='chrome', timeout=timeout)
        results = _parse_bing_results(page, num_results)
        if results:
            log(f"Bing returned {len(results)} results")
            return {'results': results, 'source': 'bing'}
    except Exception as e:
        log(f"Bing search failed: {e}")

    # Fallback to Google
    google_url = f'https://www.google.com/search?q={encoded_query}&hl=zh-CN&num={num_results}'
    log(f"Falling back to Google: {google_url}")

    try:
        page = Fetcher.get(google_url, stealthy_headers=True, impersonate='chrome', timeout=timeout)
        results = _parse_google_results(page, num_results)
        if results:
            log(f"Google returned {len(results)} results")
            return {'results': results, 'source': 'google'}
    except Exception as e:
        log(f"Google search failed: {e}")

    return {'results': [], 'error': 'Both Google and Bing search failed'}


@register_tool('web_search')
def web_search(params: dict) -> dict:
    return _do_search(params)
