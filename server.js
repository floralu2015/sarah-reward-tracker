const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS piano_sessions (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                minutes INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS weekly_awards (
                id SERIAL PRIMARY KEY,
                week_start DATE NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS tests (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                subject VARCHAR(255) NOT NULL,
                score INTEGER NOT NULL,
                max_score INTEGER NOT NULL,
                awarded BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS incidents (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                type VARCHAR(50) NOT NULL,
                amount INTEGER NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database tables initialized');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

// Helper: Get week start (Monday)
function getWeekStart(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

// API Routes

// Get all data
app.get('/api/data', async (req, res) => {
    try {
        const pianoSessions = await pool.query('SELECT * FROM piano_sessions ORDER BY date DESC');
        const weeklyAwards = await pool.query('SELECT * FROM weekly_awards');
        const tests = await pool.query('SELECT * FROM tests ORDER BY date DESC');
        const incidents = await pool.query('SELECT * FROM incidents ORDER BY date DESC');
        const transactions = await pool.query('SELECT * FROM transactions ORDER BY date DESC, id DESC');

        // Calculate balance from transactions
        const balanceResult = await pool.query('SELECT COALESCE(SUM(amount), 0) as balance FROM transactions');
        const balance = parseInt(balanceResult.rows[0].balance);

        res.json({
            balance,
            pianoSessions: pianoSessions.rows,
            weeklyAwards: weeklyAwards.rows,
            tests: tests.rows,
            incidents: incidents.rows,
            transactions: transactions.rows
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Log piano session
app.post('/api/piano', async (req, res) => {
    const { date, minutes } = req.body;

    try {
        // Add piano session
        await pool.query(
            'INSERT INTO piano_sessions (date, minutes) VALUES ($1, $2)',
            [date, minutes]
        );

        // Check weekly goal
        const weekStart = getWeekStart(date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // Get total minutes for the week
        const weekMinutesResult = await pool.query(
            'SELECT COALESCE(SUM(minutes), 0) as total FROM piano_sessions WHERE date >= $1 AND date <= $2',
            [weekStart, weekEndStr]
        );
        const weekMinutes = parseInt(weekMinutesResult.rows[0].total);

        // Check if already awarded this week
        const awardCheck = await pool.query(
            'SELECT * FROM weekly_awards WHERE week_start = $1',
            [weekStart]
        );

        let awarded = false;
        if (weekMinutes >= 150 && awardCheck.rows.length === 0) {
            // Award for this week!
            await pool.query('INSERT INTO weekly_awards (week_start) VALUES ($1)', [weekStart]);
            await pool.query(
                'INSERT INTO transactions (date, type, amount, description) VALUES ($1, $2, $3, $4)',
                [date, 'piano', 50, `Weekly piano goal met! (${weekMinutes} min)`]
            );
            awarded = true;
        }

        res.json({ success: true, awarded, weekMinutes });
    } catch (err) {
        console.error('Error logging piano:', err);
        res.status(500).json({ error: 'Failed to log piano session' });
    }
});

// Log test score
app.post('/api/test', async (req, res) => {
    const { date, subject, score, maxScore } = req.body;
    const percentage = (score / maxScore) * 100;
    const awarded = percentage >= 95;

    try {
        await pool.query(
            'INSERT INTO tests (date, subject, score, max_score, awarded) VALUES ($1, $2, $3, $4, $5)',
            [date, subject, score, maxScore, awarded]
        );

        if (awarded) {
            await pool.query(
                'INSERT INTO transactions (date, type, amount, description) VALUES ($1, $2, $3, $4)',
                [date, 'test', 100, `${subject} test: ${score}/${maxScore} (${percentage.toFixed(0)}%)`]
            );
        }

        res.json({ success: true, awarded, percentage });
    } catch (err) {
        console.error('Error logging test:', err);
        res.status(500).json({ error: 'Failed to log test' });
    }
});

// Log incident
app.post('/api/incident', async (req, res) => {
    const { date, note } = req.body;

    try {
        await pool.query(
            'INSERT INTO incidents (date, note) VALUES ($1, $2)',
            [date, note || '']
        );

        await pool.query(
            'INSERT INTO transactions (date, type, amount, description) VALUES ($1, $2, $3, $4)',
            [date, 'incident', -50, note ? `Incident: ${note}` : 'Crying incident']
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Error logging incident:', err);
        res.status(500).json({ error: 'Failed to log incident' });
    }
});

// Delete transaction
app.delete('/api/transaction/:id', async (req, res) => {
    const { id } = req.params;

    try {
        // Get transaction details first
        const txResult = await pool.query('SELECT * FROM transactions WHERE id = $1', [id]);
        if (txResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const tx = txResult.rows[0];

        // If it was a piano award, remove the weekly award too
        if (tx.type === 'piano' && tx.amount > 0) {
            const weekStart = getWeekStart(tx.date);
            await pool.query('DELETE FROM weekly_awards WHERE week_start = $1', [weekStart]);
        }

        // Delete the transaction
        await pool.query('DELETE FROM transactions WHERE id = $1', [id]);

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting transaction:', err);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Reset all data
app.post('/api/reset', async (req, res) => {
    try {
        await pool.query('DELETE FROM transactions');
        await pool.query('DELETE FROM piano_sessions');
        await pool.query('DELETE FROM weekly_awards');
        await pool.query('DELETE FROM tests');
        await pool.query('DELETE FROM incidents');
        res.json({ success: true });
    } catch (err) {
        console.error('Error resetting data:', err);
        res.status(500).json({ error: 'Failed to reset data' });
    }
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Sarah's Reward Tracker running on port ${PORT}`);
    });
});
