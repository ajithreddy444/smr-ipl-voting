# 🏏 IPL 2026 Voting App v2.0

PIN-based login · Real-time vote trends · Admin full control · Free to run

---

## Quick Summary of Changes from v1
- ✅ **PIN login** instead of OTP (zero SMS cost)
- ✅ Admin can **view PINs** of all users
- ✅ Admin can **reset any user's PIN** (auto or custom)
- ✅ Admin can add users **bulk or one-by-one**
- ✅ **Live vote trend bars** shown immediately after voting
- ✅ **Voting Enable/Disable** toggle on every match card in admin
- ✅ Match results: Win / No Result (rain) / Void

---

## PHASE 1: Test on Render (Free)

### Step 1: Push to GitHub
```bash
cd voting-app
git init && git add . && git commit -m "IPL 2026 voting app v2"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/ipl-voting.git
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to **https://render.com** → Sign up (free, no card needed)
2. Click **New +** → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Add Environment Variables:
   - `ADMIN_KEY` = `your-secret-admin-password` (choose something strong)
   - `NODE_ENV` = `production`
6. Click **Create Web Service**
7. Wait ~2 minutes → you'll get a URL like `https://ipl-voting-xxx.onrender.com`

### Step 3: Stop Render from sleeping (IMPORTANT)
Render free tier sleeps after 15 mins of inactivity. Fix:
1. Sign up at **https://uptimerobot.com** (free)
2. Add Monitor → HTTP(S) → URL: `https://your-app.onrender.com/health`
3. Interval: **5 minutes**
4. Done! App stays awake 24/7 for free.

---

## PHASE 2: Move to AWS EC2 (Free Tier, Full Control)

AWS Free Tier gives you **1 year** of `t2.micro` / `t3.micro` (1 CPU, 1GB RAM) — perfect for this app.

### Step 1: Launch EC2 Instance
1. Go to **https://aws.amazon.com** → Sign in → EC2 → Launch Instance
2. Choose: **Amazon Linux 2023** (free tier eligible)
3. Instance type: **t2.micro** (free tier)
4. Key pair: Create new → download the `.pem` file (keep it safe!)
5. Security Group — add these inbound rules:
   - SSH: port 22, My IP
   - HTTP: port 80, Anywhere (0.0.0.0/0)
   - HTTPS: port 443, Anywhere (optional but recommended)
   - Custom TCP: port 3000, Anywhere (for direct access)
6. Storage: 8GB gp2 (free tier default) — fine for SQLite
7. Launch!

### Step 2: Connect to EC2
```bash
# On your local machine:
chmod 400 your-key.pem
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

### Step 3: Install Node.js on EC2
```bash
# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git

# Verify
node --version   # should show v20.x
npm --version
```

### Step 4: Deploy the App
```bash
# Clone your repo (or upload files via scp)
git clone https://github.com/YOUR_USERNAME/ipl-voting.git
cd ipl-voting

# Install dependencies
npm install

# Test it works
ADMIN_KEY=yourpassword node server.js
# Visit http://YOUR_EC2_IP:3000 to test
# Ctrl+C to stop
```

### Step 5: Run with PM2 (keeps app alive forever)
```bash
# Install PM2
sudo npm install -g pm2

# Start app with PM2
ADMIN_KEY=yourpassword pm2 start server.js --name "ipl-voting"

# Make it restart on server reboot
pm2 startup
# (copy-paste the command it gives you)
pm2 save

# Useful PM2 commands:
pm2 status        # see if app is running
pm2 logs          # see live logs
pm2 restart ipl-voting
pm2 stop ipl-voting
```

### Step 6: Set up Nginx (serve on port 80 — cleaner URL)
```bash
sudo yum install -y nginx

# Create config
sudo nano /etc/nginx/conf.d/ipl-voting.conf
```
Paste this:
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo systemctl start nginx
sudo systemctl enable nginx
# Test: http://YOUR_EC2_IP (no port needed)
```

### Step 7: Environment Variables (production)
```bash
# Create .env file
cat > /home/ec2-user/ipl-voting/.env << EOF
ADMIN_KEY=your-strong-password-here
NODE_ENV=production
PORT=3000
DB_PATH=/home/ec2-user/ipl-voting/voting.db
EOF

# Update PM2 to use it
pm2 stop ipl-voting
pm2 start server.js --name "ipl-voting" --env production -- --env-file .env
# Or simpler, just pass directly:
ADMIN_KEY=yourpassword pm2 restart ipl-voting --update-env
```

### Step 8: Point a domain (optional but recommended)
1. Buy a cheap domain (~₹800/yr) or use a free subdomain from No-IP
2. In your domain DNS, add: `A record → @ → YOUR_EC2_IP`
3. Update nginx `server_name` to your domain
4. For HTTPS (free SSL with Let's Encrypt):
```bash
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Backup your database (SQLite file)
```bash
# From your local machine, copy the DB:
scp -i your-key.pem ec2-user@YOUR_EC2_IP:/home/ec2-user/ipl-voting/voting.db ./backup-$(date +%Y%m%d).db

# Or set up auto-backup (runs daily at 2am):
crontab -e
# Add: 0 2 * * * cp /home/ec2-user/ipl-voting/voting.db /home/ec2-user/backups/voting-$(date +\%Y\%m\%d).db
```

---

## Admin Workflow (Daily Use)

1. **Add friends** → Admin → Add Users → paste `Name, Mobile` or `Name, Mobile, PIN`
2. **Share URL + their PIN** on WhatsApp (each person gets a unique PIN)
3. **Before toss** (~5 mins) → Admin → Matches → find the match → 🟢 Enable Voting
4. **After toss** → 🔴 Disable Voting (so no late votes)
5. **After match ends** → Select result (Win / No Result / Void) → SET RESULT
6. **Leaderboard** auto-updates, everyone sees rankings

---

## Result Types
| Result | Points | When to use |
|--------|--------|-------------|
| `TEAM` wins | +1 to correct voters | Normal match finish |
| `no_result` | 0 points | Rain, D/L, no result officially |
| `void` | 0 points | Match abandoned, cancelled |

---

## API Reference

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/auth/login` | — | Login with mobile + PIN |
| `POST /api/auth/logout` | User | Logout |
| `POST /api/auth/change-pin` | User | Change own PIN |
| `GET /api/matches` | User | All matches + my vote + trends |
| `POST /api/vote` | User | Cast vote |
| `GET /api/my-votes` | User | My vote history |
| `GET /api/leaderboard` | Public | Leaderboard |
| `POST /api/admin/users` | Admin | Bulk add/update users |
| `GET /api/admin/users` | Admin | List users with PINs |
| `PATCH /api/admin/users/:mobile/reset-pin` | Admin | Reset PIN |
| `DELETE /api/admin/users/:mobile` | Admin | Remove user |
| `GET /api/admin/matches` | Admin | All matches with vote stats |
| `PATCH /api/admin/matches/:mn/voting` | Admin | Enable/disable voting |
| `PATCH /api/admin/matches/:mn/result` | Admin | Set match result |
| `GET /api/admin/export/votes` | Admin | Download votes CSV |
| `GET /api/admin/export/leaderboard` | Admin | Download leaderboard CSV |
| `GET /api/admin/export/users` | Admin | Download users + PINs CSV |
| `GET /api/admin/export/full` | Admin | Full JSON backup |
| `GET /health` | — | Health check (for UptimeRobot) |

---

## Cost Summary
| Platform | Cost | Duration |
|----------|------|---------|
| Render Free | ₹0 | Unlimited (with UptimeRobot ping) |
| AWS EC2 t2.micro | ₹0 | 12 months free tier, then ~₹600/month |
| AWS EC2 t3.micro (spot) | ~₹150/month | After free tier |
| Domain (optional) | ~₹800/year | Optional |

**Recommendation**: Start on Render (zero setup risk), move to AWS EC2 after IPL for full control.
