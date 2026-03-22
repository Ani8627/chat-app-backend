const router = require("express").Router();
const multer = require("multer");

// storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// upload route
router.post("/", upload.single("file"), (req, res) => {
  res.status(200).json({
    file: req.file.filename,
  });
});

module.exports = router;