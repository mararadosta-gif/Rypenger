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

// =========================
// DATABASE
// =========================

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id BIGSERIAL PRIMARY KEY,
      user_one BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_two BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_one, user_two)
    )
  `);

  await pool.query(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'private'
  `);

  await pool.query(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS name VARCHAR(100)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id BIGINT
        REFERENCES conversations(id) ON DELETE CASCADE,

      user_id BIGINT
        REFERENCES users(id) ON DELETE CASCADE,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      PRIMARY KEY (conversation_id, user_id)
    )
  `);

  // Přidání členů ke starším 1:1 chatům
  await pool.query(`
    INSERT INTO conversation_members
      (conversation_id, user_id)

    SELECT id, user_one
    FROM conversations
    WHERE type = 'private'

    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    INSERT INTO conversation_members
      (conversation_id, user_id)

    SELECT id, user_two
    FROM conversations
    WHERE type = 'private'

    ON CONFLICT DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,

      conversation_id BIGINT NOT NULL
        REFERENCES conversations(id) ON DELETE CASCADE,

      sender_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

      message TEXT NOT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_conversation_members_user
    ON conversation_members(user_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_messages_conversation
    ON messages(conversation_id, created_at)
  `);

  console.log("PostgreSQL databáze připravena.");
}

// =========================
// AUTH
// =========================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: "Chybí přihlašovací token."
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: "Neplatný nebo prošlý token."
    });
  }
}

// =========================
// TEST
// =========================

app.get("/", (req, res) => {
  res.json({
    app: "Rypenger",
    status: "online",
    message: "Rypenger backend běží."
  });
});

// =========================
// REGISTRACE
// =========================

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
      `
      SELECT id
      FROM users
      WHERE LOWER(username) = LOWER($1)
      `,
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

// =========================
// LOGIN
// =========================

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

// =========================
// PROFIL
// =========================

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

// =========================
// VYHLEDÁNÍ UŽIVATELŮ
// =========================

app.get(
  "/users/search",
  authenticateToken,
  async (req, res) => {
    try {
      const q = (req.query.q || "").trim();

      if (q.length < 2) {
        return res.json({
          users: []
        });
      }

      const result = await pool.query(
        `
        SELECT id, username, email
        FROM users
        WHERE id != $1
        AND (
          LOWER(username) LIKE LOWER($2)
          OR LOWER(email) LIKE LOWER($2)
        )
        ORDER BY username
        LIMIT 20
        `,
        [
          req.user.id,
          `%${q}%`
        ]
      );

      res.json({
        users: result.rows.map(user => ({
          id: user.id.toString(),
          username: user.username,
          email: user.email
        }))
      });

    } catch (error) {
      console.error("USER SEARCH ERROR:", error);

      res.status(500).json({
        error: "Chyba při hledání uživatelů."
      });
    }
  }
);

// =========================
// VYTVOŘENÍ / NALEZENÍ 1:1
// =========================

app.post(
  "/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      const otherUserId = Number(req.body.userId);

      if (!otherUserId) {
        return res.status(400).json({
          error: "Chybí uživatel chatu."
        });
      }

      if (otherUserId === Number(req.user.id)) {
        return res.status(400).json({
          error: "Nemůžeš vytvořit chat sám se sebou."
        });
      }

      const otherUser = await pool.query(
        `
        SELECT id, username, email
        FROM users
        WHERE id = $1
        `,
        [otherUserId]
      );

      if (otherUser.rows.length === 0) {
        return res.status(404).json({
          error: "Uživatel nebyl nalezen."
        });
      }

      const firstId = Math.min(
        Number(req.user.id),
        otherUserId
      );

      const secondId = Math.max(
        Number(req.user.id),
        otherUserId
      );

      const existing = await pool.query(
        `
        SELECT id
        FROM conversations
        WHERE user_one = $1
        AND user_two = $2
        `,
        [firstId, secondId]
      );

      let conversationId;

      if (existing.rows.length > 0) {
        conversationId = existing.rows[0].id;
      } else {
        const created = await pool.query(
          `
          INSERT INTO conversations
          (user_one, user_two, type)
          VALUES ($1, $2, 'private')
          RETURNING id
          `,
          [firstId, secondId]
        );

        conversationId = created.rows[0].id;
      }

      await pool.query(
        `
        INSERT INTO conversation_members
        (conversation_id, user_id)
        VALUES ($1, $2), ($1, $3)
        ON CONFLICT DO NOTHING
        `,
        [
          conversationId,
          firstId,
          secondId
        ]
      );

      res.json({
        conversation: {
          id: conversationId.toString(),
          type: "private",
          user: {
            id: otherUser.rows[0].id.toString(),
            username: otherUser.rows[0].username,
            email: otherUser.rows[0].email
          }
        }
      });

    } catch (error) {
      console.error("CONVERSATION ERROR:", error);

      res.status(500).json({
        error: "Chyba při vytváření chatu."
      });
    }
  }
);

// =========================
// VYTVOŘENÍ SKUPINY
// =========================

app.post(
  "/groups",
  authenticateToken,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const name = (req.body.name || "").trim();
      const memberIds = Array.isArray(req.body.memberIds)
        ? req.body.memberIds
        : [];

      if (!name) {
        return res.status(400).json({
          error: "Zadej název skupiny."
        });
      }

      if (name.length > 100) {
        return res.status(400).json({
          error: "Název skupiny je příliš dlouhý."
        });
      }

      const allMemberIds = [
        Number(req.user.id),
        ...memberIds
          .map(Number)
          .filter(id => id && id !== Number(req.user.id))
      ];

      const uniqueMemberIds = [
        ...new Set(allMemberIds)
      ];

      if (uniqueMemberIds.length < 2) {
        return res.status(400).json({
          error: "Skupina musí mít alespoň 2 členy."
        });
      }

      const usersResult = await pool.query(
        `
        SELECT id, username, email
        FROM users
        WHERE id = ANY($1::bigint[])
        `,
        [uniqueMemberIds]
      );

      if (
        usersResult.rows.length !==
        uniqueMemberIds.length
      ) {
        return res.status(400).json({
          error: "Některý z vybraných uživatelů neexistuje."
        });
      }

      await client.query("BEGIN");

      // Pro skupinu používáme user_one = zakladatel
      // a user_two = zakladatel, protože členové
      // jsou uloženi v conversation_members.
      const conversationResult = await client.query(
        `
        INSERT INTO conversations
        (user_one, user_two, type, name)
        VALUES ($1, $1, 'group', $2)
        RETURNING id, name
        `,
        [
          req.user.id,
          name
        ]
      );

      const conversation =
        conversationResult.rows[0];

      for (const memberId of uniqueMemberIds) {
        await client.query(
          `
          INSERT INTO conversation_members
          (conversation_id, user_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
          `,
          [
            conversation.id,
            memberId
          ]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        conversation: {
          id: conversation.id.toString(),
          type: "group",
          name: conversation.name,
          members: usersResult.rows.map(user => ({
            id: user.id.toString(),
            username: user.username,
            email: user.email
          }))
        }
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "CREATE GROUP ERROR:",
        error
      );

      res.status(500).json({
        error: "Chyba při vytváření skupiny."
      });

    } finally {
      client.release();
    }
  }
);

// =========================
// MOJE CHATY
// =========================

app.get(
  "/conversations",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          c.id,
          c.type,
          c.name,

          CASE
            WHEN c.type = 'private'
            THEN
              CASE
                WHEN c.user_one = $1
                THEN u2.id
                ELSE u1.id
              END
            ELSE NULL
          END AS other_id,

          CASE
            WHEN c.type = 'private'
            THEN
              CASE
                WHEN c.user_one = $1
                THEN u2.username
                ELSE u1.username
              END
            ELSE NULL
          END AS other_username

        FROM conversations c

        JOIN conversation_members cm
          ON cm.conversation_id = c.id

        LEFT JOIN users u1
          ON u1.id = c.user_one

        LEFT JOIN users u2
          ON u2.id = c.user_two

        WHERE cm.user_id = $1

        ORDER BY c.created_at DESC
        `,
        [req.user.id]
      );

      res.json({
        conversations: result.rows.map(chat => ({
          id: chat.id.toString(),
          type: chat.type,
          name: chat.name,

          user:
            chat.type === "private"
              ? {
                  id: chat.other_id.toString(),
                  username: chat.other_username
                }
              : null
        }))
      });

    } catch (error) {
      console.error(
        "CONVERSATIONS ERROR:",
        error
      );

      res.status(500).json({
        error: "Chyba při načítání chatů."
      });
    }
  }
);

// =========================
// DETAIL SKUPINY
// =========================

app.get(
  "/groups/:groupId",
  authenticateToken,
  async (req, res) => {
    try {
      const groupId = Number(
        req.params.groupId
      );

      const access = await pool.query(
        `
        SELECT c.id, c.name, c.type
        FROM conversations c
        JOIN conversation_members cm
          ON cm.conversation_id = c.id
        WHERE c.id = $1
        AND cm.user_id = $2
        AND c.type = 'group'
        `,
        [
          groupId,
          req.user.id
        ]
      );

      if (access.rows.length === 0) {
        return res.status(403).json({
          error: "K této skupině nemáš přístup."
        });
      }

      const members = await pool.query(
        `
        SELECT
          u.id,
          u.username,
          u.email
        FROM conversation_members cm
        JOIN users u
          ON u.id = cm.user_id
        WHERE cm.conversation_id = $1
        ORDER BY u.username
        `,
        [groupId]
      );

      res.json({
        group: {
          id: access.rows[0].id.toString(),
          name: access.rows[0].name,
          members: members.rows.map(user => ({
            id: user.id.toString(),
            username: user.username,
            email: user.email
          }))
        }
      });

    } catch (error) {
      console.error(
        "GROUP DETAIL ERROR:",
        error
      );

      res.status(500).json({
        error: "Chyba při načítání skupiny."
      });
    }
  }
);

// =========================
// ODESLÁNÍ ZPRÁVY
// =========================

app.post(
  "/conversations/:conversationId/messages",
  authenticateToken,
  async (req, res) => {
    try {
      const conversationId = Number(
        req.params.conversationId
      );

      const message =
        (req.body.message || "").trim();

      if (!message) {
        return res.status(400).json({
          error: "Zpráva nesmí být prázdná."
        });
      }

      const access = await pool.query(
        `
        SELECT c.id
        FROM conversations c
        JOIN conversation_members cm
          ON cm.conversation_id = c.id
        WHERE c.id = $1
        AND cm.user_id = $2
        `,
        [
          conversationId,
          req.user.id
        ]
      );

      if (access.rows.length === 0) {
        return res.status(403).json({
          error: "K tomuto chatu nemáš přístup."
        });
      }

      const result = await pool.query(
        `
        INSERT INTO messages
        (conversation_id, sender_id, message)
        VALUES ($1, $2, $3)
        RETURNING
          id,
          sender_id,
          message,
          created_at
        `,
        [
          conversationId,
          req.user.id,
          message
        ]
      );

      const newMessage = result.rows[0];

      res.status(201).json({
        message: {
          id: newMessage.id.toString(),
          senderId:
            newMessage.sender_id.toString(),
          message: newMessage.message,
          createdAt: newMessage.created_at
        }
      });

    } catch (error) {
      console.error(
        "SEND MESSAGE ERROR:",
        error
      );

      res.status(500).json({
        error: "Chyba při odesílání zprávy."
      });
    }
  }
);

// =========================
// NAČTENÍ ZPRÁV
// =========================

app.get(
  "/conversations/:conversationId/messages",
  authenticateToken,
  async (req, res) => {
    try {
      const conversationId = Number(
        req.params.conversationId
      );

      const access = await pool.query(
        `
        SELECT c.id
        FROM conversations c
        JOIN conversation_members cm
          ON cm.conversation_id = c.id
        WHERE c.id = $1
        AND cm.user_id = $2
        `,
        [
          conversationId,
          req.user.id
        ]
      );

      if (access.rows.length === 0) {
        return res.status(403).json({
          error: "K tomuto chatu nemáš přístup."
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          sender_id,
          message,
          created_at
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC, id ASC
        `,
        [conversationId]
      );

      res.json({
        messages: result.rows.map(msg => ({
          id: msg.id.toString(),
          senderId:
            msg.sender_id.toString(),
          message: msg.message,
          createdAt: msg.created_at
        }))
      });

    } catch (error) {
      console.error(
        "GET MESSAGES ERROR:",
        error
      );

      res.status(500).json({
        error: "Chyba při načítání zpráv."
      });
    }
  }
);

// =========================
// START SERVERU
// =========================

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
