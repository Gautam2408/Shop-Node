require("dotenv").config();
const fs = require("fs");
const PdfDocument = require("pdfkit");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const Product = require("../models/product");
const Orders = require("../models/orders");
const errorFn = require("../util/error");
const path = require("path");

const ITEMS_PER_PAGE = 1;

exports.getProducts = (req, res, next) => {
  const pageNo = +req.query.page || 1;
  let totalItems;
  Product.find()
    .countDocuments()
    .then((numOfProducts) => {
      totalItems = numOfProducts;
      return Product.find()
        .skip((pageNo - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      const msgArr = req.flash("error");
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "All Products",
        path: "/products",
        errorMessage: msgArr.length > 0 ? msgArr[0] : null,
        paginationInfo: {
          currPage: pageNo,
          hasNextPage: ITEMS_PER_PAGE * pageNo < totalItems,
          hasPrevPage: pageNo > 1,
          nextPage: pageNo + 1,
          prevPage: pageNo - 1,
          lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        },
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        prod: product,
        pageTitle: product.title,
        path: null,
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getIndex = (req, res, next) => {
  const pageNo = +req.query.page || 1;
  let totalItems;
  Product.find()
    .countDocuments()
    .then((numOfProducts) => {
      totalItems = numOfProducts;
      return Product.find()
        .skip((pageNo - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      const msgArr = req.flash("error");
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        errorMessage: msgArr.length > 0 ? msgArr[0] : null,
        paginationInfo: {
          currPage: pageNo,
          hasNextPage: ITEMS_PER_PAGE * pageNo < totalItems,
          hasPrevPage: pageNo > 1,
          nextPage: pageNo + 1,
          prevPage: pageNo - 1,
          lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
        },
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getCart = (req, res, next) => {
  // populate will just expand prodId which was having id to whole product details
  req.user
    .populate("cart.items.prodId")
    .then((user) => {
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        prods: user.cart.items,
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      console.log("Added to Cart");
      res.redirect("/cart");
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.cartDeleteProduct = (req, res, next) => {
  const id = req.body.productId;
  Product.findById(id)
    .then((product) => {
      return req.user.deleteCartProd(id, +product.price);
    })
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getCheckout = (req, res, next) => {
  // populate will just expand prodId which was having id to whole product details
  let prods;
  let totalPrice;
  req.user
    .populate("cart.items.prodId")
    .then((user) => {
      prods = user.cart.items;
      totalPrice = user.cart.totalPrice;
      console.log(prods);
      return stripe.checkout.sessions.create({
        line_items: prods.map((p) => ({
          price_data: {
            currency: "INR",
            product_data: { name: p.prodId.title, description: p.prodId.desc },
            unit_amount: p.prodId.price * 100,
          },
          quantity: p.qty,
        })),
        mode: "payment",
        success_url:
          req.protocol + "://" + req.get("host") + "/checkout/success",
        cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        prods: prods,
        totalPrice: totalPrice,
        sessionId: session.id,
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getOrders = (req, res, next) => {
  // Revise lec: 174
  Orders.find({ "user.userId": req.user._id })
    .then((orders) => {
      // console.log(orders);
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.postOrders = (req, res, next) => {
  req.user
    .populate("cart.items.prodId")
    .then((user) => {
      const items = user.cart.items.map((i) => {
        return {
          prodDetails: { ...i.prodId._doc },
          qty: i.qty,
        };
      });

      const orders = new Orders({
        user: {
          name: req.user.name,
          userId: req.user,
        },
        totalPrice: user.cart.totalPrice,
        items: items,
      });

      return orders.save();
    })
    .then((result) => {
      req.user.cart = { items: [], totalPrice: 0 };
      req.user.save();
    })
    .then((result) => {
      console.log("Order Created");
      res.redirect("/orders");
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;

  Orders.findById(orderId)
    .then((order) => {
      if (!order) {
        throw "No order with that id";
      }

      if (order.user.userId.toString() !== req.user._id.toString()) {
        throw "Unauthorized user";
      }

      // by doing this we are only allowing to order the user who has added these items to his cart
      // that must be the currently login user
      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      // we can also improve the way we are serving that file because right now, I'm simply reading that file
      // and once I read it, I return it. Now for small files this is probably fine, if you read a file like
      // this, node will first of all access that file, read the entire content into memory and then return it
      // with the response. This means that for bigger files, this will take very long before a response is sent
      // and your memory on the server might actually overflow at some point for many incoming requests because
      // it has to read all the data into memory which of course is limited. So reading file data into memory to
      // serve it as a response is not really a good practice, for tiny files it might be ok but for bigger files,
      // it certainly is not,instead you should be streaming your response data and that is what I will do now.

      // fs.readFile(pathName, (err, fileContent) => {
      //   if (err) {
      //     return errorFn(err, next);
      //   }
      //   res.setHeader("Content-Type", "application/pdf");
      //   res.setHeader(
      //     "Content-Disposition",
      //     'inline; filename="' + invoiceName + '"'
      //   );
      //   res.send(fileContent);
      // });

      // now I have to read readStream and node will be able to use that to read
      // content in the file step by step in different chunks.
      // const file = fs.createReadStream(invoicePath);

      const pdfDoc = new PdfDocument();

      pdfDoc.pipe(fs.createWriteStream(invoicePath));

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoiceName + '"'
      );

      // I will use that file read stream and call the pipe method to forward the data that is read in
      // with that stream to my response because the response object is a writable stream actually and
      // you can use readable streams to pipe their output into a writable stream. Now the response will
      // be streamed to the browser and will contain the data and the data will basically be downloaded
      // by the browser step by step and for large files, this is a huge advantage because node never has
      // to pre-load all the data into memory but just streams it to the client on the fly and the most it
      // has to store is one chunk of data. The chunks are what we work with, the buffers basically gives us
      // access to these chunks and here we don't wait for all the chunks to come together and concatenate
      // them into one object, instead we forward them to the browser which then is also able to concatenate
      // the incoming data pieces into the final file.
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text("Invoice", { underline: true });
      pdfDoc.text("--------------------------------");

      order.items.forEach((item) => {
        pdfDoc
          .fontSize(14)
          .text(
            item.prodDetails.title +
              " - " +
              item.qty +
              " x " +
              "$" +
              item.prodDetails.price
          );
      });

      pdfDoc.text("--------------------------------");
      pdfDoc.text("Total Price: $" + order.totalPrice);

      pdfDoc.end();
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

// exports.getCheckout = (req, res, next) => {
//   res.render("shop/checkout", {
//     path: "/checkout",
//     pageTitle: "Checkout",
//   });
// };
