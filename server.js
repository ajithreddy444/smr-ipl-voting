const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});
const q = (text, params) => pool.query(text, params);

// ─── AWARD CONFIG ─────────────────────────────────────────────────────────────
const AWARDS = [
  { key: 'match_winner',   label: 'Match Winner',           emoji: '🏆', pts: 1.0,  desc: 'Which team wins the match?' },
  { key: 'potm',           label: 'Player of the Match',    emoji: '⭐', pts: 0.25, desc: 'Best overall performer' },
  { key: 'super_striker',  label: 'Super Striker',          emoji: '💥', pts: 0.25, desc: 'Highest strike rate batsman (min 15 balls)' },
  { key: 'super_sixes',    label: 'Six Machine',            emoji: '🚀', pts: 0.25, desc: 'Most sixes in the match' },
  { key: 'fours_king',     label: 'Fours King',             emoji: '🎯', pts: 0.25, desc: 'Most fours in the match' },
];

// ─── IPL 2026 PLAYERS DATA ────────────────────────────────────────────────────
const IPL_PLAYERS = {
  RCB: ['Virat Kohli','Rajat Patidar','Phil Salt','Venkatesh Iyer','Josh Hazlewood','Krunal Pandya','Romario Shepherd','Jacob Bethell','Liam Livingstone','Tim David','Swapnil Singh','Yash Dayal','Suyash Sharma','Mohammed Siraj','Lungi Ngidi'],
  MI:  ['Rohit Sharma','Suryakumar Yadav','Tilak Varma','Hardik Pandya','Jasprit Bumrah','Quinton de Kock','Mitchell Santner','Deepak Chahar','Will Jacks','Naman Dhir','Karn Sharma','Trent Boult','Ryan Rickelton','Bevon Jacobs','Vignesh Puthur'],
  CSK: ['Ruturaj Gaikwad','MS Dhoni','Sanju Samson','Sarfaraz Khan','Jamie Overton','Akeal Hosein','Dewald Brevis','Prashant Veer','Ayush Mhatre','Ravichandran Ashwin','Deepak Hooda','Noor Ahmad','Matheesha Pathirana','Khaleel Ahmed','Kamlesh Nagarkoti'],
  KKR: ['Rinku Singh','Rovman Powell','Finn Allen','Tim Seifert','Cameron Green','Varun Chakravarthy','Harshit Rana','Matheesha Pathirana','Anrich Nortje','Ramandeep Singh','Angkrish Raghuvanshi','Moeen Ali','Spencer Johnson','Mayank Markande','Umesh Yadav'],
  SRH: ['Travis Head','Abhishek Sharma','Heinrich Klaasen','Pat Cummins','Ishan Kishan','Nitish Kumar Reddy','Adam Zampa','Harshal Patel','Jaydev Unadkat','Zeeshan Ansari','Rahul Chahar','Simarjeet Singh','Wiaan Mulder','Kamindu Mendis','Brydon Carse'],
  DC:  ['KL Rahul','Jake Fraser-McGurk','Axar Patel','Kuldeep Yadav','Tristan Stubbs','Faf du Plessis','Ashutosh Sharma','Mohit Sharma','T Natarajan','Karun Nair','Darshan Nalkande','Vipraj Nigam','Dushmantha Chameera','Sameer Rizvi','Tripurana Vijay'],
  RR:  ['Sanju Samson','Yashasvi Jaiswal','Jos Buttler','Shimron Hetmyer','Yuzvendra Chahal','Trent Boult','Sandeep Sharma','Riyan Parag','Dhruv Jurel','Kumar Kartikeya','Shubham Dubey','Wanindu Hasaranga','Maheesh Theekshana','Nitish Rana','Akash Madhwal'],
  GT:  ['Shubman Gill','David Miller','Rashid Khan','Kagiso Rabada','Jos Buttler','Mohammed Shami','Washington Sundar','Wriddhiman Saha','Sai Sudharsan','Shahrukh Khan','Vijay Shankar','Rahul Tewatia','Noor Ahmad','Azmatullah Omarzai','Ishant Sharma'],
  LSG: ['KL Rahul','Nicholas Pooran','Ravi Bishnoi','Avesh Khan','Mohsin Khan','Mark Wood','David Willey','Prerak Mankad','Ayush Badoni','Deepak Hooda','Manimaran Siddharth','Naveen-ul-Haq','Krunal Pandya','Matt Henry','Shamar Joseph'],
  PBKS: ['Shikhar Dhawan','Sam Curran','Liam Livingstone','Jonny Bairstow','Arshdeep Singh','Kagiso Rabada','Harshal Patel','Rahul Chahar','Jitesh Sharma','Prabhsimran Singh','Shashank Singh','Atharva Taide','Chris Woakes','Harpreet Bhatia','Nathan Ellis'],
};

// ─── DB INIT ──────────────────────────────────────────────────────────────────
async function initDB() {
  await q(`
    CREATE TABLE IF NOT EXISTS matches (
      match_number   TEXT PRIMARY KEY,
      team1          TEXT NOT NULL,
      team2          TEXT NOT NULL,
      match_date     TEXT NOT NULL,
      venue          TEXT NOT NULL,
      time_ist       TEXT NOT NULL DEFAULT '7:30 PM',
      voting_enabled BOOLEAN DEFAULT FALSE,
      winner         TEXT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      mobile    TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      pin       TEXT NOT NULL,
      plain_pin TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      mobile     TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS votes (
      id           SERIAL PRIMARY KEY,
      mobile       TEXT NOT NULL,
      match_number TEXT NOT NULL,
      voted_for    TEXT NOT NULL,
      created_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE(mobile, match_number)
    );
    CREATE TABLE IF NOT EXISTS award_picks (
      id           SERIAL PRIMARY KEY,
      mobile       TEXT NOT NULL,
      match_number TEXT NOT NULL,
      award_key    TEXT NOT NULL,
      pick         TEXT NOT NULL,
      created_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE(mobile, match_number, award_key)
    );
    CREATE TABLE IF NOT EXISTS match_results (
      match_number TEXT PRIMARY KEY,
      winner       TEXT,
      potm         TEXT,
      super_striker TEXT,
      super_sixes  TEXT,
      fours_king   TEXT,
      settled_at   TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS leaderboard (
      mobile         TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      points         NUMERIC(8,2) DEFAULT 0,
      correct_votes  INTEGER DEFAULT 0,
      total_votes    INTEGER DEFAULT 0,
      award_pts      NUMERIC(8,2) DEFAULT 0,
      streak_pts     NUMERIC(8,2) DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak    INTEGER DEFAULT 0
    );
  `);
  await seedIPL();
  console.log('✅ DB ready');
}

// ─── IPL 2026 SEED ────────────────────────────────────────────────────────────
async function seedIPL() {
  const { rows } = await q('SELECT COUNT(*) as c FROM matches');
  if (parseInt(rows[0].c) > 0) return;
  const M = [
    ['M01','RCB','SRH','2026-03-28','Chinnaswamy Stadium, Bengaluru','7:30 PM'],
    ['M02','MI','KKR','2026-03-29','Wankhede Stadium, Mumbai','7:30 PM'],
    ['M03','RR','CSK','2026-03-30','Barsapara Stadium, Guwahati','7:30 PM'],
    ['M04','DC','PBKS','2026-03-31','Arun Jaitley Stadium, Delhi','7:30 PM'],
    ['M05','GT','LSG','2026-04-01','Narendra Modi Stadium, Ahmedabad','7:30 PM'],
    ['M06','SRH','MI','2026-04-02','Rajiv Gandhi Stadium, Hyderabad','7:30 PM'],
    ['M07','KKR','RR','2026-04-03','Eden Gardens, Kolkata','7:30 PM'],
    ['M08','CSK','GT','2026-04-04','MA Chidambaram Stadium, Chennai','7:30 PM'],
    ['M09','RCB','DC','2026-04-05','Chinnaswamy Stadium, Bengaluru','3:30 PM'],
    ['M10','PBKS','LSG','2026-04-05','Mullanpur Stadium, Punjab','7:30 PM'],
    ['M11','MI','RR','2026-04-06','Wankhede Stadium, Mumbai','3:30 PM'],
    ['M12','SRH','KKR','2026-04-06','Rajiv Gandhi Stadium, Hyderabad','7:30 PM'],
    ['M13','DC','GT','2026-04-07','Arun Jaitley Stadium, Delhi','7:30 PM'],
    ['M14','CSK','PBKS','2026-04-08','MA Chidambaram Stadium, Chennai','7:30 PM'],
    ['M15','LSG','RCB','2026-04-09','Ekana Stadium, Lucknow','7:30 PM'],
    ['M16','RR','SRH','2026-04-10','Sawai Mansingh Stadium, Jaipur','7:30 PM'],
    ['M17','KKR','CSK','2026-04-11','Eden Gardens, Kolkata','3:30 PM'],
    ['M18','GT','MI','2026-04-11','Narendra Modi Stadium, Ahmedabad','7:30 PM'],
    ['M19','PBKS','DC','2026-04-12','Mullanpur Stadium, Punjab','3:30 PM'],
    ['M20','LSG','RR','2026-04-12','Ekana Stadium, Lucknow','7:30 PM'],
    ['M21','RCB','KKR','2026-04-13','Chinnaswamy Stadium, Bengaluru','7:30 PM'],
    ['M22','MI','CSK','2026-04-14','Wankhede Stadium, Mumbai','7:30 PM'],
    ['M23','SRH','GT','2026-04-15','Rajiv Gandhi Stadium, Hyderabad','7:30 PM'],
    ['M24','DC','LSG','2026-04-16','Arun Jaitley Stadium, Delhi','7:30 PM'],
    ['M25','RR','PBKS','2026-04-17','Sawai Mansingh Stadium, Jaipur','7:30 PM'],
    ['M26','KKR','GT','2026-04-18','Eden Gardens, Kolkata','7:30 PM'],
    ['M27','CSK','SRH','2026-04-19','MA Chidambaram Stadium, Chennai','3:30 PM'],
    ['M28','MI','DC','2026-04-19','Wankhede Stadium, Mumbai','7:30 PM'],
    ['M29','LSG','KKR','2026-04-20','Ekana Stadium, Lucknow','3:30 PM'],
    ['M30','PBKS','RCB','2026-04-20','Mullanpur Stadium, Punjab','7:30 PM'],
    ['M31','GT','RR','2026-04-21','Narendra Modi Stadium, Ahmedabad','7:30 PM'],
    ['M32','SRH','PBKS','2026-04-22','Rajiv Gandhi Stadium, Hyderabad','7:30 PM'],
    ['M33','RCB','MI','2026-04-23','Chinnaswamy Stadium, Bengaluru','7:30 PM'],
    ['M34','CSK','DC','2026-04-24','MA Chidambaram Stadium, Chennai','7:30 PM'],
    ['M35','KKR','LSG','2026-04-25','Eden Gardens, Kolkata','3:30 PM'],
    ['M36','RR','GT','2026-04-25','Sawai Mansingh Stadium, Jaipur','7:30 PM'],
    ['M37','MI','SRH','2026-04-26','Wankhede Stadium, Mumbai','7:30 PM'],
    ['M38','PBKS','CSK','2026-04-27','Mullanpur Stadium, Punjab','7:30 PM'],
    ['M39','DC','KKR','2026-04-28','Arun Jaitley Stadium, Delhi','7:30 PM'],
    ['M40','GT','RCB','2026-04-29','Narendra Modi Stadium, Ahmedabad','7:30 PM'],
    ['M41','RR','MI','2026-04-30','Sawai Mansingh Stadium, Jaipur','7:30 PM'],
    ['M42','SRH','DC','2026-05-01','Rajiv Gandhi Stadium, Hyderabad','7:30 PM'],
    ['M43','LSG','GT','2026-05-02','Ekana Stadium, Lucknow','3:30 PM'],
    ['M44','KKR','PBKS','2026-05-02','Eden Gardens, Kolkata','7:30 PM'],
    ['M45','RCB','CSK','2026-05-03','Chinnaswamy Stadium, Bengaluru','7:30 PM'],
    ['M46','MI','GT','2026-05-04','Wankhede Stadium, Mumbai','7:30 PM'],
    ['M47','DC','RR','2026-05-05','Arun Jaitley Stadium, Delhi','7:30 PM'],
    ['M48','CSK','LSG','2026-05-06','MA Chidambaram Stadium, Chennai','7:30 PM'],
    ['M49','SRH','RCB','2026-05-07','Rajiv Gandhi Stadium, Hyderabad','7:30 PM'],
    ['M50','PBKS','KKR','2026-05-08','Mullanpur Stadium, Punjab','7:30 PM'],
    ['QF1','TBD','TBD','2026-05-26','Chinnaswamy Stadium, Bengaluru','7:30 PM'],
    ['EL', 'TBD','TBD','2026-05-27','Narendra Modi Stadium, Ahmedabad','7:30 PM'],
    ['QF2','TBD','TBD','2026-05-29','VCA Stadium, Nagpur','7:30 PM'],
    ['FIN','TBD','TBD','2026-05-31','Chinnaswamy Stadium, Bengaluru','7:30 PM'],
  ];
  for (const m of M) {
    await q('INSERT INTO matches(match_number,team1,team2,match_date,venue,time_ist) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', m);
  }
  console.log(`✅ Seeded ${M.length} IPL 2026 matches`);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const hashPin = pin => crypto.createHash('sha256').update(pin + 'ipl2026').digest('hex');

function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) return res.status(403).json({ error: 'Forbidden' });
  next();
}
async function requireUser(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const { rows } = await q('SELECT * FROM sessions WHERE token=$1', [token]);
  if (!rows.length) return res.status(401).json({ error: 'Session expired. Please login again.' });
  req.userMobile = rows[0].mobile;
  next();
}

async function getVoteStats(match_number) {
  const { rows: mRows } = await q('SELECT * FROM matches WHERE match_number=$1', [match_number]);
  const { rows } = await q('SELECT voted_for, COUNT(*) as c FROM votes WHERE match_number=$1 GROUP BY voted_for', [match_number]);
  const total = rows.reduce((a, b) => a + parseInt(b.c), 0);
  const stats = {};
  if (mRows[0]) [mRows[0].team1, mRows[0].team2].forEach(t => stats[t] = { count: 0, pct: 0 });
  rows.forEach(r => stats[r.voted_for] = { count: parseInt(r.c), pct: total ? Math.round(parseInt(r.c) / total * 100) : 0 });
  return { stats, total };
}

// Weekly window: Saturday 00:00 to Friday 23:59 IST
function getWeekWindow() {
  const now = new Date();
  // IST = UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const day = istNow.getUTCDay(); // 0=Sun,6=Sat
  const daysSinceSat = (day + 1) % 7; // days since last Saturday
  const satStart = new Date(istNow);
  satStart.setUTCDate(istNow.getUTCDate() - daysSinceSat);
  satStart.setUTCHours(0, 0, 0, 0);
  const friEnd = new Date(satStart);
  friEnd.setUTCDate(satStart.getUTCDate() + 6);
  friEnd.setUTCHours(23, 59, 59, 999);
  // Convert back to UTC for DB query
  return {
    start: new Date(satStart.getTime() - istOffset).toISOString(),
    end: new Date(friEnd.getTime() - istOffset).toISOString(),
  };
}

// Recalculate streak and total pts for a user after result is set
async function recalcUser(mobile) {
  // Get all settled match results in chronological order
  const { rows: history } = await q(`
    SELECT v.match_number, v.voted_for, mr.winner, m.match_date,
           mr.potm, mr.super_striker, mr.super_sixes, mr.fours_king
    FROM votes v
    JOIN matches m ON v.match_number = m.match_number
    LEFT JOIN match_results mr ON v.match_number = mr.match_number
    WHERE v.mobile = $1 AND mr.winner IS NOT NULL
    ORDER BY m.match_date ASC, m.time_ist ASC
  `, [mobile]);

  let totalPts = 0, correctVotes = 0, currentStreak = 0, bestStreak = 0, streakPts = 0, awardPts = 0;

  for (const row of history) {
    const isVoid = row.winner === 'no_result' || row.winner === 'void';
    const correct = !isVoid && row.voted_for === row.winner;

    if (correct) {
      correctVotes++;
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
      // Base 1pt for match winner
      let matchPts = 1.0;
      // Streak bonus: from 3rd win onwards +0.5 extra
      if (currentStreak >= 3) {
        matchPts += 0.5;
        streakPts += 0.5;
      }
      totalPts += matchPts;
    } else if (!isVoid) {
      currentStreak = 0;
    }
    // Award points
    if (!isVoid && row.winner) {
      const checks = [
        { key: 'potm', val: row.potm },
        { key: 'super_striker', val: row.super_striker },
        { key: 'super_sixes', val: row.super_sixes },
        { key: 'fours_king', val: row.fours_king },
      ];
      const { rows: picks } = await q(
        'SELECT award_key, pick FROM award_picks WHERE mobile=$1 AND match_number=$2',
        [mobile, row.match_number]
      );
      const pickMap = {};
      picks.forEach(p => pickMap[p.award_key] = p.pick);
      for (const c of checks) {
        if (c.val && pickMap[c.key] && pickMap[c.key] === c.val) {
          totalPts += 0.25;
          awardPts += 0.25;
        }
      }
    }
  }

  const totalVotes = history.length;
  await q(`
    UPDATE leaderboard SET
      points=$1, correct_votes=$2, total_votes=$3,
      award_pts=$4, streak_pts=$5, current_streak=$6, best_streak=$7
    WHERE mobile=$8
  `, [totalPts.toFixed(2), correctVotes, totalVotes, awardPts.toFixed(2), streakPts.toFixed(2), currentStreak, bestStreak, mobile]);
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { mobile, pin } = req.body;
    const { rows } = await q('SELECT * FROM users WHERE mobile=$1', [String(mobile)]);
    if (!rows.length) return res.status(403).json({ error: 'Mobile not registered. Contact admin.' });
    if (rows[0].pin !== hashPin(String(pin))) return res.status(401).json({ error: 'Wrong PIN. Try again.' });
    const token = crypto.randomBytes(32).toString('hex');
    await q('INSERT INTO sessions(token,mobile,created_at) VALUES($1,$2,$3) ON CONFLICT(token) DO UPDATE SET mobile=$2', [token, String(mobile), Date.now()]);
    res.json({ success: true, token, name: rows[0].name, mobile });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/logout', requireUser, async (req, res) => {
  await q('DELETE FROM sessions WHERE token=$1', [req.headers['x-auth-token']]);
  res.json({ success: true });
});

// ─── USER: MATCHES ────────────────────────────────────────────────────────────
app.get('/api/matches', requireUser, async (req, res) => {
  try {
    const { rows: matches } = await q('SELECT * FROM matches ORDER BY match_date, time_ist');
    const { rows: myVoteRows } = await q('SELECT match_number, voted_for FROM votes WHERE mobile=$1', [req.userMobile]);
    const { rows: myPickRows } = await q('SELECT match_number, award_key, pick FROM award_picks WHERE mobile=$1', [req.userMobile]);
    const myVotes = {}, myPicks = {};
    myVoteRows.forEach(v => myVotes[v.match_number] = v.voted_for);
    myPickRows.forEach(p => {
      if (!myPicks[p.match_number]) myPicks[p.match_number] = {};
      myPicks[p.match_number][p.award_key] = p.pick;
    });
    const result = await Promise.all(matches.map(async m => {
      const { stats, total } = await getVoteStats(m.match_number);
      const { rows: mrRows } = await q('SELECT * FROM match_results WHERE match_number=$1', [m.match_number]);
      return { ...m, my_vote: myVotes[m.match_number] || null, my_picks: myPicks[m.match_number] || {}, vote_stats: stats, total_votes: total, match_result: mrRows[0] || null };
    }));
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── USER: VOTE ───────────────────────────────────────────────────────────────
app.post('/api/vote', requireUser, async (req, res) => {
  try {
    const { match_number, voted_for } = req.body;
    const mobile = req.userMobile;
    const { rows: mRows } = await q('SELECT * FROM matches WHERE match_number=$1', [match_number]);
    if (!mRows.length) return res.status(404).json({ error: 'Match not found' });
    const match = mRows[0];
    if (!match.voting_enabled) return res.status(403).json({ error: '🚫 Voting is currently DISABLED for this match.' });
    if (voted_for !== match.team1 && voted_for !== match.team2) return res.status(400).json({ error: 'Invalid team' });
    if (match.winner) return res.status(400).json({ error: 'This match has ended.' });
    try {
      await q('INSERT INTO votes(mobile,match_number,voted_for) VALUES($1,$2,$3)', [mobile, match_number, voted_for]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: '⚠️ You have already voted for this match!' });
      throw e;
    }
    const { stats, total } = await getVoteStats(match_number);
    res.json({ success: true, message: `🎉 Vote locked in for ${voted_for}!`, vote_stats: stats, total_votes: total });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── USER: AWARD PICKS ────────────────────────────────────────────────────────
app.post('/api/award-pick', requireUser, async (req, res) => {
  try {
    const { match_number, award_key, pick } = req.body;
    const mobile = req.userMobile;
    if (!AWARDS.find(a => a.key === award_key && a.key !== 'match_winner')) return res.status(400).json({ error: 'Invalid award key' });
    const { rows: mRows } = await q('SELECT * FROM matches WHERE match_number=$1', [match_number]);
    if (!mRows.length) return res.status(404).json({ error: 'Match not found' });
    if (!mRows[0].voting_enabled) return res.status(403).json({ error: '🚫 Voting is disabled for this match.' });
    if (mRows[0].winner) return res.status(400).json({ error: 'Match already ended.' });
    await q(`INSERT INTO award_picks(mobile,match_number,award_key,pick) VALUES($1,$2,$3,$4)
      ON CONFLICT(mobile,match_number,award_key) DO UPDATE SET pick=$4, created_at=NOW()`,
      [mobile, match_number, award_key, pick]);
    res.json({ success: true, message: `✅ ${pick} selected for ${AWARDS.find(a=>a.key===award_key)?.label}!` });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── USER: MY VOTES ───────────────────────────────────────────────────────────
app.get('/api/my-votes', requireUser, async (req, res) => {
  try {
    const { rows } = await q(`
      SELECT v.*, m.team1, m.team2, m.match_date, m.venue, m.time_ist, m.winner, m.voting_enabled,
             mr.potm, mr.super_striker, mr.super_sixes, mr.fours_king
      FROM votes v
      JOIN matches m ON v.match_number=m.match_number
      LEFT JOIN match_results mr ON v.match_number=mr.match_number
      WHERE v.mobile=$1 ORDER BY m.match_date DESC, m.time_ist DESC`, [req.userMobile]);
    // Attach award picks for each match
    const mns = rows.map(r => r.match_number);
    let picks = [];
    if (mns.length) {
      const { rows: pRows } = await q(`SELECT match_number, award_key, pick FROM award_picks WHERE mobile=$1 AND match_number=ANY($2)`, [req.userMobile, mns]);
      picks = pRows;
    }
    const pickMap = {};
    picks.forEach(p => { if (!pickMap[p.match_number]) pickMap[p.match_number] = {}; pickMap[p.match_number][p.award_key] = p.pick; });
    res.json(rows.map(r => ({ ...r, my_picks: pickMap[r.match_number] || {} })));
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── PUBLIC: OVERALL LEADERBOARD ─────────────────────────────────────────────
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { rows } = await q('SELECT name, points, correct_votes, total_votes, award_pts, streak_pts, current_streak, best_streak FROM leaderboard ORDER BY points DESC, correct_votes DESC, name ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ─── PUBLIC: WEEKLY LEADERBOARD ──────────────────────────────────────────────
app.get('/api/leaderboard/weekly', async (req, res) => {
  try {
    const { start, end } = getWeekWindow();
    // Get votes for matches in this week window
    const { rows } = await q(`
      SELECT u.name, u.mobile,
        COUNT(CASE WHEN mr.winner IS NOT NULL AND mr.winner NOT IN ('no_result','void') AND v.voted_for=mr.winner THEN 1 END) as correct_votes,
        COUNT(CASE WHEN mr.winner IS NOT NULL THEN 1 END) as total_votes,
        COALESCE(SUM(CASE WHEN mr.winner IS NOT NULL AND mr.winner NOT IN ('no_result','void') AND v.voted_for=mr.winner THEN 1.0 ELSE 0 END), 0) as match_pts,
        COALESCE(SUM(
          (CASE WHEN ap_potm.pick=mr.potm AND mr.potm IS NOT NULL THEN 0.25 ELSE 0 END) +
          (CASE WHEN ap_ss.pick=mr.super_striker AND mr.super_striker IS NOT NULL THEN 0.25 ELSE 0 END) +
          (CASE WHEN ap_sx.pick=mr.super_sixes AND mr.super_sixes IS NOT NULL THEN 0.25 ELSE 0 END) +
          (CASE WHEN ap_fk.pick=mr.fours_king AND mr.fours_king IS NOT NULL THEN 0.25 ELSE 0 END)
        ), 0) as award_pts
      FROM users u
      JOIN votes v ON u.mobile=v.mobile
      JOIN matches m ON v.match_number=m.match_number
      LEFT JOIN match_results mr ON v.match_number=mr.match_number
      LEFT JOIN award_picks ap_potm ON ap_potm.mobile=u.mobile AND ap_potm.match_number=v.match_number AND ap_potm.award_key='potm'
      LEFT JOIN award_picks ap_ss ON ap_ss.mobile=u.mobile AND ap_ss.match_number=v.match_number AND ap_ss.award_key='super_striker'
      LEFT JOIN award_picks ap_sx ON ap_sx.mobile=u.mobile AND ap_sx.match_number=v.match_number AND ap_sx.award_key='super_sixes'
      LEFT JOIN award_picks ap_fk ON ap_fk.mobile=u.mobile AND ap_fk.match_number=v.match_number AND ap_fk.award_key='fours_king'
      WHERE m.match_date >= $1::date AND m.match_date <= $2::date
      GROUP BY u.name, u.mobile
      ORDER BY (COALESCE(SUM(CASE WHEN mr.winner IS NOT NULL AND mr.winner NOT IN ('no_result','void') AND v.voted_for=mr.winner THEN 1.0 ELSE 0 END),0) + COALESCE(SUM((CASE WHEN ap_potm.pick=mr.potm AND mr.potm IS NOT NULL THEN 0.25 ELSE 0 END)+(CASE WHEN ap_ss.pick=mr.super_striker AND mr.super_striker IS NOT NULL THEN 0.25 ELSE 0 END)+(CASE WHEN ap_sx.pick=mr.super_sixes AND mr.super_sixes IS NOT NULL THEN 0.25 ELSE 0 END)+(CASE WHEN ap_fk.pick=mr.fours_king AND mr.fours_king IS NOT NULL THEN 0.25 ELSE 0 END)),0)) DESC, u.name ASC
    `, [start.split('T')[0], end.split('T')[0]]);
    res.json({ week_start: start, week_end: end, leaderboard: rows.map(r => ({ ...r, total_pts: (parseFloat(r.match_pts) + parseFloat(r.award_pts)).toFixed(2) })) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ─── API: PLAYERS FOR A MATCH ─────────────────────────────────────────────────
app.get('/api/players/:match_number', requireUser, async (req, res) => {
  const { rows } = await q('SELECT team1, team2 FROM matches WHERE match_number=$1', [req.params.match_number]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const { team1, team2 } = rows[0];
  res.json({
    team1, team2,
    players: {
      [team1]: IPL_PLAYERS[team1] || [],
      [team2]: IPL_PLAYERS[team2] || [],
    }
  });
});

// ─── ADMIN: USERS ─────────────────────────────────────────────────────────────
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT mobile, name, plain_pin FROM users ORDER BY name');
  res.json(rows);
});
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { users } = req.body;
    const results = [];
    for (const u of users) {
      const mobile = String(u.mobile).trim(), name = u.name.trim();
      const pin = u.pin ? String(u.pin).trim() : String(Math.floor(1000 + Math.random() * 9000));
      await q('INSERT INTO users(mobile,name,pin,plain_pin) VALUES($1,$2,$3,$4) ON CONFLICT(mobile) DO UPDATE SET name=$2,pin=$3,plain_pin=$4', [mobile, name, hashPin(pin), pin]);
      await q('INSERT INTO leaderboard(mobile,name,points,correct_votes,total_votes,award_pts,streak_pts,current_streak,best_streak) VALUES($1,$2,0,0,0,0,0,0,0) ON CONFLICT(mobile) DO UPDATE SET name=$2', [mobile, name]);
      results.push({ mobile, name, pin });
    }
    res.json({ success: true, inserted: results.length, users: results });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});
app.delete('/api/admin/users/:mobile', requireAdmin, async (req, res) => {
  await q('DELETE FROM users WHERE mobile=$1', [req.params.mobile]);
  res.json({ success: true });
});
app.patch('/api/admin/users/:mobile/reset-pin', requireAdmin, async (req, res) => {
  const { pin } = req.body;
  if (!pin || !/^\d{4,6}$/.test(String(pin))) return res.status(400).json({ error: 'PIN must be 4-6 digits' });
  await q('UPDATE users SET pin=$1, plain_pin=$2 WHERE mobile=$3', [hashPin(String(pin)), String(pin), req.params.mobile]);
  res.json({ success: true, pin });
});

// ─── ADMIN: MATCHES ───────────────────────────────────────────────────────────
app.get('/api/admin/matches', requireAdmin, async (req, res) => {
  const { rows: matches } = await q('SELECT * FROM matches ORDER BY match_date, time_ist');
  const result = await Promise.all(matches.map(async m => {
    const { stats, total } = await getVoteStats(m.match_number);
    const { rows: mrRows } = await q('SELECT * FROM match_results WHERE match_number=$1', [m.match_number]);
    return { ...m, vote_stats: stats, total_votes: total, match_result: mrRows[0] || null };
  }));
  res.json(result);
});
app.post('/api/admin/matches', requireAdmin, async (req, res) => {
  const { match_number, team1, team2, match_date, venue, time_ist } = req.body;
  if (!match_number || !team1 || !team2 || !match_date || !venue) return res.status(400).json({ error: 'All fields required' });
  await q('INSERT INTO matches(match_number,team1,team2,match_date,venue,time_ist) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(match_number) DO UPDATE SET team1=$2,team2=$3,match_date=$4,venue=$5,time_ist=$6',
    [match_number, team1.toUpperCase(), team2.toUpperCase(), match_date, venue, time_ist || '7:30 PM']);
  res.json({ success: true });
});
app.put('/api/admin/matches/:mn', requireAdmin, async (req, res) => {
  const { team1, team2, match_date, venue, time_ist } = req.body;
  const { rows } = await q('SELECT * FROM matches WHERE match_number=$1', [req.params.mn]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const m = rows[0];
  await q('UPDATE matches SET team1=$1,team2=$2,match_date=$3,venue=$4,time_ist=$5 WHERE match_number=$6',
    [team1||m.team1, team2||m.team2, match_date||m.match_date, venue||m.venue, time_ist||m.time_ist, req.params.mn]);
  res.json({ success: true });
});
app.delete('/api/admin/matches/:mn', requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT winner FROM matches WHERE match_number=$1', [req.params.mn]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  if (rows[0].winner) return res.status(400).json({ error: 'Cannot delete a completed match' });
  await q('DELETE FROM votes WHERE match_number=$1', [req.params.mn]);
  await q('DELETE FROM award_picks WHERE match_number=$1', [req.params.mn]);
  await q('DELETE FROM matches WHERE match_number=$1', [req.params.mn]);
  res.json({ success: true });
});
app.patch('/api/admin/matches/:mn/voting', requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT * FROM matches WHERE match_number=$1', [req.params.mn]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  if (rows[0].winner) return res.status(400).json({ error: 'Match already finished' });
  await q('UPDATE matches SET voting_enabled=$1 WHERE match_number=$2', [!!req.body.enabled, req.params.mn]);
  res.json({ success: true, voting_enabled: !!req.body.enabled });
});

// ─── ADMIN: SET FULL RESULT (winner + all awards) ────────────────────────────
app.patch('/api/admin/matches/:mn/result', requireAdmin, async (req, res) => {
  try {
    const { rows: mRows } = await q('SELECT * FROM matches WHERE match_number=$1', [req.params.mn]);
    if (!mRows.length) return res.status(404).json({ error: 'Not found' });
    const match = mRows[0];
    if (match.winner) return res.status(400).json({ error: `Result already set: ${match.winner}` });

    const { winner, potm, super_striker, super_sixes, fours_king } = req.body;
    const valid = [match.team1, match.team2, 'no_result', 'void'];
    if (!valid.includes(winner)) return res.status(400).json({ error: `Winner must be: ${valid.join(', ')}` });

    await q('UPDATE matches SET winner=$1, voting_enabled=FALSE WHERE match_number=$2', [winner, req.params.mn]);
    await q(`INSERT INTO match_results(match_number,winner,potm,super_striker,super_sixes,fours_king)
      VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(match_number) DO UPDATE SET winner=$2,potm=$3,super_striker=$4,super_sixes=$5,fours_king=$6`,
      [req.params.mn, winner, potm||null, super_striker||null, super_sixes||null, fours_king||null]);

    // Recalculate leaderboard for all voters of this match
    const { rows: voters } = await q('SELECT DISTINCT mobile FROM votes WHERE match_number=$1', [req.params.mn]);
    for (const v of voters) await recalcUser(v.mobile);
    // Also recalc award pickers who didn't vote match winner
    const { rows: apickers } = await q('SELECT DISTINCT mobile FROM award_picks WHERE match_number=$1', [req.params.mn]);
    const voterSet = new Set(voters.map(v => v.mobile));
    for (const p of apickers) { if (!voterSet.has(p.mobile)) await recalcUser(p.mobile); }

    res.json({ success: true, winner, message: `Result set for ${req.params.mn}. Leaderboard updated!` });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/matches/:mn/stats', requireAdmin, async (req, res) => {
  const { rows: mRows } = await q('SELECT * FROM matches WHERE match_number=$1', [req.params.mn]);
  if (!mRows.length) return res.status(404).json({ error: 'Not found' });
  const { stats, total } = await getVoteStats(req.params.mn);
  const { rows: voters } = await q(`SELECT v.voted_for,u.name,v.mobile,v.created_at FROM votes v JOIN users u ON v.mobile=u.mobile WHERE v.match_number=$1 ORDER BY v.created_at`, [req.params.mn]);
  const { rows: awardStats } = await q(`SELECT award_key, pick, COUNT(*) as c FROM award_picks WHERE match_number=$1 GROUP BY award_key, pick ORDER BY award_key, c DESC`, [req.params.mn]);
  const { rows: mrRows } = await q('SELECT * FROM match_results WHERE match_number=$1', [req.params.mn]);
  res.json({ match: mRows[0], vote_stats: stats, total_votes: total, voters, award_stats: awardStats, match_result: mrRows[0] || null });
});

app.get('/api/admin/leaderboard', requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT * FROM leaderboard ORDER BY points DESC, correct_votes DESC');
  res.json(rows);
});

// ─── EXPORT ───────────────────────────────────────────────────────────────────
app.get('/api/admin/export/votes', requireAdmin, async (req, res) => {
  const { rows } = await q(`SELECT v.match_number,m.team1,m.team2,m.match_date,mr.winner,u.name,v.mobile,v.voted_for,v.created_at,
    CASE WHEN mr.winner IS NULL THEN 'pending' WHEN mr.winner IN ('no_result','void') THEN 'void' WHEN v.voted_for=mr.winner THEN 'correct' ELSE 'wrong' END as result
    FROM votes v JOIN matches m ON v.match_number=m.match_number JOIN users u ON v.mobile=u.mobile LEFT JOIN match_results mr ON v.match_number=mr.match_number ORDER BY v.match_number,v.created_at`);
  res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="ipl2026_votes.csv"');
  res.send('Match,Team1,Team2,Date,Winner,Voter,Mobile,VotedFor,VotedAt,Result\n'+rows.map(r=>`${r.match_number},${r.team1},${r.team2},${r.match_date},${r.winner||''},${r.name},${r.mobile},${r.voted_for},${r.created_at},${r.result}`).join('\n'));
});
app.get('/api/admin/export/leaderboard', requireAdmin, async (req, res) => {
  const { rows } = await q('SELECT * FROM leaderboard ORDER BY points DESC');
  res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition','attachment; filename="ipl2026_leaderboard.csv"');
  res.send('Rank,Name,Mobile,TotalPts,MatchPts,AwardPts,StreakPts,CorrectVotes,TotalVotes,CurrentStreak,BestStreak\n'+rows.map((r,i)=>`${i+1},${r.name},${r.mobile},${r.points},${r.points-r.award_pts-r.streak_pts},${r.award_pts},${r.streak_pts},${r.correct_votes},${r.total_votes},${r.current_streak},${r.best_streak}`).join('\n'));
});
app.get('/api/admin/export/full', requireAdmin, async (req, res) => {
  const [m,v,l,u,ap,mr] = await Promise.all([
    q('SELECT * FROM matches ORDER BY match_date'),q('SELECT v.*,u.name FROM votes v JOIN users u ON v.mobile=u.mobile'),
    q('SELECT * FROM leaderboard ORDER BY points DESC'),q('SELECT name,mobile FROM users ORDER BY name'),
    q('SELECT * FROM award_picks ORDER BY match_number,created_at'),q('SELECT * FROM match_results'),
  ]);
  res.setHeader('Content-Type','application/json');res.setHeader('Content-Disposition','attachment; filename="ipl2026_backup.json"');
  res.json({exported_at:new Date().toISOString(),matches:m.rows,votes:v.rows,leaderboard:l.rows,users:u.rows,award_picks:ap.rows,match_results:mr.rows});
});

app.get('/health', async (req, res) => {
  try {
    const [m,v,u] = await Promise.all([q('SELECT COUNT(*) FROM matches'),q('SELECT COUNT(*) FROM votes'),q('SELECT COUNT(*) FROM users')]);
    res.json({status:'ok',uptime:Math.floor(process.uptime()),matches:m.rows[0].count,votes:v.rows[0].count,users:u.rows[0].count});
  } catch(e){res.status(500).json({status:'db_error',error:e.message});}
});

app.get('/admin*',(_,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
initDB().then(()=>app.listen(PORT,()=>console.log(`\n🏏 IPL Voting → http://localhost:${PORT}\n   Admin → http://localhost:${PORT}/admin  [key: ${ADMIN_KEY}]\n`)));
