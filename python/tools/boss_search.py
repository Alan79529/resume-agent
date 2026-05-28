"""Boss直聘职位搜索工具，使用 Scrapling StealthyFetcher。"""

import sys
import os
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from server import register_tool, log
from tools.search_text import sanitize_search_text


# Boss直聘城市代码映射
CITY_CODES = {
    '全国': '100010000',
    '北京': '101010100',
    '上海': '101020100',
    '深圳': '101280600',
    '广州': '101280100',
    '杭州': '101210100',
    '成都': '101270100',
    '南京': '101190100',
    '武汉': '101200100',
    '西安': '101110100',
    '厦门': '101230200',
    '长沙': '101250100',
    '苏州': '101190400',
    '天津': '101030100',
    '重庆': '101040100',
    '郑州': '101180100',
    '东莞': '101281600',
    '青岛': '101120200',
    '合肥': '101220100',
    '昆明': '101290100',
    '福州': '101230100',
    '济南': '101120100',
    '宁波': '101210400',
    '大连': '101070200',
    '珠海': '101280700',
}


def _parse_job_listings(page) -> list:
    """Parse Boss直聘 job listings with multiple fallback selectors."""
    jobs = []

    # Try multiple card container selectors
    cards = (
        page.css('.job-card-wrapper')
        or page.css('[class*="job-card"]')
        or page.css('.search-job-result .job-list li')
        or page.css('.job-list-box .job-card-wrapper')
        or page.css('[class*="search-job-result"] li')
    )

    for card in cards:
        try:
            # 职位名称
            title = ''
            for sel in ['.job-name', '[class*="job-name"]', '.job-title', '[class*="job-title"]']:
                title_el = card.css(sel)
                if title_el:
                    title = title_el[0].text.strip()
                    if title:
                        break

            # 公司名称
            company = ''
            for sel in ['.company-name a', '[class*="company-name"]', '.info-company .name', '.company-name']:
                company_el = card.css(sel)
                if company_el:
                    company = company_el[0].text.strip()
                    if company:
                        break

            # 薪资
            salary = ''
            for sel in ['.salary', '[class*="salary"]', '.job-limit .red', '.salary-wrap']:
                salary_el = card.css(sel)
                if salary_el:
                    salary = salary_el[0].text.strip()
                    if salary:
                        break

            # 地点
            location = ''
            for sel in ['.job-area', '[class*="job-area"]', '.job-limit .info-desc', '.job-area-wrapper']:
                location_el = card.css(sel)
                if location_el:
                    location = location_el[0].text.strip()
                    if location:
                        break

            # 职位链接
            url = ''
            link_el = card.css('a[href*="/job_detail"]')
            if not link_el:
                link_el = card.css('a[href*="job_detail"]')
            if link_el:
                href = link_el[0].attrib.get('href', '')
                if href:
                    url = f'https://www.zhipin.com{href}' if href.startswith('/') else href

            # 职位描述/标签
            description = ''
            tag_els = (
                card.css('.tag-list span')
                or card.css('.job-tags span')
                or card.css('[class*="tag"] span')
                or card.css('.job-info .tag-list span')
            )
            if tag_els:
                description = ', '.join(el.text.strip() for el in tag_els if el.text.strip())

            if title and company:
                jobs.append({
                    'title': title,
                    'company': company,
                    'salary': salary,
                    'location': location,
                    'url': url,
                    'description': description,
                })
        except Exception as e:
            log(f"Error parsing job card: {e}")
            continue

    return jobs


def _do_boss_search(params: dict) -> dict:
    """Execute Boss直聘 search."""
    from scrapling.fetchers import StealthyFetcher

    keyword = sanitize_search_text(params.get('keyword', ''))
    if not keyword:
        return {'jobs': [], 'error': 'Empty keyword'}

    city_name = sanitize_search_text(params.get('city', '全国'))
    city_code = CITY_CODES.get(city_name, CITY_CODES.get('全国', '100010000'))
    page_num = params.get('page', 1)

    encoded_keyword = urllib.parse.quote(keyword)
    url = f'https://www.zhipin.com/web/geek/job?query={encoded_keyword}&city={city_code}&page={page_num}'

    log(f"Searching Boss直聘: {url}")

    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            wait_selector='.job-card-wrapper, [class*="job-card"], .search-job-result, .job-list-box',
            timeout=12000,
            disable_resources=True,
        )

        if not page:
            return {'jobs': [], 'error': 'Failed to load page'}

        final_url = str(getattr(page, 'url', '') or '')
        page_text = str(getattr(page, 'text', '') or '')
        if '/web/user' in final_url or '登录' in page_text[:2000] or '安全验证' in page_text[:2000]:
            return {
                'jobs': [],
                'source': 'zhipin',
                'error': 'Boss直聘跳转到登录或安全验证页面，请先在右侧浏览器完成登录/验证后再搜索。'
            }

        jobs = _parse_job_listings(page)
        log(f"Boss直聘 returned {len(jobs)} jobs")

        if jobs:
            return {'jobs': jobs, 'source': 'zhipin'}

        # Try to extract error message from page
        error_msg = ''
        for sel in ['.error-text', '.empty-text', '[class*="empty"]', '.no-data']:
            error_el = page.css(sel)
            if error_el:
                error_msg = error_el[0].text.strip()
                if error_msg:
                    break

        return {
            'jobs': [],
            'source': 'zhipin',
            'error': error_msg or 'No jobs found. The page structure may have changed.'
        }

    except Exception as e:
        log(f"Boss直聘 search failed: {e}")
        message = str(e)
        if 'Timeout' in message and 'job-card' in message:
            return {
                'jobs': [],
                'source': 'zhipin',
                'error': 'Boss直聘未返回职位列表，通常是登录或安全验证拦截。请先在右侧浏览器完成登录/验证后再搜索。'
            }
        return {'jobs': [], 'error': message}


@register_tool('boss_search')
def boss_search(params: dict) -> dict:
    return _do_boss_search(params)
