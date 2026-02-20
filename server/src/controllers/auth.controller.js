const bcrypt = require("bcrypt");
const pool = require("../config/db");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_DAYS = 7;
const REFRESH_COOKIE_NAME = "refresh_token";

const cookieBaseOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth",
};

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createRefreshToken = () => crypto.randomBytes(64).toString("hex");

const getRefreshTokenFromCookie = (req) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${REFRESH_COOKIE_NAME}=`)) {
      return decodeURIComponent(cookie.substring(REFRESH_COOKIE_NAME.length + 1));
    }
  }

  return null;
};

const issueSession = async (res, user) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    `
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [user.id, refreshTokenHash, expiresAt]
  );

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieBaseOptions,
    expires: expiresAt,
  });

  return accessToken;
};

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = $1",
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const roleId = roleResult.rows[0].id;
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, email
      `,
      [name, email, hashedPassword]
    );

    const userId = userResult.rows[0].id;

    await pool.query(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES ($1, $2)
      `,
      [userId, roleId]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: userId,
        name,
        email,
        role,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
      SELECT u.id, u.name, u.email, u.password, r.name AS role
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = await issueSession(res, user);

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromCookie(req);

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not provided" });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const tokenResult = await pool.query(
      `
      SELECT id, user_id, expires_at, revoked_at
      FROM refresh_tokens
      WHERE token_hash = $1
      `,
      [refreshTokenHash]
    );

    if (tokenResult.rowCount === 0) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenRow = tokenResult.rows[0];
    const now = new Date();

    if (tokenRow.revoked_at || new Date(tokenRow.expires_at) <= now) {
      return res.status(401).json({ message: "Refresh token expired or revoked" });
    }

    const userResult = await pool.query(
      `
      SELECT u.id, u.name, u.email, r.name AS role
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
      `,
      [tokenRow.user_id]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    await pool.query(
      `
      UPDATE refresh_tokens
      SET revoked_at = NOW()
      WHERE id = $1
      `,
      [tokenRow.id]
    );

    const accessToken = await issueSession(res, user);

    return res.json({
      message: "Token refreshed",
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("REFRESH ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const logout = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromCookie(req);

    if (refreshToken) {
      const refreshTokenHash = hashRefreshToken(refreshToken);
      await pool.query(
        `
        UPDATE refresh_tokens
        SET revoked_at = NOW()
        WHERE token_hash = $1 AND revoked_at IS NULL
        `,
        [refreshTokenHash]
      );
    }

    res.clearCookie(REFRESH_COOKIE_NAME, cookieBaseOptions);
    return res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login, refresh, logout };
