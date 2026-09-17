# 🎓 Alumni Network Application

A modern, low-maintenance web app and Progressive Web App (PWA) designed to connect alumni, foster peer mentorship, share job referrals, and celebrate reunions.

---

## 🛠 Tech Stack Overview

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with [Lucide React](https://lucide.dev/) icons
- **Database & ORM**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Authentication**: Phone OTP architecture (Dev Mock Provider for instant local dev & automated testing, pluggable with Firebase Auth or MSG91 for production India SMS)
- **Deployment**: Vercel / Railway ready with GitHub Actions CI workflow

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd Alumni
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

By default, development mode uses the mock OTP provider (`OTP_PROVIDER=mock`) with test code `123456`.

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

- **Linting**: `npm run lint`
- **Build Check**: `npm run build`

---

## 🗺 Development Roadmap

- [x] **Phase 0**: Setup & Tech Stack Decision *(Complete)*
- [ ] **Phase 1**: Data Model & Core Auth
- [ ] **Phase 2**: Institution & Directory
- [ ] **Phase 3**: Passive Verification
- [ ] **Phase 4**: Feed (Retention Engine)
- [ ] **Phase 5**: Mentorship
- [ ] **Phase 6**: Jobs Board
- [ ] **Phase 7**: Events & Reunions
- [ ] **Phase 8**: Virality Layer
- [ ] **Phase 9**: Admin & Moderation
- [ ] **Phase 10**: Polish & Launch Readiness
