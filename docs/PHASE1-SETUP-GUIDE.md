# Phase 1: things only you can do (click-by-click)

Claude did NOT create any cloud resources. Do these yourself.

## 0. Install Docker Desktop (needed for local Supabase)
1. Download Docker Desktop for Windows from docker.com, install, restart, open it once.
2. In a terminal in this folder run `npx supabase start`. First run downloads images (slow).
3. Check: `npx supabase status` shows a local database URL.

## 1. GitHub
1. github.com > New repository > name `shillcraft-smart-inventory-POS`, **Private**, no README.
2. In this folder: `git remote add origin <the URL GitHub shows>` then `git push -u origin main`.
3. Open a pull request from `phase-1/scaffold`; check the CI run goes green.

## 2. Supabase (two projects)
1. supabase.com > New project. Name `shillcraft-staging`, region **Southeast Asia (Singapore)**, save the database password in a password manager.
2. Repeat for `shillcraft-production`.
3. In each: Project Settings > Data API > turn **off**.
4. Do not paste keys into chat or commit them. Keys go in `.env.local` (copy `.env.example`), Vercel and GitHub secrets.

## 3. Vercel
1. vercel.com > Add New > Project > import the GitHub repo.
2. Settings > Functions > Function Region = **Singapore (sin1)** (`vercel.json` also pins it).
3. Check a pull request gets a preview link.

## 4. Takowaki data (human task)
Collect menu, stock items and recipes into the CSV templates (templates arrive in Phase 7; start a spreadsheet of products, prices, ingredients and amounts per serving now).
