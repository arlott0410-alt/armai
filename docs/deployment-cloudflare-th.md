# ขั้นตอน Deploy ArmAI บน Cloudflare (Workers + Pages)

คู่มือนี้สรุปวิธีติดตั้งและรันโปรเจกต์บน Cloudflare ทั้ง **Workers** (API) และ **Pages** (เว็บแดชบอร์ด)

---

## สิ่งที่ต้องมีก่อนเริ่ม

- บัญชี [Cloudflare](https://dash.cloudflare.com)
- โปรเจกต์ ArmAI push ขึ้น **GitHub** แล้ว
- สร้างโปรเจกต์ **Supabase** และรัน SQL ครบแล้ว (ดู `docs/manual-setup-checklist.md`)
- Node.js 18+ (ใช้ตอน build หรือรัน wrangler ในเครื่อง)

---

## ส่วนที่ 1: Cloudflare Workers (API)

Workers คือ backend API ของ ArmAI (Hono) รันบน Edge

### 1.1 สร้าง R2 Bucket (เก็บรูป slip)

1. เข้า [Cloudflare Dashboard](https://dash.cloudflare.com) → เลือก Account
2. ไปที่ **R2 Object Storage** → **Overview** → **Create bucket**
3. ตั้งชื่อ bucket เช่น `armai-slips` → **Create bucket**
4. **จดชื่อ bucket ไว้** — ใช้ตอนตั้งค่า Worker

### 1.2 Deploy Worker ผ่าน Dashboard (เชื่อม GitHub)

1. ไปที่ **Workers & Pages** → **Create** → **Worker**
2. เลือก **Deploy with Git** (เชื่อม GitHub)
3. เลือก repo ของ ArmAI และ branch (เช่น `main`)
4. ตั้งค่า Build:
   - **Build configuration**
     - Framework preset: **None**
     - **Build command:**  
       `npm install && npm run build -w packages/shared && npx wrangler deploy --outdir=dist`  
       หรือถ้าใช้ root build:  
       `npm install && npm run build -w packages/shared && npm run build -w apps/api`
     - **Root directory:** (ว่าง = root ของ repo)
     - **Build output directory:** `apps/api/dist`  
       (ถ้าใช้ `wrangler deploy` ใน build command แล้ว Wrangler จะ build ไปที่ของมัน — ดูหมายเหตุด้านล่าง)
5. **หมายเหตุ Build จริง:**  
   โปรเจกต์ใช้ Wrangler 3 และ monorepo ดังนั้นทางที่นิยมคือ:
   - **Option A (แนะนำ):** ใช้ **Direct Upload** จากเครื่องคุณ แทน Git:
     - ในเครื่อง: `cd C:\Users\ADMIN_JUN88\Desktop\armai`
     - `npm install`
     - แก้ `wrangler.toml` ให้ `bucket_name` เป็นชื่อ R2 จริง (แทน `TODO_...`)
     - ตั้ง secrets (ดู 1.4) แล้วรัน `npm run deploy -w apps/api` (หรือ `cd apps/api && npx wrangler deploy`)
   - **Option B:** ถ้าใช้ Git ให้ build command เป็น:
     - `npm install && npm run build -w packages/shared && cd apps/api && npx wrangler deploy`
     - แล้วใน Dashboard ตั้ง Worker ให้ใช้ "Wrangler" build (ถ้ามีตัวเลือก)

### 1.3 ผูก R2 กับ Worker

1. เข้า **Workers & Pages** → เลือก Worker ของ ArmAI (เช่น `armai-api`)
2. ไป **Settings** → **Variables and Secrets**
3. ใต้ **R2 bindings** → **Add binding**
   - **Variable name:** `SLIP_BUCKET`
   - **R2 bucket:** เลือก bucket ที่สร้างใน 1.1
4. Save

### 1.4 ตั้งค่า Environment Variables และ Secrets

ใน **Settings** → **Variables and Secrets** ของ Worker เดิม:

**Variables (ไม่ลับ):**
- `ENVIRONMENT` = `production`

**Secrets (กด "Encrypt" / Add secret):**
- `SUPABASE_URL` = URL โปรเจกต์ Supabase
- `SUPABASE_ANON_KEY` = anon key จาก Supabase
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key จาก Supabase
- `GEMINI_API_KEY` = API key จาก Google AI (Gemini)
- `FACEBOOK_APP_SECRET` = App Secret จาก Meta (ใช้ตรวจ webhook)
- `FACEBOOK_VERIFY_TOKEN` = (ถ้าต้องการ) ค่า verify token สำหรับ Facebook webhook

### 1.5 โดเมน / Route (ถ้ามีโดเมน)

1. **Settings** → **Domains & Routes**
2. เพิ่ม custom domain เช่น `api.armai.com` หรือใช้ subdomain ที่ Cloudflare ให้มา เช่น `armai-api.<your-subdomain>.workers.dev`
3. **จด URL นี้ไว้** — ใช้เป็น `VITE_API_URL` ใน Pages

### 1.6 ทดสอบว่า API ขึ้น

- เปิด `https://<worker-url>/api/health`  
  ควรได้ JSON ประมาณ: `{ "ok": true, "service": "armai-api", "environment": "production" }`

---

## ส่วนที่ 2: Cloudflare Pages (เว็บ Dashboard)

Pages ใช้โชว์หน้า Login และ Dashboard (Vite + React)

### 2.1 สร้างโปรเจกต์ Pages

1. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. เลือก repo ArmAI และ branch (เช่น `main`)

### 2.2 ตั้งค่า Build

- **Framework preset:** Vite (หรือ None ก็ได้)
- **Build command:**  
  `npm install && npm run build -w packages/shared && npm run build -w apps/web`
- **Build output directory:** `apps/web/dist`
- **Root directory:** ว่าง (root ของ repo)

กด **Save and Deploy** เพื่อ build ครั้งแรก

### 2.3 ตั้งค่า Environment Variables (หน้าเว็บ)

ในโปรเจกต์ Pages → **Settings** → **Environment variables**:

- `VITE_SUPABASE_URL` = URL โปรเจกต์ Supabase (เหมือนที่ใช้ใน Worker)
- `VITE_SUPABASE_ANON_KEY` = anon key จาก Supabase
- `VITE_API_URL` = URL ของ Worker จาก 1.5 เช่น `https://api.armai.com` หรือ `https://armai-api.<xxx>.workers.dev`

จากนั้น **Redeploy** เพื่อให้ตัวแปรมีผล

### 2.4 โดเมน (ถ้าต้องการ)

- **Custom domains:** ใส่โดเมนเช่น `app.armai.com` หรือ `armai.com`
- หรือใช้ subdomain ที่ Cloudflare ให้ เช่น `armai.pages.dev`

### 2.5 ทดสอบ

- เปิด URL ของ Pages → ควรเห็นหน้า Login
- ลอง login ด้วย user ที่ตั้งเป็น super_admin ใน Supabase

---

## สรุป: รันจากเครื่องคุณ (ไม่ใช้ Git)

ถ้าอยาก deploy จากเครื่องโดยไม่พึ่ง Git:

### Workers (API)

```bash
cd C:\Users\ADMIN_JUN88\Desktop\armai
npm install
```

1. แก้ `apps/api/wrangler.toml`: เปลี่ยน `bucket_name` เป็นชื่อ R2 จริง
2. ตั้ง secrets (ครั้งเดียว):

```bash
cd apps/api
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put FACEBOOK_APP_SECRET
```

3. Deploy:

```bash
npm run deploy -w apps/api
# หรือ
cd apps/api && npx wrangler deploy
```

### Pages (Web)

**วิธีที่ 1: อัปโหลดโฟลเดอร์ build**

```bash
cd C:\Users\ADMIN_JUN88\Desktop\armai
npm run build -w packages/shared
npm run build -w apps/web
```

จากนั้นใน Dashboard → **Pages** → **Create** → **Upload assets** → เลือกโฟลเดอร์ `apps/web/dist`

**วิธีที่ 2: ผูก Git (แนะนำ)**

- ใช้ขั้นตอนในส่วนที่ 2 ด้านบน แล้วทุกครั้งที่ push จะ build และ deploy อัตโนมัติ

---

## Checklist สั้น ๆ

- [ ] สร้าง R2 bucket และผูกกับ Worker
- [ ] ตั้ง secrets ของ Worker (Supabase, Gemini, Facebook)
- [ ] Deploy Worker แล้วทดสอบ `/api/health`
- [ ] สร้าง Pages ผูก Git หรืออัปโหลด `apps/web/dist`
- [ ] ตั้ง env ของ Pages (VITE_SUPABASE_*, VITE_API_URL)
- [ ] ทดสอบเปิดหน้า Login และล็อกอินได้

ถ้าต้องการรายละเอียด env และ SQL ให้ดู `docs/manual-setup-checklist.md` และ `docs/deployment.md` ด้วย
