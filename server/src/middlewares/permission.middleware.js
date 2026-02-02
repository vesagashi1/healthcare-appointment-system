const pool = require("../config/db");

const hasPermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          message: "Unauthorized: user not authenticated",
        });
      }

      const userId = req.user.id;

      const result = await pool.query(
        `
        SELECT DISTINCT p.name
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
        `,
        [userId]
      );

      const permissions = result.rows.map((row) => row.name);

      console.log("User permissions:", permissions);

      if (!permissions.includes(permissionName)) {
        return res.status(403).json({
          message: `Forbidden: missing permission ${permissionName}`,
        });
      }

      next();
    } catch (error) {
      console.error("Permission middleware error:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
};

module.exports = hasPermission;
