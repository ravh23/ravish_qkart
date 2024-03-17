const httpStatus = require("http-status");
const { Cart, Product } = require("../models");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");

/**
 * Fetches cart for a user
 * - Fetch user's cart from Mongo
 * - If cart doesn't exist, throw ApiError
 * --- status code  - 404 NOT FOUND
 * --- message - "User does not have a cart"
 *
 * @param {User} user
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const getCartByUser = async (user) => {
  const cart = await Cart.findOne({ email: user.email });
  if (!cart) {
    throw new ApiError(httpStatus.NOT_FOUND, "User does not have a cart");
  }else{

    return cart;
  }
};

/**
 * Adds a new product to cart
 * - Get user's cart object using "Cart" model's findOne() method
 * --- If it doesn't exist, create one
 * --- If cart creation fails, throw ApiError with "500 Internal Server Error" status code
 *
 * - If product to add already in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product already in cart. Use the cart sidebar to update or remove product from cart"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - Otherwise, add product to user's cart
 *
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const addProductToCart = async (user, productId, quantity) => {
  let cart = await Cart.findOne({ email: user.email });
  const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product doesn't exist in database"
    );
  }
  if (!cart) {
    cart = await Cart.create({ email: user.email, cartItems: [] });
  }
  if (!cart) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Cart creation failed due to internal server error"
    );
  }
  const existIndex = cart.cartItems.findIndex((item) => {
    return item.product._id == productId;
  });
  if (existIndex !== -1) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product already in the cart. Use the cart sidebar to update or remove product from cart"
    );
  }
  cart.cartItems.push({ product: product, quantity });

  await cart.save();
  return cart;
};

/**
 * Updates the quantity of an already existing product in cart
 * - Get user's cart object using "Cart" model's findOne() method
 * - If cart doesn't exist, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart. Use POST to create cart and add a product"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * - Otherwise, update the product's quantity in user's cart to the new quantity provided and return the cart object
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const updateProductInCart = async (user, productId, quantity) => {
  let cart = await Cart.findOne({email:user.email});
  if (!cart) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User does not have a cart. Use POST to create cart and add a product "
      );
    }
    const product = await Product.findById(productId);
  if (!product) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product doesn't exist in database"
    );
  }

  const existingCartItem = cart.cartItems.find(
    (item) => item.product._id == productId
  );
  if (!existingCartItem) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product not in cart");
  }

  // if (quantity === 0) {
  //   cart.cartItems = cart.cartItems.filter(
  //     (item) => !item.product.equals(productId)
  //   );
  // } else {
    existingCartItem.quantity = quantity;
  // }

  await cart.save();
  return cart;
};

/**
 * Deletes an already existing product in cart
 * - If cart doesn't exist for user, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * Otherwise, remove the product from user's cart
 *
 *
 * @param {User} user
 * @param {string} productId
 * @throws {ApiError}
 */
const deleteProductFromCart = async (user, productId) => {
  // let cart = await getCartByUser(user);
  let cart = await Cart.findOne({ email: user.email });

  if (!cart) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User does not have a cart ");
  }
  const existingCartItemIndex = cart.cartItems.findIndex(
    (item) => item.product._id == productId
  );

  if (existingCartItemIndex === -1) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product not in cart");
  }

  cart.cartItems.splice(existingCartItemIndex, 1);
  await cart.save();
};

// TODO: CRIO_TASK_MODULE_TEST - Implement checkout function
/**
 * Checkout a users cart.
 * On success, users cart must have no products.
 *
 * @param {User} user
 * @returns {Promise}
 * @throws {ApiError} when cart is invalid
 */
const checkout = async (user) => {
  let cart = await Cart.findOne({ email: user.email });
  if (!cart) {
    throw new ApiError(httpStatus.NOT_FOUND, "User has no Cart");
  } 
  if (cart.cartItems.length == 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Cart has no items");
  } 
  let flag=await user.hasSetNonDefaultAddress();
  if (user.address===config.default_address) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User address is not set");
  } 
  let totalCost=0;
  cart.cartItems.forEach(item=>totalCost+=item.product.cost*item.quantity)
   if (totalCost> user.walletMoney) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient balance");
  }
  
  cart.cartItems = [];
  await cart.save();
  user.walletMoney-=totalCost;
  await user.save();
};

module.exports = {
  getCartByUser,
  addProductToCart,
  updateProductInCart,
  deleteProductFromCart,
  checkout,
};
