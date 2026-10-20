const extensionApi = typeof browser !== 'undefined' ? browser : chrome;

extensionApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== 'searchQuestion') return;

  findQuestionBackground(request.exam, request.topic, request.question)
    .then(sendResponse)
    .catch(error => {
      console.error('Search error:', error);
      sendResponse({ url: null, error: 'Search failed. Please retry.' });
    });
  return true;
});

function isCaptchaPage(html, url) {
  const content = (html + ' ' + url).toLowerCase();
  return /cf-turnstile|g-recaptcha|hcaptcha|cf-challenge|challenge-form|\/cdn-cgi\/|recaptcha/.test(content) &&
    /cloudflare|challenge|captcha/.test(content);
}

function extractQuestionLink(html, exam, topic, question) {
  const decoded = html.replace(/&amp;/gi, '&').replace(/\\u003d/gi, '=')
    .replace(/\\u0026/gi, '&').replace(/\\\//g, '/');
  const slug = `-exam-${exam}-topic-${topic}-question-${question}-discussion`;
  const candidates = decoded.match(/(?:https?:\/\/|\/url\?)[^\s"'<>]+/gi) || [];

  for (const candidate of candidates) {
    try {
      const link = new URL(candidate, 'https://www.google.com');
      const target = link.pathname === '/url' && link.searchParams.has('q')
        ? new URL(link.searchParams.get('q')) : link;
      if ((target.hostname === 'examtopics.com' || target.hostname === 'www.examtopics.com') &&
          target.pathname.startsWith('/discussions/') &&
          target.pathname.toLowerCase().replace(/\/$/, '').endsWith(slug)) {
        return target.origin + target.pathname;
      }
    } catch {
      // Ignore unrelated links.
    }
  }
  return null;
}

function isQuestionUrl(url, exam, topic, question) {
  try {
    const target = new URL(url);
    return (target.hostname === 'examtopics.com' || target.hostname === 'www.examtopics.com') &&
      target.pathname.startsWith('/discussions/') &&
      target.pathname.toLowerCase().replace(/\/$/, '').endsWith(
        `-exam-${exam}-topic-${topic}-question-${question}-discussion`
      );
  } catch {
    return false;
  }
}

async function followGoogleResult(tabId, exam, topic, question) {
  // Google sometimes uses opaque /goto?url=... links. In that case, let the browser
  // follow the actual result instead of trying to decode Google's private format.
  const [{ result: clicked }] = await extensionApi.scripting.executeScript({
    target: { tabId },
    func: (code, topicNumber, questionNumber) => {
      const title = `exam ${code} topic ${topicNumber} question ${questionNumber} discussion`;
      const heading = [...document.querySelectorAll('a h3')].find(node =>
        node.textContent.trim().toLowerCase() === title
      );
      if (!heading) return false;
      heading.closest('a').click();
      return true;
    },
    args: [exam, topic, question]
  });
  if (!clicked) return null;

  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => finish(null), 12000);
    function finish(url) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      extensionApi.tabs.onUpdated.removeListener(onUpdated);
      extensionApi.tabs.onRemoved.removeListener(onRemoved);
      resolve(url);
    }
    function onUpdated(id, change, tab) {
      if (id !== tabId) return;
      const url = change.url || tab.url;
      if (isQuestionUrl(url, exam, topic, question)) finish(url);
    }
    function onRemoved(id) {
      if (id === tabId) finish(null);
    }
    extensionApi.tabs.onUpdated.addListener(onUpdated);
    extensionApi.tabs.onRemoved.addListener(onRemoved);
    extensionApi.tabs.get(tabId).then(tab => {
      if (isQuestionUrl(tab?.url, exam, topic, question)) finish(tab.url);
    }).catch(() => finish(null));
  });
}

async function findQuestionBackground(exam, topic, question) {
  const code = exam.toLowerCase().trim();
  const query = `site:examtopics.com "Exam ${code} topic ${topic} question ${question} discussion"`;
  const searchUrl = `https://www.google.com/search?hl=en&q=${encodeURIComponent(query)}`;
  // Service-worker fetch often sees Google's JS-only page instead of the results
  // shown in the browser. Load the search in a real tab using the user's session.
  const tab = await extensionApi.tabs.create({ url: searchUrl, active: false });
  let keepTab = false;

  try {
    const loaded = await new Promise(resolve => {
      let settled = false;
      const timer = setTimeout(() => finish(false), 20000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        extensionApi.tabs.onUpdated.removeListener(onUpdated);
        extensionApi.tabs.onRemoved.removeListener(onRemoved);
        resolve(ok);
      }
      function onUpdated(id, change) {
        if (id === tab.id && change.status === 'complete') finish(true);
      }
      function onRemoved(id) {
        if (id === tab.id) finish(false);
      }
      extensionApi.tabs.onUpdated.addListener(onUpdated);
      extensionApi.tabs.onRemoved.addListener(onRemoved);
      extensionApi.tabs.get(tab.id).then(current => {
        if (current?.status === 'complete') finish(true);
      }).catch(() => finish(false));
    });
    if (!loaded) return { url: null, error: 'Search timed out. Please retry.' };

    const [{ result }] = await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href })
    });
    if (isCaptchaPage(result.html, result.url) || !['google.com', 'www.google.com'].includes(new URL(result.url).hostname)) {
      keepTab = true;
      await extensionApi.tabs.update(tab.id, { active: true });
      return { url: null, captcha: true, captchaUrl: result.url };
    }
    const url = extractQuestionLink(result.html, code, topic, question) ||
      await followGoogleResult(tab.id, code, topic, question);
    return { url, captcha: false, searchUrl: url ? null : searchUrl };
  } catch (error) {
    console.error('Browser search error:', error);
    return { url: null, error: 'Could not read search results. Please retry.' };
  } finally {
    if (!keepTab) extensionApi.tabs.remove(tab.id).catch(() => {});
  }
}
