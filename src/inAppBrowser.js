// Detects in-app browsers (e.g., Messenger, Facebook, Instagram, LINE, WeChat)
// where iOS/Android WKWebView blocks automatic redirects to the external browser.

const DISMISS_STORAGE_KEY = 'tapcolor_iab_banner_dismissed';

const IN_APP_BROWSER_RULES = [
  { name: 'Messenger', pattern: /FBAN\/Messenger|FB_IAB.*Messenger|Messenger(?:Lite)?/i },
  { name: 'Facebook', pattern: /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i },
  { name: 'Instagram', pattern: /Instagram/i },
  { name: 'WhatsApp', pattern: /WhatsApp/i },
  { name: 'LINE', pattern: /Line\//i },
  { name: 'WeChat', pattern: /MicroMessenger/i },
  { name: 'Snapchat', pattern: /Snapchat/i },
  { name: 'TikTok', pattern: /BytedanceWebview|musical_ly|TikTok/i },
  { name: 'Telegram', pattern: /Telegram/i },
  { name: 'LinkedIn', pattern: /LinkedInApp/i },
];

/**
 * Detect whether the current User-Agent is an in-app browser from a messaging
 * or social app, along with the detected app name and mobile platform.
 *
 * @param {string} [userAgent]
 * @returns {{ isInAppBrowser: boolean, appName: string | null, platform: 'ios' | 'android' | 'other' }}
 */
export function detectInAppBrowser(userAgent) {
  const ua = typeof userAgent === 'string'
    ? userAgent
    : (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');

  const isIos = /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const platform = isIos ? 'ios' : (isAndroid ? 'android' : 'other');

  if (!ua) {
    return { isInAppBrowser: false, appName: null, platform };
  }

  for (const rule of IN_APP_BROWSER_RULES) {
    if (rule.pattern.test(ua)) {
      return { isInAppBrowser: true, appName: rule.name, platform };
    }
  }

  return { isInAppBrowser: false, appName: null, platform };
}

function isStandaloneApp() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    return window.navigator?.standalone === true;
  } catch {
    return false;
  }
}

function isDismissedThisSession() {
  try {
    return window.sessionStorage?.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissedThisSession() {
  try {
    window.sessionStorage?.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // Ignore storage errors in restricted webviews
  }
}

function buildInstructionMessage(appName, platform) {
  const sourceLabel = appName ? `Opened in ${appName}` : 'Opened in an app browser';
  if (platform === 'android') {
    return `${sourceLabel} — tap the ⋮ menu and select "Open in Browser" so your coloring progress saves.`;
  }
  return `${sourceLabel} — tap the ••• menu and select "Open in Browser" so your coloring progress saves.`;
}

/**
 * Initialize and display the non-blocking in-app browser banner when needed.
 *
 * @param {{ onVisibilityChange?: (visible: boolean) => void }} [options]
 * @returns {boolean} Whether the banner is currently shown
 */
export function initInAppBrowserBanner({ onVisibilityChange } = {}) {
  if (typeof document === 'undefined' || isStandaloneApp() || isDismissedThisSession()) {
    return false;
  }

  const { isInAppBrowser, appName, platform } = detectInAppBrowser();
  if (!isInAppBrowser) {
    return false;
  }

  const banner = document.getElementById('iab-banner');
  const textEl = document.getElementById('iab-banner-text');
  const dismissBtn = document.getElementById('iab-banner-dismiss');
  if (!banner || !textEl || !dismissBtn) {
    return false;
  }

  textEl.textContent = buildInstructionMessage(appName, platform);
  banner.classList.remove('hidden');
  document.documentElement.classList.add('has-iab-banner');

  const syncHeight = () => {
    if (banner.classList.contains('hidden')) return;
    const height = banner.offsetHeight;
    document.documentElement.style.setProperty('--iab-banner-height', `${height}px`);
  };

  syncHeight();
  window.addEventListener('resize', syncHeight);

  dismissBtn.addEventListener('click', () => {
    banner.classList.add('hidden');
    document.documentElement.classList.remove('has-iab-banner');
    document.documentElement.style.removeProperty('--iab-banner-height');
    window.removeEventListener('resize', syncHeight);
    markDismissedThisSession();
    onVisibilityChange?.(false);
  });

  return true;
}
