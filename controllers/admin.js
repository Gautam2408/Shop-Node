const { validationResult } = require("express-validator");
const Product = require("../models/product");
const errorFn = require("../util/error");
const deleteFile = require("../util/fileDelete");

exports.getAddProduct = (req, res, next) => {
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "/admin/add-product",
    editing: false,
    hasError: false,
    errorMessage: undefined,
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  console.log("/in");
  const inputTitle = req.body.title;
  const inputImg = req.file;
  const inputPrice = req.body.price;
  const inputDesc = req.body.desc;
  const inputUserId = req.user._id;
  const errors = validationResult(req);

  if (!inputImg) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      errorMessage: "No Image is uploaded",
      validationErrors: [],
      prod: {
        title: inputTitle,
        price: inputPrice,
        desc: inputDesc,
      },
    });
  }

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Add Product",
      path: "/admin/add-product",
      editing: false,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      prod: {
        title: inputTitle,
        price: inputPrice,
        desc: inputDesc,
      },
    });
  }

  const inputImgUrl = inputImg.path;

  const product = new Product({
    title: inputTitle,
    imgUrl: inputImgUrl,
    price: inputPrice,
    desc: inputDesc,
    userId: inputUserId,
  });
  product
    .save()
    .then((result) => {
      console.log("product created");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getProducts = (req, res, next) => {
  // Populate allows you to tell mongoose to populate a certain field
  // with all the detail information and not just the ID
  // Select will show only those properties that are mentioned
  Product.find({ userId: req.user._id })
    // .select("title price")
    // .populate("userId", "name -_id")
    .then((products) => {
      // console.log(products);
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getEditProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      return res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        prod: product,
        editing: req.query.edit === "true",
        hasError: false,
        errorMessage: undefined,
        validationErrors: [],
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.postEditProduct = (req, res, next) => {
  const id = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedImg = req.file;
  const updatedPrice = req.body.price;
  const updatedDesc = req.body.desc;
  const errors = validationResult(req);

  // we don't need to check wether there is updated img or not because
  // if we don't have updated image then we are setting it to the old one

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      pageTitle: "Edit Product",
      path: "/admin/edit-product",
      editing: true,
      hasError: true,
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      prod: {
        title: updatedTitle,
        price: updatedPrice,
        desc: updatedDesc,
        _id: id,
      },
    });
  }

  Product.findById(id)
    .then((product) => {
      if (product.userId.toString() !== req.user._id.toString()) {
        req.flash("error", "Can't delete product that you haven't created");
        return res.redirect("/");
      }

      product.title = updatedTitle;
      product.price = updatedPrice;
      product.desc = updatedDesc;

      // if we have an updated img then only we are updating its path
      if (updatedImg) {
        // delete saved image
        deleteFile(product.imgUrl);
        product.imgUrl = updatedImg.path;
      }

      return product
        .save()
        .then(() => {
          console.log("Product Updated");
          res.redirect("/admin/products");
        })
        .catch((err) => {
          throw err;
        });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.postDeleteProduct = (req, res, next) => {
  const id = req.body.productId;
  Product.findOne({ userId: req.user._id, _id: id })
    .then((product) => {
      if (!product) {
        req.flash("error", "Can't delete product that you haven't created");
        return res.redirect("/");
      }

      // delete saved image
      deleteFile(product.imgUrl);

      return req.user
        .deleteCartProd(id, product.price)
        .then((result) => {
          return Product.findByIdAndDelete(id);
        })
        .then((result) => {
          console.log("Product Deleted");
          res.redirect("/admin/products");
        })
        .catch((err) => {
          throw err;
        });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};
