
import express from "express";
import { google } from "googleapis";
import cookieSession from "cookie-session";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'worktrack-secret-123'],
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  secure: true,
  sameSite: 'none'
}));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`
);

const SUPER_ADMIN_EMAIL = 'thutrang180688@gmail.com';

// --- Google Sheets Helpers ---
async function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth });
}

async function ensureSheetsInitialized(sheets: any, spreadsheetId: string) {
  try {
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetNames = response.data.sheets.map((s: any) => s.properties.title);
    
    const requiredSheets = ['Users', 'Attendance', 'Settings'];
    for (const name of requiredSheets) {
      if (!sheetNames.includes(name)) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: name } } }]
          }
        });
        
        // Add headers
        const headers = name === 'Users' ? ['Email', 'Name', 'LastLogin'] :
                        name === 'Attendance' ? ['Email', 'Date', 'Type', 'Note', 'ChromeActiveTime', 'IsAutoClocked', 'IsManual'] :
                        ['Email', 'UserName', 'InitialAnnualLeave', 'SeniorityDays', 'ShiftCode', 'TargetWorkingDays', 'AutoSuggest'];
        
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${name}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] }
        });
      }
    }
  } catch (error) {
    console.error('Error initializing sheets:', error);
  }
}

// --- Auth Routes ---
app.get('/api/auth/url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
    prompt: 'consent'
  });
  res.json({ url });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    req.session!.user = {
      email: userInfo.data.email,
      name: userInfo.data.name,
      picture: userInfo.data.picture,
      accessToken: tokens.access_token
    };

    // Log user login in Sheets
    if (process.env.GOOGLE_SHEET_ID) {
      const sheets = await getSheetsClient(tokens.access_token!);
      await ensureSheetsInitialized(sheets, process.env.GOOGLE_SHEET_ID);
      
      // Update Users sheet
      const email = userInfo.data.email;
      const name = userInfo.data.name;
      const lastLogin = new Date().toISOString();
      
      const rows = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Users!A:A'
      });
      
      const existingEmails = rows.data.values?.map(r => r[0]) || [];
      const index = existingEmails.indexOf(email);
      
      if (index === -1) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Users!A:C',
          valueInputOption: 'RAW',
          requestBody: { values: [[email, name, lastLogin]] }
        });
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: `Users!C${index + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[lastLogin]] }
        });
      }
    }

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Đăng nhập thành công! Cửa sổ này sẽ tự đóng.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.session?.user || null });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

// --- Data Routes ---
app.get('/api/data', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.GOOGLE_SHEET_ID) return res.status(400).json({ error: 'Sheet ID not configured' });

  try {
    const sheets = await getSheetsClient(req.session.user.accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const email = req.session.user.email;

    // Fetch Attendance
    const attRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Attendance!A:G'
    });
    const attendanceRows = attRes.data.values || [];
    const userAttendance: any = {};
    attendanceRows.forEach((row, i) => {
      if (i === 0) return; // Skip header
      if (row[0] === email) {
        userAttendance[row[1]] = {
          date: row[1],
          type: row[2],
          note: row[3] || '',
          chromeActiveTime: Number(row[4]) || 0,
          isAutoClocked: row[5] === 'TRUE',
          isManual: row[6] === 'TRUE'
        };
      }
    });

    // Fetch Settings
    const setRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Settings!A:G'
    });
    const settingsRows = setRes.data.values || [];
    let userSettings = null;
    settingsRows.forEach((row, i) => {
      if (i === 0) return;
      if (row[0] === email) {
        userSettings = {
          userName: row[1],
          initialAnnualLeave: Number(row[2]),
          seniorityDays: Number(row[3]),
          shiftCode: row[4],
          targetWorkingDays: Number(row[5]),
          autoSuggest: row[6] === 'TRUE'
        };
      }
    });

    res.json({ attendance: userAttendance, settings: userSettings });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.post('/api/data', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.GOOGLE_SHEET_ID) return res.status(400).json({ error: 'Sheet ID not configured' });

  const { attendance, settings } = req.body;
  const email = req.session.user.email;

  try {
    const sheets = await getSheetsClient(req.session.user.accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Save Settings
    const setRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Settings!A:A' });
    const setEmails = setRes.data.values?.map(r => r[0]) || [];
    const setIndex = setEmails.indexOf(email);
    const settingsRow = [
      email,
      settings.userName,
      settings.initialAnnualLeave,
      settings.seniorityDays,
      settings.shiftCode,
      settings.targetWorkingDays,
      settings.autoSuggest ? 'TRUE' : 'FALSE'
    ];

    if (setIndex === -1) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Settings!A:G',
        valueInputOption: 'RAW',
        requestBody: { values: [settingsRow] }
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Settings!A${setIndex + 1}:G${setIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: [settingsRow] }
      });
    }

    // Save Attendance (This is tricky, we'll clear user's old data and re-insert or update selectively)
    // For simplicity, we'll clear and re-insert user's attendance for the current month/year or just all.
    // Let's try a more efficient way: only update what's in the payload.
    const attRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Attendance!A:B' });
    const attRows = attRes.data.values || [];
    
    const updates = [];
    const appends = [];

    for (const dateId in attendance) {
      const record = attendance[dateId];
      const rowIndex = attRows.findIndex(r => r[0] === email && r[1] === dateId);
      const rowData = [
        email,
        dateId,
        record.type,
        record.note || '',
        record.chromeActiveTime || 0,
        record.isAutoClocked ? 'TRUE' : 'FALSE',
        record.isManual ? 'TRUE' : 'FALSE'
      ];

      if (rowIndex !== -1) {
        updates.push({
          range: `Attendance!A${rowIndex + 1}:G${rowIndex + 1}`,
          values: [rowData]
        });
      } else {
        appends.push(rowData);
      }
    }

    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });
    }
    if (appends.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Attendance!A:G',
        valueInputOption: 'RAW',
        requestBody: { values: appends }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// --- Admin Routes ---
app.get('/api/admin/users', async (req, res) => {
  if (req.session?.user?.email !== SUPER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!process.env.GOOGLE_SHEET_ID) return res.status(400).json({ error: 'Sheet ID not configured' });

  try {
    const sheets = await getSheetsClient(req.session.user.accessToken);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Users!A:C'
    });
    const rows = response.data.values || [];
    const users = rows.slice(1).map(r => ({
      email: r[0],
      name: r[1],
      lastLogin: r[2]
    }));
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Chỉ import vite khi ở môi trường phát triển (local)
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Ở môi trường production (Vercel), chỉ phục vụ file tĩnh
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
