require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");

// deployment
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const errorController = require("./controllers/error");
const { default: mongoose } = require("mongoose");

const errorFn = require("./util/error");
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const User = require("./models/user");
// const Product = require("./models/product");

const app = express();

// Now we can pass an object here where we can configure some things, for example that we want to store the
// secret that is used for assigning our token, so for hashing them, that we want to store them in a cookie
// instead of the session which is the default but we want to use the session, the default so nothing is passed
const csrfProtection = csrf();

const storeSession = new MongoDBStore({
  uri: process.env.CONNECTURI,
  collection: "session",
});

// Disk storage is in the end a storage engine which you can use with multer and there you can pass a javascript
// object to configure that. There are two functions which multer will then call for an incoming file. Callback
// with null as the first argument, that would be an error message you throw to inform multer that something is
// wrong with the incoming file and it should not store it but if that is null, you tell multer that it's OK to
// store it and then the second argument is the place where you do want to store it, like that images folder.
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("a");
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    console.log("b");
    cb(null, file.originalname);
  },
});

// we should call the callback with null as an error and true if we want to accept
// that file so if it should be stored or false if we don't want to store that file.
const filterConfig = (req, file, cb) => {
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png"
  ) {
    console.log("c");
    cb(null, true);
  } else {
    console.log("d");
    cb(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

// we can use helmet to secure our node express applications, what this will do is this package will add certain
// headers to the responses we sent back and it follows best practices for doing so, you'll see which attack
// patterns or which security issues these are against which it protects us by setting the right headers.
app.use(helmet());

app.use(compression());

// flags:'a': is used to append
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" }
);

// used for request logging & we are storing it in access.log file
app.use(morgan("combined", { stream: accessLogStream }));

// for extracting the content of our incoming requests, we set up a middleware in app.js, we're using a special
// middleware, this body parser middleware and this middleware uses or exposes a couple of different parsers and
// we're using the url encoded parser, now url encoded data is basically text data. So if a form is submitted
// without a file, so just with text fields no matter if that text field then stores a number, a url or plaintext
// but it's all encoded in text when it is submitted. This format is then called url encoded. But for Image, this
// is invalid, this is basically an empty text because it can't extract our file as text because a file is binary data.
app.use(bodyParser.urlencoded({ extended: false }));

// Now failing extraction, we need to parse our data differently and the body parser that does not include any parser
// that could handle file data as well. We need a new package for that is called as multer. Multer is another third party
// package that parses incoming requests but this package parses incoming requests for files, so it is able to handle file
// requests as well or requests with mixed data, with text and file data. We'll still keep body parser because we still have
// like for example, our sign up form where we only submit url encoded data but now we'll have to use a different encoding
// and that starts with our form. So back in the view, the edit product view, there I'll change my form here a little bit,
// I'll also add a new field and that's the enctype field which I'll set to multipart form data.
// single is used beacuse are uploading only one file at a time ans img is the name field we used in form.
// By adding storage options, We don't have the buffer because now multer is able to do something with the buffer,
// instead  of just buffering it all in memory, it can then turn that buffer back into binary data you could say
// and it stores it in this path configured by storage option and also we can configure name of that uploaded img.
app.use(
  multer({
    storage: fileStorage,
    fileFilter: filterConfig,
  }).single("img")
);

app.use(express.static(path.join(__dirname, "public")));

// we'll replace http://localhost:3000/public/images/abc.png with http://localhost:3000/abc.png
// by doing following thing & in index.ejs also we are loading absolute urls instead of relative
app.use(
  "/public/images",
  express.static(path.join(__dirname, "public/images"))
);

// creating middleware
// secret in production should be a long string value. Then you should add the re-save option
// and set this to false, this means that the session will not be saved on every request that
// is done, so on every response that is sent but only if something changed in the session, this
// will obviously improve performance and so on. Also there is the save uninitialized value which
// you should set to false because this will also basically ensure that no session gets saved for
// a request where it doesn't need to be saved because nothing was changed about it.
app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    store: storeSession,
  })
);

// So here after we initialized the session, that's important because csrf, the package will use that
// session now. After we initialized the session, we will add csrf protection, So now with  that, csrf
// protection is generally enabled but we still need to add something to our views to really use it.
app.use(csrfProtection);

// To store some data before we redirect which we then use in the brand new request that is triggered by the
// redirect, how could we do that? Well you learned if you want to store data across requests, you need a session.
// So we can use a session for that but of course I don't want to store the error message in the session permanently,
// I want to add something to the error message, kind of flash it onto the session and once the error message was then
// used, so once we pulled it out of the session and did something with it, I want to remove it from the session so that
// for subsequent requests, this error message is not part of the session anymore
app.use(flash());

// another middleware
// we can use a special feature provided by expressjs, we can access a special field on the
// response, the locals field. This allows us to set local variables that are passed into the
// views, local simply because well they will only exist in the views which are rendered.
app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  // console.log("Run on each req as each one is independent");
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      errorFn(err, next);
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use(errorController.get404);

// Express also knows a middleware with four arguments, a so-called error handling middleware
// and there, the first argument will be the error and then followed by the other three arguments.
// Now express is clever enough to detect that this is a special kind of middleware and it will
// move right away to these error handling middlewares when you call next with an error passed to it,
// so it will then skip all the other middlewares and move to that
app.use((error, req, res, next) => {
  // res.status(error.httpStatusCode).render();
  res.redirect("/500");
});

// we haven't created our own ssl certificate as it is provided by our hosting provided
// if you have to create your own then revise lec: 458
mongoose
  .connect(process.env.CONNECTURI)
  .then((result) => {
    console.log("connected");
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log("aa");
    res.redirect("/500");
  });
