const jwt = require("jsonwebtoken");
const { redisClient } = require("../config/redis");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization").replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    // First, check if token is stored in Redis cache
    const cachedUser = await redisClient.get(`auth_${token}`);

    if (cachedUser) {
      // If found in cache, use it
      req.user = JSON.parse(cachedUser);
      req.token = token;
      return next();
    }

    // If not in cache, verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Store in Redis for future quick auth checks
    // TTL should match JWT expiration time
    const expirationInSeconds = 24 * 60 * 60; // 1 day in seconds
    await redisClient.set(
      `auth_${token}`,
      JSON.stringify({ id: user._id, email: user.email, name: user.name }),
      {
        EX: expirationInSeconds,
      }
    );

    // Set user in request
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
    };
    req.token = token;

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    res.status(500).json({ message: "Server Error" });
  }
};

module.exports = auth;
