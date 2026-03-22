const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");


// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    console.log("REGISTER API HIT", req.body);

    // check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json("User already exists");
    }

    // hash password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // create new user
    const newUser = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
    });

    const savedUser = await newUser.save();

    res.status(200).json({
      _id: savedUser._id,
      username: savedUser.username,
      email: savedUser.email,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json("Server error");
  }
});


// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    console.log("LOGIN API HIT", req.body);

    // find user FIRST
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json("User not found");
    }

    console.log("USER FROM DB:", user);
    console.log("INPUT PASSWORD:", req.body.password);
    console.log("DB PASSWORD:", user.password);

    // check password
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );

    console.log("PASSWORD MATCH:", validPassword);

    if (!validPassword) {
      return res.status(400).json("Wrong password");
    }

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json("Server error");
  }
});

module.exports = router;