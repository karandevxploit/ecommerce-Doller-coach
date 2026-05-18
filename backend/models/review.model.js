const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

module.exports = createMysqlDocumentModel("Review", {
  statics: {
    async toggleLike(reviewId, userId) {
      const review = await this.findById(reviewId);
      if (!review) return null;
      review.likedBy = Array.isArray(review.likedBy) ? review.likedBy : [];
      const exists = review.likedBy.some((id) => String(id) === String(userId));
      review.likedBy = exists ? review.likedBy.filter((id) => String(id) !== String(userId)) : [...review.likedBy, userId];
      review.likesCount = review.likedBy.length;
      await review.save();
      return review;
    },
    async toggleHelpful(reviewId, userId) {
      const review = await this.findById(reviewId);
      if (!review) return null;
      review.helpfulBy = Array.isArray(review.helpfulBy) ? review.helpfulBy : [];
      const exists = review.helpfulBy.some((id) => String(id) === String(userId));
      review.helpfulBy = exists ? review.helpfulBy.filter((id) => String(id) !== String(userId)) : [...review.helpfulBy, userId];
      review.helpfulCount = review.helpfulBy.length;
      await review.save();
      return review;
    },
  },
});
