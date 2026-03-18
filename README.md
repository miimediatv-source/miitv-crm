# MiiTV CRM

A full-featured Customer Relationship Management system built for MiiTV — an IPTV subscription service. Manage subscribers, track renewals, send emails, handle referrals and view financial analytics all in one place.

🌐 **Live:** [miitv-crm.vercel.app](https://miitv-crm.vercel.app)  
📱 **Available as Android APK** via Capacitor

---

## Screenshots

### 👥 Subscribers
View, search, filter and sort all subscribers. Click any row to open the detail panel with email, expiry, referral links and quick actions.

![Subscribers](docs/screenshots/subscribers.png)

### 📊 Analytics
Status breakdown, device connection stats, top email providers, expiry-by-month chart and urgent expiry alerts.

![Analytics](docs/screenshots/analytics.png)

### 🎁 Referrals
Track who referred who, manage reward milestones (1 referral = 1 month free, 6 referrals = 12 months free) and view a top referrers leaderboard.

![Referrals](docs/screenshots/referrals.png)

### ✉️ Emails
Send individual or bulk emails via EmailJS with open tracking, email templates, and a full sent history log.

---

## Features

- **👥 Subscriber Management** — Full list with search, filter by status/connections, sortable columns, paginated
- **📊 Analytics** — Live charts, expiry breakdown, domain stats, 14-day alert list
- **💰 Financials** — Log revenue and costs, track net profit, monthly summaries
- **✉️ Email** — Individual, bulk group, and pick-users send modes via EmailJS. Open tracking pixel, email history log, read receipts
- **🎁 Referrals** — Log referrals, track milestone rewards, leaderboard, link referred customers to referrer profiles
- **⚙️ Settings** — Company profile with logo upload, email templates (full CRUD), Google Sheet sync, team invites, change password
- **🔒 Auth** — Supabase auth with magic link, password login, forgot password, and password reset
- **📱 Android APK** — Packaged with Capacitor, signed release build

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 + React |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Email | EmailJS |
| Deployment | Vercel |
| Mobile | Capacitor (Android) |
| Styling | Inline CSS + CSS classes |

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/miitv-crm.git
cd miitv-crm
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your credentials in `.env.local` — see `.env.local.example` for all required variables.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |
| `NEXT_PUBLIC_GOOGLE_SHEET_ID` | Google Sheet ID for subscriber sync |
| `NEXT_PUBLIC_EMAILJS_SERVICE_ID` | EmailJS service ID |
| `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID` | EmailJS template ID |
| `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY` | EmailJS public key |
| `NEXT_PUBLIC_APP_URL` | Your deployed app URL (e.g. https://miitv-crm.vercel.app) |

---

## Deployment

### Web (Vercel)

```bash
npx vercel --prod
```

Set all environment variables in Vercel dashboard under **Settings → Environment Variables**.

### Android APK

```bash
# 1. Build static export
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Build signed release APK
cd android
.\gradlew assembleRelease \
  "-Pandroid.injected.signing.store.file=path/to/keystore" \
  "-Pandroid.injected.signing.store.password=YOUR_PASS" \
  "-Pandroid.injected.signing.key.alias=YOUR_ALIAS" \
  "-Pandroid.injected.signing.key.password=YOUR_PASS"
```

---

## Database Schema

The app uses Supabase with the following tables:

- `subscribers` — subscriber records synced from Google Sheets
- `revenue` — revenue entries
- `costs` — cost entries  
- `activity` — notes and email activity log per subscriber
- `email_tracking` — open tracking for sent emails
- `referrals` — referral relationships between subscribers

---

## License

Private — MiiTV internal use only.
