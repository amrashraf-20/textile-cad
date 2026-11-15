# نشر التطبيق مجانًا 100% (Render Free + Supabase Free)

هذا الدليل يشغّل التطبيق كاملًا (الواجهة + الـ API + قاعدة البيانات) على الإنترنت
بصفر جنيه، وبصفر بطاقة بنكية.

## الخطة المعمارية

```
Internet
   │  https://textile-cad.onrender.com
   ▼
Render Free Web Service  (حاوية واحدة)
   ├─ nginx   : يقدّم ملفات الواجهة (SPA)  ← المنفذ العام ($PORT)
   └─ Go API  : 127.0.0.1:9000            ← داخلي فقط
                     │
                     ▼
        Supabase Free Postgres (Frankfurt)
```

لماذا التصميم ده تحديدًا:

- **خدمة واحدة بدل ثلاث** لأن الخطة المجانية في Render بتدي 750 ساعة تشغيل في
  الشهر لكل الحساب، وخدمتين شغالين 24/7 = 1440 ساعة ← تعليق الخدمات.
- **نفس الأصل (same-origin)**: الواجهة بتنادي `/api/v1` و nginx بيمرّرها للـ API،
  فالكوكي (`SameSite=Lax`) و CORS بيشتغلوا من غير أي مشاكل.
- **سبين-أب واحد**: لو الـ API في خدمة منفصلة، أول زيارة بعد النوم بتطلع 502 لأن
  nginx بيصحى قبل الـ API. في حاوية واحدة العميل بيستنى مرة واحدة بس.

## ليه مش المنصات التانية؟

| المنصة | المشكلة |
| --- | --- |
| Northflank Sandbox | التوثيق بيقول لازم تضيف وسيلة دفع للتحقق من الهوية، رغم إن الصفحة بتقول "No card needed" |
| Oracle Cloud Always Free | أحسن سعرًا (VM كامل)، لكن لازم بطاقة للتحقق + ممكن يسترجعوا الـ VM لو الاستهلاك منخفض |
| Render Free Postgres | بينتهي بعد 30 يوم من الإنشاء |
| Neon Free | 100 CU-hour/شهر؛ الـ API بيعمل ping كل 30 ثانية فالقاعدة مش بتنام ← تستهلك ~180 CU-hour وتتوقف |
| Railway / Fly / Koyeb / Zeabur / Sevalla | مفيش خطة مجانية دائمة تشغّل التطبيق |
| Back4App Containers | مجاني بدون بطاقة، لكن 256MB RAM فقط (خطة بديلة لو Render رفض) |

## المتطلبات

1. حساب GitHub (مجاني).
2. حساب Render (مجاني، بدون بطاقة) — <https://dashboard.render.com/register>
3. حساب Supabase (مجاني، بدون بطاقة) — <https://supabase.com/dashboard/sign-up>

> مش محتاج Docker على جهازك: Render بيبني الصورة (`deploy/free/Dockerfile`) على
> سيرفراته. ده مفيد خصوصًا لو الـ virtualization متعطّل في الجهاز.

---

## الخطوة 1 — قاعدة البيانات على Supabase

1. اعمل مشروع جديد، واختار **Region: Frankfurt** (أقرب لمصر وأوروبا).
2. احفظ **Database Password** اللي هتكتبه.
3. من `Project Settings → Database → Connection string` اختار
   **Session pooler** (مش Transaction pooler) وانسخ السلسلة. هتكون بالشكل:

   ```
   postgres://postgres.<project-ref>:<PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
   ```

4. ضيف آخر السلسلة `?sslmode=require&search_path=public,extensions`، لأن
   إضافات Supabase (`citext`) بتتثبت في schema اسمه `extensions`:

   ```
   postgres://postgres.<project-ref>:<PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&search_path=public,extensions
   ```

   > استخدم Session pooler (بورت 5432). الـ Transaction pooler (بورت 6543) مش
   > بيدعم prepared statements اللي pgx بيستخدمها.

5. **مهم أمنيًا**: التطبيق بيخزّن `password_hash` و `refresh_tokens` في schema
   `public`. في Supabase لازم تقفل الـ Data API عن الجداول دي:

   - `Project Settings → API → Data API Settings` → اقفل/عطّل الـ Data API، أو
   - من `SQL Editor` نفّذ:

   ```sql
   revoke all on all tables    in schema public from anon, authenticated;
   revoke all on all sequences in schema public from anon, authenticated;
   revoke all on all functions in schema public from anon, authenticated;
   alter default privileges in schema public revoke all on tables from anon, authenticated;
   ```

   التطبيق نفسه بيتصل بمستخدم `postgres` مباشرة، فمش محتاج الـ Data API خالص.

---

## الخطوة 2 — ارفع الكود على GitHub

المشروع عندك مش git repo. من داخل مجلد `textile-cad`:

```powershell
git init
git add .
git commit -m "textile-cad: initial deploy"
git branch -M main
# اعمل repo فاضي على GitHub باسم textile-cad ثم:
git remote add origin https://github.com/<USERNAME>/textile-cad.git
git push -u origin main
```

ملاحظة: `.env` مستثنى في `.gitignore` فمش هيتدفع — وده المطلوب.

---

## الخطوة 3 — أنشئ الخدمة على Render

1. Render Dashboard → **New → Blueprint**.
2. اختار الـ repo. Render هيقرأ `render.yaml` ويوريك خدمة واحدة `textile-cad`.
3. هيطلب منك القيم اللي معلّمة `sync: false`:

   | المتغير | القيمة |
   | --- | --- |
   | `DATABASE_URL` | سلسلة Supabase من الخطوة 1 |
   | `SEED_ADMIN_EMAIL` | إيميل الأدمن |
   | `SEED_ADMIN_PASSWORD` | باسورد 10 أحرف على الأقل |

   و `JWT_SECRET` بيتولد تلقائيًا.

4. **Apply** واستنى الديبلوي (٥–١٠ دقايق أول مرة: `npm ci` + `vite build` +
   `go build`).
5. لما تخلص، الرابط: `https://textile-cad.onrender.com`

`render.yaml` بيضبط تلقائيًا:

- `APP_ENV=production` و `COOKIE_SECURE=true` (إلزاميين وإلا الـ API بيرفض يشتغل)
- `PUBLIC_WEB_URL` و `CORS_ORIGINS` من `RENDER_EXTERNAL_URL` اللي Render بيوفّرها
  (عن طريق `deploy/free/entrypoint.sh`)
- `AUTO_MIGRATE=true` فالجداول بتتعمل أول تشغيل
- `RUN_SEED_ON_BOOT=true` فحساب الأدمن بيتعمل تلقائيًا

### بعد أول تشغيل ناجح

غيّر `RUN_SEED_ON_BOOT` إلى `false` من `Environment` في Render، لأن الـ seed
بيعيد ضبط باسورد الأدمن في كل إعادة تشغيل (وبالتالي هيلغي أي تغيير للباسورد من
جوه التطبيق).

---

## الخطوة 4 — خلّي الخدمة صاحية (اختياري)

الخدمة المجانية بتنام بعد 15 دقيقة بدون زيارات، وأول طلب بعد النوم بياخد ~دقيقة.

- حل بسيط: استخدم <https://cron-job.org> (مجاني) يعمل GET على
  `https://textile-cad.onrender.com/healthz` كل 10 دقايق **خلال ساعات العمل فقط**
  (مثلًا 8ص–10م).
- متخليش الـ ping 24 ساعة كل يوم: هتستهلك ~720 من 750 ساعة وتبقى على الحد.

---

## الحدود والقيود (اقرأها)

| البند | القيمة |
| --- | --- |
| تكلفة | 0 جنيه، بدون بطاقة |
| CPU / RAM | 0.1 CPU / 512MB |
| ساعات التشغيل | 750 ساعة/شهر لكل الحساب |
| النوم | بعد 15 دقيقة خمول، إيقاظ ~1 دقيقة |
| قاعدة البيانات | Supabase Free: 500MB، مشروع بيتوقف بعد أسبوع خمول (الـ API بيمنعه) |
| نسخ احتياطي | **مفيش** — اعمل `pg_dump` بنفسك دوريًا |
| التوسّع الأفقي | غير ممكن: الـ rate limit في الذاكرة (instance واحدة) |

نسخة احتياطية سريعة (من جهازك):

```powershell
pg_dump "postgres://postgres.<ref>:<PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require" `
  -Fc -f "textile-$(Get-Date -Format yyyyMMdd).dump"
```

---

## استكشاف الأخطاء

| العرض | السبب / الحل |
| --- | --- |
| الديبلوي بيفشل عند `go build` | تأكد إن `backend/go.mod` بيطلب نسخة Go متاحة في `golang:1.26-alpine` |
| `config: JWT_SECRET must be at least 32 bytes` | امسح `JWT_SECRET` من Environment وسيبه يتولد، أو حط 48 حرف عشوائي |
| `config: COOKIE_SECURE must be true in production` | `COOKIE_SECURE=true` و `APP_ENV=production` |
| `origin_not_allowed` عند تسجيل الدخول | `CORS_ORIGINS` لازم يساوي رابط Render بالحرف بدون `/` في الآخر |
| `type "citext" does not exist` | ناقص `search_path=public,extensions` في `DATABASE_URL` |
| `database unreachable` | استخدم Session pooler (5432) مش direct connection (IPv6) |
| 502 من nginx | الـ API وقع — بص على Logs في Render (الحاوية بتقفل لو أي عملية ماتت) |
| شاشة "spinning up" طويلة | طبيعي في الخطة المجانية بعد 15 دقيقة خمول |

لو `citext` لسه مش موجود، نفّذ في `SQL Editor` على Supabase قبل الديبلوي:

```sql
create schema if not exists extensions;
create extension if not exists citext   with schema extensions;
create extension if not exists pgcrypto with schema extensions;
```


## تشغيل نفس الحاوية محليًا (اختياري)

```powershell
docker build -f deploy/free/Dockerfile -t textile-cad:allinone .
docker run --rm -p 8080:8080 --env-file .env `
  -e APP_ENV=production -e COOKIE_SECURE=true `
  -e DATABASE_URL="postgres://...supabase..." `
  textile-cad:allinone
# http://localhost:8080
```

`docker-compose.yml` الأصلي (db + api + web منفصلين) يفضل زي ما هو للتطوير
المحلي وعلى VPS مدفوع.
