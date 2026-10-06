# AI Teams

نسخه وب چندعاملی برای ساخت تیمی از هوش مصنوعی‌ها.

## امکانات
- افزودن و حذف عامل‌ها
- تعریف نام، نقش و System Prompt برای هر عامل
- فعال/غیرفعال کردن اعضا
- تعیین Provider، Endpoint، مدل و API Key برای هر عامل
- حالت نمایشی بدون API
- حالت اتصال واقعی به APIهای سازگار با OpenAI Chat Completions
- اجرای ترتیبی تیم
- انتقال هدف و خروجی اعضای قبلی به عضو بعدی
- نمایش خطاهای هر مرحله بدون متوقف کردن کل تیم
- تست اتصال هر عامل
- ذخیره تنظیمات در مرورگر
- حافظه دائمی پروژه برای خلاصه اجرای تیم‌ها
- همگام‌سازی خودکار تغییرات با Supabase پس از ورود
- خروجی تنظیمات بدون API Key
- طراحی واکنش‌گرا برای موبایل و دسکتاپ

## اجرای آنلاین
این پروژه برای GitHub Pages آماده است و از `index.html` در شاخه `main` استفاده می‌کند.

## اتصال واقعی
برای اجرای واقعی، Provider و Model را برای هر عامل انتخاب کن. AI Horde مستقیماً و بدون کلید قابل استفاده است؛ Providerهای دیگر از Gateway امن Supabase استفاده می‌کنند و کلیدشان فقط باید در Secretهای سمت سرور Gateway تنظیم شود. برای Custom نیز Endpoint فقط از allowlist سمت سرور استفاده می‌شود.

در اجرای واقعی، درخواست هر عامل شامل هدف تیم، حافظه پروژه و خروجی اعضای قبلی است.

## امنیت
کلیدهای API در نسخه فعلی عمداً داخل state مرورگر ذخیره نمی‌شوند و Providerهای پولی باید از طریق Gateway امن فراخوانی شوند. AI Horde برای تست رایگان بدون کلید در نظر گرفته شده است. برای اجرای واقعی Providerهای پولی، Gateway امن و secrets سمت سرور باید تنظیم شوند.

## ساختار فعلی
- `index.html`: کل رابط کاربری و orchestrator سمت مرورگر
- `provider-manager.js`: مدیریت Providerها، اتصال مدل‌ها و Gateway
- `cloud-storage.js`: ورود، ذخیره‌سازی ابری و فراخوانی Gateway
- `multiplayer.js`: همکاری آنلاین و اعضای انسانی
- `workspace-manager.js`: مدیریت Workspace و پروژه‌ها
- `github-storage.js`: ذخیره/همگام‌سازی با GitHub
- `google-drive-storage.js`: ذخیره/همگام‌سازی با Google Drive
- `README.md`: راهنمای پروژه

## وضعیت معماری
- Gateway امن Supabase برای Providerهای دارای کلید
- OAuth امن GitHub با رمزنگاری توکن سمت سرور
- حافظه دائمی پروژه و تاریخچه اجراها
- اجرای ترتیبی تیم، گفت‌وگوی چنددوره‌ای و چت ادمین
- رابط chat-first و responsive برای موبایل و دسکتاپ

## موارد وابسته به تنظیمات بیرونی
برای فعال شدن کامل سرویس‌های ابری و Providerهای پولی باید Project URL/Publishable Key پروژه Supabase و Secretهای Gateway در پروژه واقعی تنظیم شوند. این مقادیر را عمداً داخل GitHub یا مرورگر قرار نمی‌دهیم.


## تکمیل نهایی و راه‌اندازی سرویس‌های بیرونی

هسته برنامه، GitHub Pages، Supabase Cloud، RLS، AI Gateway، AI Horde رایگان، حافظه پروژه، مدیریت Workspace، همکاری انسانی، GitHub Gateway، Google Drive integration، طراحی chat-first، موبایل و تست‌های CI/E2E در مخزن فعال هستند.

### فقط تنظیمات خارج از دسترس کد

این موارد عمداً داخل GitHub یا مرورگر قرار داده نمی‌شوند:

1. **GitHub OAuth**
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `GITHUB_TOKEN_ENCRYPTION_KEY` (۶۴ کاراکتر hex)
   - Redirect URI:
     `https://gqymrljvbkxlgyvoykpv.supabase.co/functions/v1/github-gateway?action=oauth-callback`

2. **Providerهای پولی**
   - `AI_TEAMS_PROVIDER_KEYS` در Secretهای Supabase برای OpenAI / OpenRouter / Anthropic / Gemini.
   - کلیدها هرگز نباید در `index.html`، `localStorage` یا Agent state قرار بگیرند.

3. **Google Drive**
   - Google OAuth Client ID را می‌توان از داخل پنجره Google Drive وارد کرد.
   - دسترسی برنامه فقط به `appDataFolder` محدود شده است.

بعد از تنظیم Secrets بالا، فقط اتصال/تأیید حساب‌ها در اولین اجرا لازم است؛ کد و استقرار از قبل آماده هستند.

## کنترل کیفیت

- تست syntax برای اسکریپت‌های مرورگر
- smoke test تعیین‌گر برای UI، Provider، Gateway، همکاری آنلاین و Drive
- Playwright E2E برای دسکتاپ و موبایل
- اعتبارسنجی Deno Edge Functions
- بررسی Security/Performance Advisorهای Supabase
- CI روی هر Push به `main`


## وابستگی‌های مرورگر و Gateway

برای جلوگیری از تغییر ناخواسته نسخه‌های runtime، Supabase JS در مرورگر روی `2.117.2` و `@supabase/server` در Edge Functions روی `1.9.0` پین شده‌اند. تست E2E نیز روی Playwright `1.63.0` پین است.

## Completion validation (v3)
The repository includes the v3 orchestration layer with sequential team control, timeline events, pause/resume/retry/skip/stop controls, structured evidence, executable local tools, per-agent memory, security audit checks, and JSON run reports.
Free AI connectivity uses the official AI Horde OpenAI-compatible endpoint. Paid Providers remain server-side Gateway integrations and require their provider credentials to be configured in Supabase.
