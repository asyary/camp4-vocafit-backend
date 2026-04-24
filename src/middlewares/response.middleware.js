const responseHandler = (req, res, next) => {
  res.success = (data, message = "Success", status = 200, meta = null) => {
    return res.status(status).json({
      success: true,
      message,
      data,
      meta
    });
  };

  // Helper for error responses
  res.error = (message = "Internal Server Error", status = 500, data = null) => {
    return res.status(status).json({
      success: false,
      message,
      data
    });
  };

  next();
};

module.exports = responseHandler;