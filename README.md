# ExamTopics Navigator

## Summary
ExamTopics Navigator is a Chrome extension that helps you quickly move between ExamTopics questions and topics and jump to a specific exam code, topic, and question.

## Installation (Chrome / Firefox)
0. Download or clone this repository
1. Open Chrome and go to chrome://extensions
2. Enable Developer mode (top right corner toogle)
3. Click Load unpacked
4. Select this project folder: ExamTopicsExtension
5. Pin the extension (optional) so the popup is easy to access

For Firefox, open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `manifest.json` in this folder. Temporary add-ons are removed when Firefox closes; install a signed package for persistent use.

To update after changes:
> In Chrome, go to `chrome://extensions` and click Reload on the extension card. In Firefox, use Reload in `about:debugging#/runtime/this-firefox`, then refresh any open ExamTopics tabs.

## Usage
### On ExamTopics pages
Open any https://www.examtopics.com page. A small on-page panel is available to navigate.

![main_page.png](screenshots/main_page.png)

You can enter Exam Code, Topic, and Question to jump directly. Use Hide to hide the panel and use the small Open button to show it again.

![open_circle.png](screenshots/open_circle.png)

### Using the extension popup
Click the extension icon to open the popup. Use Next and Previous to navigate. Use Go To to open an exact topic and question.

![discussion_page.png](screenshots/discussion_page.png)

## IMPORTANT
### Ask ChatGPT
Expand **Settings** in the on-page panel or extension popup, enter your OpenAI API key, choose **Russian** or **English**, and click **Save settings**. Both interfaces use the same settings. To remove the key, click **Remove key**. The settings form runs in an extension-origin iframe, so the ExamTopics page cannot read its input or the saved key. Popup settings are also available outside ExamTopics.

With a saved key, two buttons appear in one row: a smaller secondary **Answer only** button for just the correct option(s), and a wider primary **Ask ChatGPT** button for a detailed explanation. The choice applies only to that request; both use the saved language, a separate answer window and streaming. Answer-only requests use a concise instruction and a 1,024-token output budget (including reasoning), compared with 8,000 for detailed responses. The full question and its images are still sent.

With a saved key, **Ask ChatGPT** appears in the popup on ExamTopics and in the on-page panel. On a question discussion page, click it to send only the question text, answer choices and question images to OpenAI and receive a detailed explanation, including the best answer and analysis of alternative options. A separate, resizable 1000×800 answer window opens. Text appears incrementally as OpenAI generates it, and continues if you close the extension popup or navigate the original question tab. Use **Stop generating** to cancel while keeping the text already received. Closing the answer window cancels its active request. If the connection fails, partial text remains visible with an error. Answers are kept only in the open window; reloading it requires starting a new request from the question page.

The key is stored in the extension's local browser storage, not synced. Requests go directly from the extension background to `https://api.openai.com/v1/responses` using `gpt-6-astra`; API access and billing are separate from a ChatGPT subscription. The extension requests `store: false`. Question content is sent only when you click the button. Images are sent as multimodal `input_image` parts using HTTPS image URLs or supported image data URLs; remote URLs must be publicly accessible to OpenAI. Unsupported images, questions over 60,000 text characters or over 20 images produce an error instead of sending a partial question. Answers are displayed as plain text. The selected answer language is saved locally and takes priority over the browser language; the default is English. You can save the language without re-entering or replacing a saved API key.

After updating the extension, reload it and refresh ExamTopics tabs to enable the new feature and permission for `api.openai.com`.

### Question extraction rules
The rules were checked against [AZ-900 topic 1 question 20](https://www.examtopics.com/discussions/microsoft/view/56636-exam-az-900-topic-1-question-20-discussion/):

1. Require exactly one `.discussion-header-container .question-body`.
2. Read only its direct `.card-text` and optional `.question-choices-container` children. On the reference page, both the prompt and A/B choices are inside `.card-text`.
3. Preserve line breaks, table cells and question image positions. Resolve relative and lazy image URLs; deduplicate identical images.
4. Exclude suggested/correct answers, voting badges, hidden elements, buttons, scripts and everything outside those question roots (comments, author, navigation, advertisements and the extension panel).
5. If no unambiguous question is found, stop with an error. There is no whole-page fallback, including on exam overview pages.

Live text updates follow the [official OpenAI streaming events](https://developers.openai.com/api/docs/guides/streaming-responses). Image inputs follow the [official OpenAI vision format](https://developers.openai.com/api/docs/guides/images-vision#analyze-images).

### Development checks
Run `npm ci` then `npm test` for extraction, settings UI and mocked API integration tests (no key or paid requests required). No build step is needed for the extension.

### Navigation captchas
If navigation cannot find a page, Google may require a captcha. Solve it in the opened tab.

![captcha.png](screenshots/captcha.png)

Close opened search page.

![page_to_close.png](screenshots/page_to_close.png)

Try again whatever you clicked.

![retry.png](screenshots/retry.png)
