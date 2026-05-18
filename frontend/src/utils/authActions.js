import toast from "react-hot-toast";

/**
 * resumePendingAction
 *
 * Safely executes a stored action after login/registration.
 * @param {Object} stores - { cartStore, wishlistStore, navigate }
 */
export const resumePendingAction = async ({
  cartStore,
  wishlistStore,
  navigate,
} = {}) => {
  let pendingAction = null;

  try {
    const pendingStr = localStorage.getItem("pendingAction");
    if (!pendingStr) return false;

    pendingAction = JSON.parse(pendingStr);
    localStorage.removeItem("pendingAction");
  } catch {
    localStorage.removeItem("pendingAction");
    return false;
  }

  const { type, payload = {}, path, createdAt } = pendingAction || {};

  // Expire pending action after 30 minutes
  if (createdAt && Date.now() - Number(createdAt) > 30 * 60 * 1000) {
    return false;
  }

  const productId = payload.productId || payload.id || payload._id;

  if (!type || !productId) {
    return false;
  }

  try {
    if (type === "ADD_TO_CART") {
      if (typeof cartStore?.addToCart !== "function") return false;

      await cartStore.addToCart(
        productId,
        payload.quantity || 1,
        payload.size || "",
        payload.topSize || null,
        payload.bottomSize || null,
        payload.color || "",
        payload.variantIdx
      );

      toast.success("Item added to cart");
      return false;
    }

    if (type === "WISHLIST") {
      if (typeof wishlistStore?.toggleWishlist !== "function") return false;

      await wishlistStore.toggleWishlist(productId);
      toast.success("Wishlist updated");
      return false;
    }

    if (type === "BUY_NOW") {
      if (typeof navigate !== "function") return false;

      navigate(`/product/${productId}?buynow=true`, {
        replace: true,
        state: {
          resumedAction: true,
          from: path || "/",
        },
      });

      return true;
    }
  } catch (err) {
    toast.error(
      err?.response?.data?.message ||
      err?.message ||
      "Could not resume your previous action"
    );
  }

  return false;
};

export default resumePendingAction;
