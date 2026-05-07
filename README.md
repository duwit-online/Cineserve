# 🎬 Cinode

A modern, high-performance media streaming server with a youthful "Netflix-style" interface. Cinode turns your local media directory into a fully-featured streaming platform with advanced metadata, progress tracking, and cross-device responsiveness.

## ✨ Key Features

- **Modern UI**: Bento-grid and horizontal shelf layouts designed for Phones, Tablets, Desktops, and Smart TVs.
- **Advanced Metadata**: Automatic scraping of plots, cast, ratings, and backdrops for your media.
- **Playback Progress**: Resume watching right where you left off on any device.
- **Smart Filters**: Filter by genre, year, and rating with instant results.
- **Multi-user Ready**: Secure authentication (JWT) and personalized watchlists/history.
- **Responsive Player**: Custom playback speeds and subtitle support.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL Database (Recommended for production)

### Installation

1. **Clone the repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
4. **Run in Development**:
   ```bash
   npm run dev
   ```

## 📂 Media Structure

Place your media in the following directory structure:
- `/media/movies/file.mp4`
- `/media/tv/ShowName/Episode01.mp4`

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Motion (Framer Motion).
- **Backend**: Node.js, Express, MySQL.
- **Auth**: JSON Web Tokens (JWT) + Bcrypt.
- **Scraping**: Simulated enhanced metadata engine (DB backed).

---

*Note: For GitHub deployments, ensure your `.env` variables are added to your environment secrets.*
