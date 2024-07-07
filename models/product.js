// Model
const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const productSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  imgUrl: {
    type: String,
    required: true,
  },
  desc: {
    type: String,
    required: true,
  },
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

// a model basically is important for mongoose behind the scenes
// to connect a schema, a blueprint with a name basically

module.exports = mongoose.model("Product", productSchema);

// const mongodb = require("mongodb");
// const getDb = require("../util/database").getDb;

// class Product {
//   constructor(id, title, imgUrl, price, desc, userId) {
//     this._id = id ? new mongodb.ObjectId(id) : null;
//     this.title = title;
//     this.imgUrl = imgUrl;
//     this.price = price;
//     this.desc = desc;
//     this.userId = userId;
//   }

//   save() {
//     const db = getDb();
//     if (this._id) {
//       // update product
//       return db
//         .collection("products")
//         .updateOne({ _id: this._id }, { $set: this });
//     }
//     return db.collection("products").insertOne(this);
//   }

//   static fetchAll() {
//     const db = getDb();
//     // find does not immediately return a promise though, instead it returns a so-called cursor. A cursor
//     // is an object provided by mongodb which allows us to go through our elements, our documents step by
//     // step because theoretically in a collection, find could of course return millions of documents and
//     // you don't want to transfer them over the wire all at once. So instead find gives you a handle which
//     // you can use to tell mongodb ok give me the next document, ok give me the next document and so on.
//     // That being said, there is a toArray method you can execute tell mongodb to get all documents and turn
//     // them into a javascript array but you should only use that if you know that we're talking about let's
//     // say a couple of dozens or maybe one hundred documents otherwise it's better to implement pagination
//     return db.collection("products").find().toArray();
//   }

//   static findById(prodId) {
//     // find will give me a cursor because mongodb doesn't know that I will only get one and here we can use next,
//     // the next function to get the next and in this case here also the last document that was returned by find
//     const db = getDb();
//     return db
//       .collection("products")
//       .find({ _id: new mongodb.BSON.ObjectId(prodId) })
//       .next();
//   }

//   static deleteById(prodId) {
//     const db = getDb();
//     return db
//       .collection("products")
//       .deleteOne({ _id: new mongodb.ObjectId(prodId) })
//       .then((result) => {})
//       .catch((err) => {
//         console.error(err);
//       });
//   }
// }

// module.exports = Product;
