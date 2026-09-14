# Deploy & DNS

## 1. GitHub Pages (ไซต์หลัก hpc.in.th)

ไม่มี build step — Pages เสิร์ฟไฟล์จาก repo ตรงๆ

**Settings → Pages**

| ตัวเลือก | ค่า |
| --- | --- |
| Source | Deploy from a branch |
| Branch | `main` / `(root)` |
| Custom domain | `hpc.in.th` |
| Enforce HTTPS | ✅ |

ไฟล์ที่เกี่ยวข้องซึ่งมีอยู่แล้วใน repo:

- `CNAME` — มีคำว่า `hpc.in.th`
- `.nojekyll` — ปิด Jekyll ไม่ให้ไปยุ่งกับโฟลเดอร์ที่ขึ้นต้นด้วย `_`
- `404.html` — หน้า not found ของ Pages

> ⚠️ **อย่าลบ `CNAME`** — ทุกครั้งที่ commit ทับ root ต้องมีไฟล์นี้เสมอ
> ไม่งั้น GitHub จะรีเซ็ต custom domain ทิ้ง

## 2. DNS ที่ผู้ให้บริการโดเมน

### Apex domain `hpc.in.th`

```
A     hpc.in.th   185.199.108.153
A     hpc.in.th   185.199.109.153
A     hpc.in.th   185.199.110.153
A     hpc.in.th   185.199.111.153
```

(หรือ `AAAA` สำหรับ IPv6: `2606:50c0:8000::153`, `...8001::153`, `...8002::153`, `...8003::153`)

ตรวจว่า DNS ตรงแล้ว:

```bash
dig +short hpc.in.th
```

---

## 3. Subdomain: `event.` / `stat.` / `submit.`

### ข้อจำกัดที่ต้องรู้ก่อน

**GitHub Pages ผูก custom domain ได้ 1 โดเมนต่อ 1 repo** — repo นี้ถูกจองด้วย
`hpc.in.th` ไปแล้ว จึงเสิร์ฟ `event.hpc.in.th` จาก repo เดียวกัน **ไม่ได้**

เว็บไซต์นี้จึงออกแบบให้แต่ละส่วนอยู่ในโฟลเดอร์ของตัวเอง และแยกออกไปเป็น repo ใหม่
ได้ทันทีเมื่อพร้อม โดยไม่ต้องแก้โค้ด

### ตอนนี้ (path-based) — ใช้งานได้เลย

| URL | โฟลเดอร์ |
| --- | --- |
| `hpc.in.th/events/` | `events/` |
| `hpc.in.th/stats/` | `stats/` |
| `hpc.in.th/submit/` | `submit/` |

### อนาคต (subdomain) — ทางเลือก A: แยก repo (แนะนำ)

ทำทีละ subdomain ตามความพร้อม:

1. สร้าง repo ใหม่ เช่น `HPC-Thailand/event` แล้วคัดลอกโฟลเดอร์ `events/` ไปเป็น root
   พร้อมกับ `assets/` และ `data/` เท่าที่ต้องใช้
2. เพิ่ม `CNAME` ที่มีคำว่า `event.hpc.in.th`
3. ตั้ง DNS:
   ```
   CNAME   event.hpc.in.th   hpc-thailand.github.io.
   CNAME   stat.hpc.in.th    hpc-thailand.github.io.
   CNAME   submit.hpc.in.th  hpc-thailand.github.io.
   ```
4. Settings → Pages → Custom domain → `event.hpc.in.th`
5. ใน repo นี้ เปลี่ยนลิงก์ใน `assets/js/core.js` → `NAV` ให้ชี้ไป URL เต็ม:
   ```js
   { key: 'events', href: 'https://event.hpc.in.th/' },
   ```
   (`navMarkup()` ใช้ `new URL(href, ROOT)` อยู่แล้ว — URL เต็มจึงใช้ได้ทันที)

**ข้อมูลใช้ร่วมกันอย่างไร:** ให้ subdomain fetch JSON จาก `https://hpc.in.th/data/…`
โดยตรง (GitHub Pages ส่ง `Access-Control-Allow-Origin: *` มาให้อยู่แล้ว)
ไซต์หลักจึงยังเป็นแหล่งข้อมูลเดียว — แก้ที่เดียว อัปเดตทุก subdomain

ทำได้โดยตั้งค่าใน `core.js`:

```js
export const DATA_ORIGIN = 'https://hpc.in.th/';
// แล้วให้ loadJSON ใช้ DATA_ORIGIN แทน ROOT
```

### ทางเลือก B: repo เดียว + Cloudflare

ถ้าโดเมนอยู่บน Cloudflare สามารถชี้ทุก subdomain มาที่ Pages เดิม
แล้วใช้ **Cloudflare Worker** rewrite path:

```
event.hpc.in.th/*  →  hpc.in.th/events/*
stat.hpc.in.th/*   →  hpc.in.th/stats/*
submit.hpc.in.th/* →  hpc.in.th/submit/*
```

ข้อดี: repo เดียว deploy เดียว
ข้อเสีย: ต้องพึ่ง Cloudflare และต้องดูแล Worker เพิ่ม

### สรุปคำแนะนำ

เริ่มด้วย path-based (ที่มีอยู่แล้ว) แล้วค่อยแยกเป็น repo เมื่อ:

- มีศูนย์ HPC ส่งข้อมูลเข้ามาสม่ำเสมอจนแต่ละส่วนโตพอจะมีทีมดูแลของตัวเอง
- หรือต้องการให้แต่ละส่วนมีสิทธิ์ write แยกกัน (เช่นให้ศูนย์แต่ละแห่ง push ได้เฉพาะ `stat`)

## 4. หลัง deploy ตรวจอะไรบ้าง

```bash
curl -sI https://hpc.in.th/            | head -1   # 200
curl -sI https://hpc.in.th/systems/    | head -1   # 200
curl -s  https://hpc.in.th/data/timeline.json | head -3
```

- เปิดหน้าแรก สลับ ไทย/EN แล้ว reload — ภาษาต้องคงอยู่ (localStorage)
- สลับธีมสว่าง/มืด แล้ว reload — ธีมต้องคงอยู่
- เปิดบนมือถือ ตรวจว่าเมนู hamburger ทำงานและไทม์ไลน์ไม่ล้นจอ
