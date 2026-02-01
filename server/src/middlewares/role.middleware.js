const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({
        message: "Forbidden: insufficient permissions",
      });
    }
    next();
  };
};

module.exports = requireRole;
