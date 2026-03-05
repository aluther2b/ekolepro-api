// src/middlewares/scope.middleware.js
export function withScope() {
  return (req, res, next) => {
    const user = req.user; // Note: utiliser req.user, pas req.authUser

    if (!user) {
      return res.status(401).json({ error: "unauthorized" });
    }

    if (user.role === "admin") {
      req.scope = { level: "national" };
      return next();
    }

    if (user.role === "drena") {
      req.scope = {
        level: "drena",
        drena_id: user.drena_id,
      };
      return next();
    }

    if (user.role === "iepp") {
      req.scope = {
        level: "iepp",
        iepp_id: user.iepp_id,
        drena_id: user.drena_id,
      };
      return next();
    }

    return res.status(403).json({ error: "invalid_role" });
  };
}
