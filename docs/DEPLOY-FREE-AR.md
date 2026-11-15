# نشر مجاني بدون بطاقة (الوضع الحقيقي)

آخر تحديث: **نوفمبر 2026**

## الخلاصة في سطرين

كل منصات الـ PaaS المجانية بقت تطلب **بطاقة** أو اشتراك **PRO** حتى للخطة المجانية.
الحل الوحيد اللي اشتغل فعليًا **بدون بطاقة ولا حساب**: تشغيل التطبيق على جهازك وفتح
**نفق Cloudflare** عام له. الرابط عام وشغّال 100%، لكنه بيعتمد على إن الجهاز والنت شغالين.

## اللي جرّبناه وليه فشل

| المنصة | النتيجة |
|---|---|
| **Render** (Free) | الـ API بيرفض: `402 Payment Required` — البطاقة بقت إلزامية |
| **Back4App Containers** | الرفع بيفرد الملفات في مستوى واحد → `stat /src/cmd/api: directory not found`. وبعد ما صلّحنا، الخطة المجانية بتدي **URL مؤقت لمدة 60 دقيقة** |
| **Hugging Face Spaces** (Docker) | `402 Payment Required — hosting Gradio and Docker Spaces on free cpu-basic requires a PRO subscription` |
| **Koyeb** | مفيش خطة مجانية |
| **Northflank / Fly / Oracle / GCP / Azure** | بطاقة إلزامية |
| **Neon** | مجاني لكن حد الـ CU-hours بيتخطى لأن الـ pgxpool بيعمل ping كل 30 ثانية → استخدمنا **Supabase** بدلها |

## الحل الشغّال

```
جهازك:  nginx/SPA + Go API + Supabase (Postgres سحابي مجاني)
        ↑ cloudflared quick tunnel
الإنترنت: https://<random>.trycloudflare.com
```

- **مجاني تمامًا** — مفيش حساب ولا بطاقة (quick tunnel).
- **نفس الأصل (same-origin)** — الواجهة والـ API على نفس الهوست، فمفيش مشاكل CORS أو كوكيز.
- **قاعدة البيانات سحابية** على Supabase — يعني البيانات مش هتضيع لو الجهاز قفل.

## التشغيل والإيقاف

### مرة واحدة

```powershell
powershell -ExecutionPolicy Bypass -File "deploy\free\start-public.ps1"
```

السكربت بيعمل الآتي تلقائيًا:

1. يبني الواجهة (`frontend/dist`) لو المصدر أحدث.
2. يبني ويشغّل الـ API على `127.0.0.1:8080` بوضع production.
3. يشغّل `vite preview` على `127.0.0.1:5173` (بيعمل proxy لـ `/api`).
4. يفتح نفق Cloudflare ويطبع الرابط العام.
5. يكتب الرابط في **`public-url.txt`** في جذر المشروع.
6. يفضل يراقب: لو أي خدمة وقعت بيرجّعها، ولو النفق اتغيّر بيعيد تشغيل الـ API
   بالـ origin الجديد علشان الكوكيز والـ CORS يفضلوا شغالين.

### التشغيل التلقائي عند فتح Windows

اتعمل بالفعل: اختصار في

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\textile-cad-public.vbs
```

بيشغّل `%LOCALAPPDATA%\textile-cad\start-public.cmd` مخفي من غير أي نافذة.

- لإيقاف التشغيل التلقائي: امسح ملف `textile-cad-public.vbs` من فولدر Startup.
- لمتابعة اللوج: `%LOCALAPPDATA%\textile-cad\logs\` و `%LOCALAPPDATA%\textile-cad\supervisor.log`.

### ملاحظة عن تغيّر الرابط

الـ quick tunnel بيدّي **اسم عشوائي جديد** كل مرة يشتغل. الرابط الحالي دايماً في:

```
public-url.txt
```

ولو عايز رابط ثابت فعلاً، الحلول (كلها تحتاج حساب/بطاقة):

- Cloudflare Tunnel مسمّى + دومين على Cloudflare.
- ngrok بحساب مجاني + **static domain** (بيضيف صفحة تحذير للمتصفح في الخطة المجانية).
- أي PaaS مدفوع (Render Starter / Fly / Railway) برابط ثابت.

## تسجيل الدخول

- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` من `.env` (اتعمل منهم الأدمن عند أول تشغيل).
- في الإنتاج: `APP_ENV=production` + `COOKIE_SECURE=true` + `JWT_SECRET` بطول 32+ بايت.

## تشغيل الـ Docker محليًا (لو فعّلت virtualization)

```powershell
docker compose up --build
# http://localhost:3000
```

الصورة الموحّدة: `Dockerfile` في الجذر (nginx + Go API) — جاهزة لأي منصة بتقبل Docker.

## المشاكل الشائعة

| العرض | السبب / الحل |
|---|---|
| `origin_not_allowed` | الـ `Origin` مش في `CORS_ORIGINS`. الـ API بقى يسمح بالـ same-origin تلقائيًا، والسكربت بيضبط الـ origin من رابط النفق |
| `type "citext" does not exist` | نفّذ `create extension if not exists citext;` في Supabase SQL Editor |
| الكوكي مش بيتحفظ | تأكد `COOKIE_SECURE=true` والرابط `https` (النفق بيدي https) |
| `502` من الـ API | شوف `%LOCALAPPDATA%\textile-cad\logs\api.log` |
| AI chat بيرجع 401/404 | مفتاح OpenRouter منتهي أو الموديل اتشال — غيّر المفتاح والموديل من Settings |
