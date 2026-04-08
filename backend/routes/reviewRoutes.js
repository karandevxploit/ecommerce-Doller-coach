const express = require("express");
const router = express.Router();

router.get("/admin/list", (req, res) => {
  res.status(200).json({
    success: true,
    reviews: []
  });
});

module.exports = router;
