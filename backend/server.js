const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "rypenger-dev-secret";

// Dočasná databáze
const users = [];

// TEST
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

    if (password.length < 6) {
      return res.status(400).json({
        error: "Heslo musí mít alespoň 6 znaků."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = users.find(
      user => user.email === normalizedEmail
    );

    if (existingUser) {
      return res.status(409).json({
        error: "Tento e-mail už je registrovaný."
      });
    }

    const existingUsername = users.find(
      user =>
        user.username.toLowerCase() ===
        username.trim().toLowerCase()
    );

    if (existingUsername) {
      return res.status(409).json({
        error: "Toto uživatelské jméno už existuje."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      id: Date.now().toString(),
      username: username.trim(),
      email: normalizedEmail,
      passwordHash
    };

    users.push(user);

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
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Chyba serveru."
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

    const user = users.find(
      user => user.email === normalizedEmail
    );

    if (!user) {
      return res.status(401).json({
        error: "Nesprávný e-mail nebo heslo."
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.passwordHash
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
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Chyba serveru."
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
app.get("/me", authenticateToken, (req, res) => {
  const user = users.find(
    user => user.id === req.user.id
  );

  if (!user) {
    return res.status(404).json({
      error: "Uživatel nebyl nalezen."
    });
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

// START
app.listen(PORT, () => {
  console.log(`Rypenger backend běží na portu ${PORT}`);
});
