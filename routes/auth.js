const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { getRedisClient } = require("../config/redis"); // Updated import
const {
  validateRequest,
  registerValidation,
  loginValidation,
} = require("../middleware/validate");

const router = express.Router();

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post(
  "/register",
  registerValidation,
  validateRequest,
  async (req, res) => {
    const { name, email, password } = req.body;

    try {
      // Check if user already exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create new user
      user = new User({
        name,
        email,
        password,
      });

      // Save user to database
      await user.save();

      // Create JWT payload
      const payload = {
        id: user.id,
      };

      // Sign token
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRATION,
      });

      // Save user session in Redis
      const userData = {
        id: user._id,
        email: user.email,
        name: user.name,
      };

      // Get connected Redis client
      const redisClient = await getRedisClient();

      // Set session data in Redis
      await redisClient.set(`auth_${token}`, JSON.stringify(userData), {
        EX: 86400, // 24 hours in seconds
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", loginValidation, validateRequest, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT payload
    const payload = {
      id: user.id,
    };

    // Sign token
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRATION,
    });

    // Save user session in Redis
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
    };

    // Get connected Redis client
    const redisClient = await getRedisClient();

    // Set session data in Redis
    await redisClient.set(`auth_${token}`, JSON.stringify(userData), {
      EX: 86400, // 24 hours in seconds
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get("/user", auth, async (req, res) => {
  try {
    // user is already available in req from auth middleware
    res.json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   POST api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", auth, async (req, res) => {
  try {
    // Get connected Redis client
    const redisClient = await getRedisClient();

    // Remove token from Redis
    await redisClient.del(`auth_${req.token}`);

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;