# 🎬 Cinode

A modern, high-performance media streaming server with a youthful "Netflix-style" interface. Cinode turns your VPS media directory into a fully-featured streaming platform with advanced metadata, progress tracking, and cross-device responsiveness.

## ✨ Key Features

- **Modern UI**: Bento-grid and horizontal shelf layouts designed for Phones, Tablets, Desktops, and Smart TVs.
- **TMDB Integration**: Real-time fetching of high-res posters, backdrops, and cast info using The Movie Database API.
- **Worldwide Access**: Optimized for VPS deployment to stream your media to any device globally.
- **Smart Scanning**: Recursive scanning for movies and TV shows, supporting nested folders and seasonal structures.
- **Multi-user Ready**: Secure authentication (JWT) with "Signin" and "Signup" simplified flows.
- **Responsive Player**: Native HLS-like streaming with progress persistence across sessions.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MySQL Database
- TMDB API Key (for metadata)

### 1. Installation

Clone the repository and install dependencies:
```bash
# Clone the repository
git clone https://github.com/your-username/cinode.git
cd cinode

# Install required packages
npm install
```

### 2. Configuration

Set up your environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Open .env and fill in your DB credentials and TMDB API key
nano .env
```

### 3. VPS Firewall Setup

Allow traffic on port 3000 to make Cinode reachable worldwide:
```bash
sudo ufw allow 3000
```

### 4. Running the App

**Development Mode:**
```bash
npm run dev
```

**Production Mode (Recommended for VPS):**
```bash
# Build the frontend assets
npm run build

# Start the production server
npm start
```

## 📂 Media Structure

By default, Cinode looks for media in root-level directories on your Ubuntu server. You can change these in your `.env` file.

**Default Path Configurations:**
- **Movies Directory**: `/DATA/Media/Movies` 
- **TV Shows Directory**: `/DATA/Media/TV`

*Note: These are absolute paths from the root of your server (`/`). If your media is inside a specific user folder, use the full path like `/home/ubuntu/media/movies`.*

### Recommended Layout:
```text
/DATA/Media/Movies/
  ├── Inception (2010).mp4
  └── The Matrix/
      └── matrix.mkv
/DATA/Media/TV/
  └── Breaking Bad/
      ├── Season 1/
      │   ├── S01E01.mp4
      │   └── S01E02.mp4
      └── Season 2/
          └── episode1.mp4
```

## 🚀 Deployment & Worldwide Access

To make your server reachable from any device:

1. **Firewall Settings**: You must allow traffic on port 3000.
   ```bash
   sudo ufw allow 3000
   ```
2. **Public IP**: Find your VPS Public IP. When the server starts, it will display its Network IP. Use that or your Public IP in your browser: `http://your-vps-ip:3000`.
3. **Environment**: Ensure your `.env` file matches your server's credentials (database, TMDB key, etc.).

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Motion.
- **Backend**: Node.js, Express, MySQL.
- **Auth**: JWT + Bcrypt (Sign in / Sign up flow).
- **Metadata**: TMDB API v3.

---

*Note: This project is designed for private home-server use. Ensure you follow your local laws regarding media ownership and streaming.*
