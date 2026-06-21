// ==UserScript==
// @name         Amazon US Local Product Exporter
// @namespace    https://github.com/local/amazon-keyword-analysis
// @version      1.0.0
// @description  Export already-loaded Amazon US search/detail page product data to local JSON without extra network requests.
// @author       Local
// @match        https://www.amazon.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const EXPORT_BUTTON_ID = 'ak-export-products-button';
  const AMAZON_HOST_RE = /(^|\.)amazon\.com$/i;

  function isAmazonUsPage() {
    return AMAZON_HOST_RE.test(window.location.hostname);
  }

  function cleanText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function parsePrice(root) {
    const priceSelectors = [
      '.a-price:not(.a-text-price) .a-offscreen',
      '.a-price .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '#price_inside_buybox',
    ];
    for (const selector of priceSelectors) {
      const element = root.querySelector(selector);
      const text = cleanText(element && element.textContent);
      if (text) return text;
    }
    return '';
  }

  function parseNumericPrice(priceText) {
    const match = (priceText || '').replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function parseRating(root) {
    const ratingSelectors = [
      'i.a-icon-star-small span.a-icon-alt',
      'i.a-icon-star span.a-icon-alt',
      '[data-hook="average-star-rating"] .a-icon-alt',
      '#acrPopover .a-icon-alt',
    ];
    for (const selector of ratingSelectors) {
      const text = cleanText(root.querySelector(selector)?.textContent || root.querySelector(selector)?.getAttribute('aria-label'));
      const match = text.match(/([0-5](?:\.\d)?)\s+out of\s+5/i);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function parseReviewCount(root) {
    const selectors = [
      'a[href*="#customerReviews"] span.a-size-base',
      'a[href*="#customerReviews"]',
      '#acrCustomerReviewText',
      '[data-hook="total-review-count"]',
    ];
    for (const selector of selectors) {
      const text = cleanText(root.querySelector(selector)?.textContent);
      const match = text.replace(/,/g, '').match(/(\d+)/);
      if (match) return Number(match[1]);
    }
    return null;
  }

  function parseCategory(root) {
    const selectors = [
      '#wayfinding-breadcrumbs_feature_div ul li:last-child a',
      '#wayfinding-breadcrumbs_container ul li:last-child a',
      '.a-breadcrumb li:last-child a',
      '[data-component-type="s-search-result"] .a-row.a-size-base.a-color-secondary',
    ];
    for (const selector of selectors) {
      const text = cleanText(root.querySelector(selector)?.textContent);
      if (text) return text;
    }
    const navSearch = document.querySelector('#searchDropdownBox option:checked');
    return cleanText(navSearch?.textContent).replace(/^All\s+/i, '') || '';
  }

  function parseSearchResultCard(card) {
    const asin = card.getAttribute('data-asin') || '';
    if (!asin) return null;

    const titleElement = card.querySelector('h2 a span, h2 span, [data-cy="title-recipe"] span');
    const title = cleanText(titleElement?.textContent);
    if (!title) return null;

    const price = parsePrice(card);
    return {
      asin,
      title,
      price,
      price_value: parseNumericPrice(price),
      rating: parseRating(card),
      review_count: parseReviewCount(card),
      category: parseCategory(card),
      source: 'search_results',
      url: card.querySelector('h2 a')?.href || window.location.href,
    };
  }

  function parseDetailPage() {
    const asin = document.querySelector('#ASIN')?.value ||
      document.querySelector('[name="ASIN"]')?.value ||
      (window.location.pathname.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/) || []).slice(1).find(Boolean) || '';
    const title = cleanText(document.querySelector('#productTitle')?.textContent);
    if (!asin && !title) return [];
    const price = parsePrice(document);
    return [{
      asin,
      title,
      price,
      price_value: parseNumericPrice(price),
      rating: parseRating(document),
      review_count: parseReviewCount(document),
      category: parseCategory(document),
      source: 'product_detail',
      url: window.location.href,
    }];
  }

  function extractProducts() {
    const cards = Array.from(document.querySelectorAll('[data-component-type="s-search-result"][data-asin]'));
    const products = cards.map(parseSearchResultCard).filter(Boolean);
    if (products.length > 0) return dedupeByAsin(products);
    return parseDetailPage();
  }

  function dedupeByAsin(products) {
    const seen = new Set();
    return products.filter((product) => {
      const key = product.asin || `${product.title}|${product.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function downloadJson(products) {
    const payload = {
      exported_at: new Date().toISOString(),
      page_url: window.location.href,
      page_title: document.title,
      product_count: products.length,
      products,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `amazon_us_products_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function showStatus(message, isError = false) {
    const button = document.getElementById(EXPORT_BUTTON_ID);
    if (!button) return;
    button.textContent = message;
    button.style.background = isError ? '#b12704' : '#ff9900';
    setTimeout(() => {
      button.textContent = '导出Amazon商品JSON';
      button.style.background = '#ff9900';
    }, 2500);
  }

  function addExportButton() {
    if (!isAmazonUsPage() || document.getElementById(EXPORT_BUTTON_ID)) return;
    const button = document.createElement('button');
    button.id = EXPORT_BUTTON_ID;
    button.type = 'button';
    button.textContent = '导出Amazon商品JSON';
    Object.assign(button.style, {
      position: 'fixed',
      right: '18px',
      bottom: '24px',
      zIndex: '2147483647',
      padding: '12px 16px',
      border: '1px solid #a88734',
      borderRadius: '8px',
      background: '#ff9900',
      color: '#111',
      fontSize: '14px',
      fontWeight: '700',
      boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
      cursor: 'pointer',
    });
    button.addEventListener('click', () => {
      const products = extractProducts();
      if (products.length === 0) {
        showStatus('未识别到商品数据', true);
        return;
      }
      downloadJson(products);
      showStatus(`已导出 ${products.length} 个商品`);
    });
    document.body.appendChild(button);
  }

  addExportButton();
})();
