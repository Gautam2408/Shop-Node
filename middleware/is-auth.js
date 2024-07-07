module.exports = (req, res, next) => {
  // route protection: if user is logged in then he can't access some routes
  // if he tries to access then we will redirect him to login
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }

  next();
};
