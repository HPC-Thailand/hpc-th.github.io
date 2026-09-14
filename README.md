# HPC Thailand — hpc.in.th

ประวัติศาสตร์และภูมิทัศน์ของคอมพิวเตอร์สมรรถนะสูงในประเทศไทย
_The history and landscape of high performance computing in Thailand._

เว็บไซต์แบบ static ล้วน ไม่มี build step — แก้ JSON แล้ว merge ได้เลย
รองรับสองภาษา (ไทย / อังกฤษ) ด้วยฟอนต์ **Prompt** และ deploy บน GitHub Pages

## หน้าเว็บ / Pages

| Path | เนื้อหา |
| --- | --- |
| `/` | ไทม์ไลน์ประวัติศาสตร์ HPC ในประเทศไทย (พ.ศ. 2506 – ปัจจุบัน) + สไลด์ต้นฉบับ |
| `/systems/` | ไดเรกทอรีระบบ HPC ที่เปิดให้บริการ + แผนที่ |
| `/stats/` | สถิติรวม CPU cores / GPU / การกระจายตัว |
| `/events/` | กิจกรรมและงานประชุม |
| `/submit/` | ฟอร์มส่งข้อมูล และคู่มือส่ง Pull Request |

## โครงสร้าง / Layout

```
.
├── index.html            ไทม์ไลน์ (หน้าแรก)
├── systems/ stats/ events/ submit/
├── assets/
│   ├── css/site.css      design tokens + ทุกคอมโพเนนต์
│   ├── js/core.js        i18n, ธีม, header/footer, data loader
│   ├── js/*.js           ตัวควบคุมรายหน้า
│   └── img/slides/       สไลด์ต้นฉบับที่ย่อขนาดแล้ว (p1–p10)
├── data/
│   ├── timeline.json     เหตุการณ์ในไทม์ไลน์ (สองภาษา)
│   ├── systems.json      ระบบ HPC
│   ├── events.json       กิจกรรม
│   ├── ui.json           ข้อความ UI ทั้งหมด (สองภาษา)
│   └── schema/           JSON Schema สำหรับ editor autocomplete
├── historical/page png/  สไลด์ต้นฉบับความละเอียดเต็ม (4K)
├── tools/validate-data.mjs
└── docs/                 คู่มือ deploy และการเพิ่ม subdomain
```

## ข้อมูลทุกอย่างอยู่ใน `data/`

หน้าเว็บอ่านข้อมูลจาก JSON โดยตรง — ไม่มี generator, ไม่มี framework
เพิ่มระบบใหม่ = เพิ่ม object ใน `data/systems.json` แล้วเปิด PR

ทุกข้อความที่ผู้ใช้เห็นเป็น object สองภาษา:

```json
{ "th": "ข้อความภาษาไทย", "en": "English text" }
```

ตรวจความถูกต้องก่อน push:

```bash
node tools/validate-data.mjs
```

GitHub Actions รันคำสั่งนี้อัตโนมัติกับทุก PR ที่แตะ `data/`

## รันบนเครื่อง / Local preview

ต้องเสิร์ฟผ่าน HTTP (ES modules + `fetch` ใช้ `file://` ไม่ได้):

```bash
python3 -m http.server 8000
```

แล้วเปิด <http://localhost:8000>

## Deploy

GitHub Pages เสิร์ฟจาก branch `main` root โดยตรง ไม่ต้องมี workflow build
รายละเอียดการตั้งค่า DNS และแผน subdomain (`event.` / `stat.` / `submit.`)
อยู่ที่ [docs/DEPLOY.md](docs/DEPLOY.md)

## ที่มาของข้อมูลไทม์ไลน์

เนื้อหาไทม์ไลน์เรียบเรียงจากสไลด์ "ประวัติศาสตร์ HPC ในประเทศไทย" 10 หน้า
ซึ่งเก็บไว้ที่ `historical/page png/` และแสดงเป็นแกลเลอรีท้ายหน้าแรก

ปี พ.ศ. ในสไลด์ต้นฉบับมีคลาดเคลื่อนบางจุด (เช่น 1995 → พ.ศ. 2537, 1997 → พ.ศ. 2506)
เว็บไซต์จึงคำนวณ **พ.ศ. = ค.ศ. + 543** เสมอ แทนการคัดลอกค่าจากสไลด์

## ร่วมพัฒนา / Contributing

ดู [CONTRIBUTING.md](CONTRIBUTING.md) — หรือใช้ฟอร์มที่ <https://hpc.in.th/submit/>

## License

เนื้อหา (ไฟล์ใน `data/` และข้อความบนเว็บไซต์) เผยแพร่ภายใต้ **CC BY 4.0**
สไลด์ต้นฉบับใน `historical/` เป็นลิขสิทธิ์ของผู้จัดทำสไลด์
