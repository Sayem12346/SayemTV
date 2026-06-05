# ⬡ StreamVault — IPTV Player

Premium IPTV player. GitHub-এ upload করো, Vercel দিয়ে deploy করো।

---

## 📁 Folder Structure

```
streamvault/
├── index.html       ← মেইন পেজ
├── style.css        ← সব ডিজাইন
├── script.js        ← সব লজিক
├── channels.m3u8    ← তোমার চ্যানেল লিস্ট ← এটাই শুধু আপডেট করবে
├── vercel.json      ← Vercel config (ছুঁবে না)
└── README.md
```

---

## 🚀 Deploy করার Steps

### Step 1 — GitHub Repository বানাও

1. [github.com](https://github.com) → **New repository**
2. Repository name দাও (যেমন: `streamvault`)
3. **Public** রাখো
4. **Create repository** ক্লিক করো

### Step 2 — Files Upload করো

```
Repository পেজে → "uploading an existing file" ক্লিক করো
↓
সব ফাইল drag & drop করো (index.html, style.css, script.js, channels.m3u8, vercel.json)
↓
"Commit changes" ক্লিক করো
```

### Step 3 — Vercel Deploy করো

1. [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. **Add New Project** → তোমার repo সিলেক্ট করো
3. Settings কিছু বদলাতে হবে না — সব default রাখো
4. **Deploy** ক্লিক করো
5. ✅ Done! তোমাকে একটা URL দেবে যেমন: `https://streamvault.vercel.app`

---

## 📺 চ্যানেল আপডেট করবে কীভাবে

`channels.m3u8` ফাইলটা GitHub-এ edit করো:

```
GitHub repo → channels.m3u8 → ✏ Edit → Save
```

Vercel অটো re-deploy করবে। ব্যস!

---

## 📝 M3U Format

```m3u
#EXTM3U
#EXTINF:-1 tvg-name="Channel Name" tvg-logo="https://logo-url.png" group-title="Sports",Channel Name
https://your-stream-url.m3u8
```

---

## ✨ Features

- 📺 HLS.js দিয়ে m3u8 স্ট্রিম প্লে
- 🔍 রিয়েলটাইম সার্চ (Ctrl+K)
- ★ Favourites (LocalStorage)
- 🌍 Country/Category filter
- ⧉ Picture-in-Picture
- ⛶ Fullscreen
- 📱 Mobile responsive
- 🌙 Dark / Light mode
