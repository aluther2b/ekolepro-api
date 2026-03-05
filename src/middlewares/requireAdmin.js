//src/middlewares/requireAdmin.js
export function requireAdmin(req, res, next) {
  const role = req.user?.role;

  if (!["admin", "drena", "iepp"].includes(role)) {
    return res.status(403).json({ error: "admin_only" });
  }

  next();
}

