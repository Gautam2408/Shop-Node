const express = require("express");
const { check, body } = require("express-validator");
const adminController = require("../controllers/admin");
const isAuth = require("../middleware/is-auth");

const router = express.Router();

// /admin/add-product => GET
router.get("/add-product", isAuth, adminController.getAddProduct);

// /admin/add-product => POST
router.post(
  "/add-product",
  isAuth,
  [
    body("title", "Title must be alphanumeric with atleast 3 chars")
      .isString()
      .isLength({ min: 3 })
      .trim(),
    body("price", "Price must be float").isFloat(),
    body("desc", "Description should be between 200 and 5 chars")
      .isLength({ min: 5, max: 200 })
      .trim(),
  ],
  adminController.postAddProduct
);

// /admin/edit-product => GET
router.get("/edit-product/:productId", isAuth, adminController.getEditProduct);

// /admin/edit-product => POST
router.post(
  "/edit-product",
  isAuth,
  [
    body("title", "Title must be alphanumeric with atleast 3 chars")
      .isString()
      .isLength({ min: 3 })
      .trim(),
    body("price", "Price must be float").isFloat(),
    body("desc", "Description should be between 200 and 5 chars")
      .isLength({ min: 5, max: 200 })
      .trim(),
  ],
  adminController.postEditProduct
);

// /admin/products => GET
router.get("/products", isAuth, adminController.getProducts);

router.post("/delete-product", isAuth, adminController.postDeleteProduct);

module.exports = router;
