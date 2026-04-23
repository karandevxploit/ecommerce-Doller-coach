import toast from "react-hot-toast";

/**
 * resumePendingAction
 * 
 * Safely executes a stored action after login/registration.
 * @param {Object} stores - { cartStore, wishlistStore, navigate }
 */
export const resumePendingAction = async ({ cartStore, wishlistStore, navigate }) => {
  const pendingStr = localStorage.getItem("pendingAction");
  if (!pendingStr) return false;

  try {
    const { type, payload } = JSON.parse(pendingStr);
    localStorage.removeItem("pendingAction");

    if (type === "ADD_TO_CART") {
      await cartStore.addToCart(
        payload.productId, 
        1, 
        payload.size, 
        null, 
        null, 
        payload.color, 
        payload.variantIdx
      );
      toast.success("Resumed: Item added to cart");
    }

    if (type === "WISHLIST") {
      await wishlistStore.toggleWishlist(payload.productId);
      toast.success("Resumed: Added to wishlist");
    }

    if (type === "BUY_NOW") {
      navigate(`/product/${payload.productId}?buynow=true`);
      return true; // Buy now logic might prevent the default redirect
    }
  } catch (err) {
    console.error("Failed to resume pending action:", err);
  }

  return false;
};
