# Supply Chain & Material Shortage Analyzer

An enterprise-grade Work Order Material Gap & Supply Delay Analysis Application built with React, TypeScript, Tailwind CSS, and Google Gemini AI.

---

## 🚀 GitHub Pages Deployment Guide

If you are deploying this application to **GitHub Pages**, follow these simple steps to ensure the site builds and displays properly:

### Step 1: Enable GitHub Actions for GitHub Pages
1. On your GitHub repository, click on **Settings** (top navigation bar).
2. In the left sidebar, click on **Pages** (under the "Code and automation" section).
3. Under **Build and deployment** > **Source**, change the dropdown from `"Deploy from a branch"` to **`GitHub Actions`**.
4. That's it! Pushing to your `main` (or `master`) branch will automatically trigger `.github/workflows/deploy.yml`, which compiles the Vite TypeScript application and publishes the live site.

> **Why was the page blank before?**  
> 1. If GitHub Pages is set to *"Deploy from a branch (main / root)"*, GitHub attempts to serve raw uncompiled TypeScript files (`/src/main.tsx`), which web browsers cannot execute directly without building.  
> 2. Switching the source to **`GitHub Actions`** tells GitHub to run the automated build workflow that bundles the application into optimized static assets.

---

## 🛠️ Local Development & Running

### Prerequisites
- Node.js 20 or higher
- npm

### Installation
```bash
npm install
```

### Run Locally (with local Express & Vite dev server)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production
```bash
npm run build
```
This command bundles the client-side SPA into `dist/` and builds the optional Node.js server.

---

## ✨ Features

- **Work Order Shortage Intelligence**: Automatically groups BOM line items by Work Order, Assembly, or Part Number.
- **Dynamic Risk Classification**:
  - 🚨 **CRITICAL**: Component supply date is later than target assembly production start date.
  - 📋 **NO SUPPLY DATE**: Missing or unconfirmed purchase order date (urgent action required).
  - 💡 **PARTIAL BUILD**: Work Orders where substantial BOM items are in stock, calculating exact buildable units, recommended order reduction, and balance split orders.
  - 🟡 **MODERATE**: Supply arrival matches production start date closely.
  - 🟢 **ON TRACK / COMPLETED**: 100% committed inventory.
- **Copy for Excel & 1-Click Clipboard**: Instant tab-separated format exports ready to paste (`Ctrl+V`) into Microsoft Excel or Google Sheets.
- **AI Copilot & Email Generator**: Integrated material shortage assistant powered by Google Gemini with client-side fallback.
- **Client-Side CSV Import & Sample Data**: Instant drag-and-drop CSV analysis with zero cloud upload required.
