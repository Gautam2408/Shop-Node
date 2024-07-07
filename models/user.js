// const { getDb } = require("../util/database");
// const mongodb = require("mongodb");
// const Product = require("./product");

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
  },

  password: {
    type: String,
    required: true,
  },

  resetToken: String,

  resetTokenExpiration: Date,

  cart: {
    items: [
      {
        prodId: {
          type: mongoose.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: { type: Number, required: true },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
    },
  },
});

userSchema.methods.addToCart = function (product) {
  let updatedCart; // {items:[], totalPrice}
  if (this.cart.items.length > 0) {
    updatedCart = { ...this.cart };
    // cart is already
    const cartProdIdx = this.cart.items.findIndex(
      (cp) => cp.prodId.toString() === product._id.toString()
    );

    if (cartProdIdx >= 0) {
      // if product is already present in the cart

      const updatedProd = {
        ...this.cart.items[cartProdIdx],
        prodId: this.cart.items[cartProdIdx].prodId,
        qty: this.cart.items[cartProdIdx].qty + 1,
      };
      console.log(updatedProd);
      updatedCart.items[cartProdIdx] = updatedProd;
    } else {
      // product is not present in the cart

      updatedCart.items = [
        ...updatedCart.items,
        { prodId: product._id, qty: 1 },
      ];
    }
    updatedCart.totalPrice += +product.price;
  } else {
    // if no cart

    updatedCart = {
      items: [{ prodId: product._id, qty: 1 }],
      totalPrice: +product.price,
    };
  }

  // update in db
  this.cart = updatedCart;

  // mongoose method which saves the curr obj
  return this.save();
};

userSchema.methods.deleteCartProd = function (prodId, prodPrice) {
  const prodToDelIdx = this.cart.items.findIndex(
    (i) => i.prodId.toString() === prodId
  );

  if (prodToDelIdx < 0) {
    return Promise.resolve();
  }
  const prodToDel = this.cart.items[prodToDelIdx];

  const updatedItems = this.cart.items.toSpliced(prodToDelIdx, 1);

  const updatedCart = {
    items: updatedItems,
    totalPrice: this.cart.totalPrice - prodPrice * prodToDel.qty,
  };

  this.cart = updatedCart;
  return this.save();
};

module.exports = mongoose.model("User", userSchema);

// class User {
//   constructor(username, email, cart, id) {
//     this.name = username;
//     this.email = email;
//     this.cart = cart;
//     this._id = new mongodb.ObjectId(id);
//   }

//   save() {
//     const db = getDb();
//     return db.collection("users").insertOne(this);
//     // .then((result) => {
//     //   console.log("user created");
//     //   console.log(result);
//     // })
//     // .catch((err) => {
//     //   console.error(err);
//     // });
//   }

//   static findById(userId) {
//     const db = getDb();
//     return db
//       .collection("users")
//       .findOne({ _id: new mongodb.ObjectId(userId) });

//     // .then((result) => {
//     //   console.log(result);
//     // })
//     // .catch((err) => {
//     //   console.error(err);
//     // });
//   }

//   addToCart(product) {
//     const db = getDb();
//     let updatedCart; // {items:[], totalPrice}
//     if (this.cart) {
//       updatedCart = { ...this.cart };
//       // cart is already
//       const cartProdIdx = this.cart.items.findIndex(
//         (cp) => cp.prodId.toString() === product._id.toString()
//       );

//       if (cartProdIdx >= 0) {
//         // if product is already present in the cart
//         const updatedProd = {
//           ...this.cart.items[cartProdIdx],
//           qty: this.cart.items[cartProdIdx].qty + 1,
//         };

//         updatedCart.items[cartProdIdx] = updatedProd;
//       } else {
//         // product is not present in the cart
//         updatedCart.items = [
//           ...updatedCart.items,
//           { prodId: product._id, qty: 1 },
//         ];
//       }
//       updatedCart.totalPrice += +product.price;
//     } else {
//       // if no cart
//       updatedCart = {
//         items: [{ prodId: product._id, qty: 1 }],
//         totalPrice: +product.price,
//       };
//     }

//     // update in db
//     db.collection("users").updateOne(
//       { _id: this._id },
//       { $set: { cart: updatedCart } }
//     );
//   }

//   fetchCartProducts() {
//     if (this.cart.items) {
//       const prodIds = this.cart.items.map((cp) => cp.prodId);
//       console.log("a111");
//       const db = getDb();
//       return db
//         .collection("products")
//         .find({ _id: { $in: prodIds } })
//         .toArray()
//         .then((products) => {
//           return products.map((prod) => {
//             return {
//               ...prod,
//               qty: this.cart.items.find((i) => {
//                 return i.prodId.toString() === prod._id.toString();
//               }).qty,
//             };
//           });
//         })
//         .catch((err) => {
//           console.log(err);
//         });
//     } else {
//       return Promise.resolve([]);
//     }
//   }

//   postOrder() {
//     const db = getDb();
//     return this.fetchCartProducts()
//       .then((products) => {
//         const order = {
//           items: products,
//           user: {
//             _id: this._id,
//             name: this.name,
//           },
//           totalPrice: products.reduce(
//             (total, prod) => total + prod.qty * +prod.price,
//             0
//           ),
//         };
//         return db.collection("orders").insertOne(order);
//       })
//       .then((result) => {
//         const updatedCart = { items: [], totalPrice: 0 };
//         return db
//           .collection("users")
//           .updateOne({ _id: this._id }, { $set: { cart: updatedCart } });
//       })
//       .catch((err) => {
//         console.log(err);
//       });
//   }

//   fetchOrders() {
//     const db = getDb();
//     return db.collection("orders").find().toArray();
//   }
// }

// module.exports = User;
