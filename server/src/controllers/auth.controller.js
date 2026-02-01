const bcrypt = require("bcrypt");
const pool = require("../config/db");
const jwt = require("jsonwebtoken");

/**
 * REGISTER
 * - validates role from DB (roles table)
 * - creates user
 * - assigns role via user_roles table
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1️⃣ Check role exists in DB
    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE name = $1",
      [role]
    );

    if (roleResult.rows.length === 0) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const roleId = roleResult.rows[0].id;

    // 2️⃣ Check email uniqueness
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ Create user
    const userResult = await pool.query(
      `
      INSERT INTO users (name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, name, email
      `,
      [name, email, hashedPassword]
    );

    const userId = userResult.rows[0].id;

    // 5️⃣ Assign role
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

/**
 * LOGIN
 * - fetches role from DB
 * - embeds role in JWT
 */
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

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

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

module.exports = { register, login };
