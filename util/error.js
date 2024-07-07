// we've got a lot of catch blocks where we interact with the database and in every catch block
// here, we should redirect to the 500 page, But replicating that code all over the place is
// rarely what we want to do. so we can use a sol provided by express:
// Well when we call next with an error passed as an argument, then we actually let express know that
// an error occurred and it will skip all other middlewares and move right away to an error handling
// middleware and that's the middleware we have defined in app.js

module.exports = (err, next) => {
  const error = new Error(err);
  error.httpStatusCode = 500;
  console.log(error);
  return next(error);
};
