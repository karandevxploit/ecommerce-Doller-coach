const router = require("express").Router();
const mongoose = require("mongoose");
const { getAddress, saveAddress, deleteAddress } = require("../controllers/address.controller");
const { protect } = require("../middlewares/auth.middleware");
const { safeHandler } = require("../middlewares/error.middleware");

router.use(protect);

const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  if (id && !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json({ success: false, data: null, message: "Invalid address ID" });
  }
  return next();
};

router.get("/", safeHandler(getAddress));
router.post("/", safeHandler(saveAddress));
router.delete("/:id", validateObjectId, safeHandler(deleteAddress));

module.exports = router;
