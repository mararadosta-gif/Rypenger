const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const JWT_SECRET =
  process.env.JWT_SECRET || "rypenger-dev-secret";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Vytvoření tabulky uživatelů
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("PostgreSQL databáze připravena.");
}

// TEST SERVERU
app.get("/", (req, res) => {
  res.json({
    app: "Rypenger",
    status: "online",
    message: "Rypenger backend běží."
  });
});

// REGISTRACE
app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Vyplň uživatelské jméno, e-mail a heslo."
      });
    }

    const cleanUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        error: "Uživatelské jméno musí mít alespoň 3 znaky."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Heslo musí mít alespoň 6 znaků."
      });
    }

    const existingEmail = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        error: "Tento e-mail už je registrovaný."
      });
    }

    const existingUsername = await pool.query(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1)",
      [cleanUsername]
    );

    if (existingUsername.rows.length > 0) {
      return res.status(409).json({
        error: "Toto uživatelské jméno už existuje."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users
      (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email
      `,
      [
        cleanUsername,
        normalizedEmail,
        passwordHash
      ]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username
      },
      JWT_SECRET,
      {
        expiresIn: "30d"
      }
    );

    res.status(201).json({
      message: "Účet byl vytvořen.",
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("REGISTRATION ERROR:", error);

    res.status(500).json({
      error: "Chyba serveru při registraci."
    });
  }
});

// PŘIHLÁŠENÍ
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Zadej e-mail a heslo."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, username, email, password_hash
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Nesprávný e-mail nebo heslo."
      });
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        error: "Nesprávný e-mail nebo heslo."
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username
      },
      JWT_SECRET,
      {
        expiresIn: "30d"
      }
    );

    res.json({
      message: "Přihlášení proběhlo úspěšně.",
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      error: "Chyba serveru při přihlášení."
    });
  }
});

// OVĚŘENÍ TOKENU
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Chybí přihlašovací token."
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const user = jwt.verify(token, JWT_SECRET);

    req.user = user;

    next();
  } catch {
    return res.status(401).json({
      error: "Neplatný nebo prošlý token."
    });
  }
}

// PROFIL
app.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, username, email
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Uživatel nebyl nalezen."
      });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error("PROFILE ERROR:", error);

    res.status(500).json({
      error: "Chyba serveru."
    });
  }
});

// START SERVERU
async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(
        `Rypenger backend běží na portu ${PORT}`
      );
    });

  } catch (error) {
    console.error(
      "Nepodařilo se připojit k PostgreSQL:",
      error
    );

    process.exit(1);
  }
}

startServer();
