require("dotenv").config();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const postmark = require("postmark");
const { validationResult } = require("express-validator");

const errorFn = require("../util/error");
const User = require("../models/user");

exports.getLogin = (req, res, next) => {
  const msgArr = req.flash("error");
  res.render("auth/login", {
    pageTitle: "Login",
    path: "/login",
    errorMessage: msgArr.length > 0 ? msgArr[0] : null,
    validationErrors: [],
    oldInput: {
      email: "",
      password: "",
    },
  });
};

exports.postLogin = (req, res, next) => {
  const inputEmail = req.body.email;
  const inputPassword = req.body.password;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).render("auth/login", {
      pageTitle: "Login",
      path: "/login",
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      oldInput: {
        email: inputEmail,
        password: inputPassword,
      },
    });
  }

  User.findOne({ email: inputEmail })
    .then((user) => {
      if (!user) {
        // either wrong eamil or not signed up
        req.flash("error", "Invalid Email or not Signed up");
        return res.redirect("/login");
      }

      bcrypt
        .compare(inputPassword, user.password)
        .then((doMatch) => {
          if (doMatch) {
            // if password matches
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save((err) => {
              console.error(err);
              res.redirect("/");
            });
          }
          // password don't match
          res.render("auth/login", {
            pageTitle: "Login",
            path: "/login",
            errorMessage: "Invalid Password",
            validationErrors: [{ path: "password" }],
            oldInput: {
              email: inputEmail,
              password: inputPassword,
            },
          });
        })
        .catch((err) => {
          throw err;
        });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.postLogout = (req, res, next) => {
  // Revise lec: 235 (V.V.V imp)
  // we basically finished a request, we got a request and we sent a response, we're done. This data does
  // not stick around this data is lost after the request or after we send the response.So whenever we visit
  // a different page, like here where we do get redirected, so we get redirected here and we reach our get
  // index action here in the end and there, we do render the shop index page but that is a brand new request,
  // the redirection creates a brand new request and this is super important to understand.
  req.session.destroy((err) => {
    if (err) {
      errorFn(err, next);
    }
    res.redirect("/");
  });
};

exports.getSignup = (req, res, next) => {
  const msgArr = req.flash("error");
  res.render("auth/signup", {
    pageTitle: "Signup",
    path: "/signup",
    errorMessage: msgArr.length > 0 ? msgArr[0] : null,
    validationErrors: [],
    oldInput: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
};

exports.postSignup = (req, res, next) => {
  const inputName = req.body.name;
  const inputEmail = req.body.email;
  const inputPassword = req.body.password;
  const inputConfirmPassword = req.body.confirmPassword;
  // validation result will be a function that allows us to gather all the errors prior
  // validation middleware like this one might have thrown or might have stored. errors
  // can be retrieved by calling validation result on the request and in that request,
  // this express validator middleware  which we added here will have added errors that can now be retrieved
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(errors.array());
    return res.status(422).render("auth/signup", {
      pageTitle: "Signup",
      path: "/signup",
      errorMessage: errors.array()[0].msg,
      validationErrors: errors.array(),
      oldInput: {
        name: inputName,
        email: inputEmail,
        password: inputPassword,
        confirmPassword: inputConfirmPassword,
      },
    });
  }
  User.findOne({ email: inputEmail })
    .then((user) => {
      if (user) {
        // we already have user then simply redirect to same page
        req.flash("error", "Email already exists so pick a new one");
        return res.redirect("/signup");
      }
      return bcrypt
        .hash(inputPassword, 12)
        .then((encryptedPassword) => {
          // now we need to store this user in user table
          const newUser = new User({
            name: inputName,
            email: inputEmail,
            password: encryptedPassword,
            cart: { items: [], totalPrice: 0 },
          });

          return newUser.save();
        })
        .then((result) => {
          // Send an email:
          const client = new postmark.ServerClient(process.env.POSTMARK);
          client.sendEmail({
            From: process.env.OUR_EMAIL,
            To: inputEmail,
            Subject: "Succesfully Signed up",
            HtmlBody:
              "<p>You are successfully signed up into out shopping app</p>",
            TextBody: "Hello from Postmark!",
            MessageStream: "outbound",
          });

          res.redirect("/login");
        });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.getReset = (req, res, next) => {
  const msgArr = req.flash("error");
  res.render("auth/reset", {
    pageTitle: "Reset Password",
    path: "/reset",
    errorMessage: msgArr.length > 0 ? msgArr[0] : null,
  });
};

exports.postReset = (req, res, next) => {
  // We need to first of all create a unique token that also has some expiry date which we will store in our db
  // so that the link which we didn't click includes that token and we can verify that the user did get that link
  // from us because if we just, well let the user now change that password, we got no security mechanism in place,
  // so we need that token to put it into the email we're about to send to only let users change the password through
  // the email that contains that token, that's an additional security mechanism.
  // Crypto is a library that helps us with creating secure unique random values and other things but we'll need that
  // unique secure random value here and I will call random bytes to generate some random bytes, I want 32 random bytes

  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.error(err);
      return res.redirect("/reset");
    }

    const token = buffer.toString("hex");

    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "email doesn't exit so please signup");
          return res.redirect("/reset");
        }

        user.resetToken = token;

        // expire in one hour and this now has to be expressed in milliseconds
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save().then((result) => {
          // Send an email:
          const client = new postmark.ServerClient(process.env.POSTMARK);
          client.sendEmail({
            From: process.env.OUR_EMAIL,
            To: req.body.email,
            Subject: "Password Reset",
            HtmlBody: `
            <p>You requested a password reset</p>
            <p>Click this <a href="http://localhost:3000/new-password/${token}">link</a> to reset password</p>
            `,
            TextBody: "Hello from Postmark!",
            MessageStream: "outbound",
          });
        });
      })
      .catch((err) => {
        errorFn(err, next);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        req.flash(
          "error",
          "either wrong token or link expired try resetting once more!"
        );
        return res.redirect("/reset");
      }
      const msgArr = req.flash("error");
      return res.render("auth/new-password", {
        pageTitle: "New Password",
        path: "/new-password",
        errorMessage: msgArr.length > 0 ? msgArr[0] : null,
        userId: user._id.toString(),
        token: token,
      });
    })
    .catch((err) => {
      errorFn(err, next);
    });
};

exports.postNewPassword = (req, res, next) => {
  const token = req.params.token;
  const userId = req.body.userId;
  const newPassword = req.body.password;
  let resetUser;
  User.findOne({
    _id: userId,
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      if (!user) {
        req.flash(
          "error",
          "either wrong token or link expired try resetting once more!"
        );
        return res.redirect("/reset");
      }
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => {
      errorFn(err, next);
    });
};
