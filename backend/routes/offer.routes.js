const router = require("express").Router();
const { protect, authorize } = require("../middlewares/auth.middleware");
const { getActiveOffers, createOffer, updateOffer, deleteOffer } = require("../controllers/offer.controller");

router.get("/", getActiveOffers);
router.post("/", protect, authorize("admin"), createOffer);
router.put("/:id", protect, authorize("admin"), updateOffer);
router.delete("/:id", protect, authorize("admin"), deleteOffer);

module.exports = router;

