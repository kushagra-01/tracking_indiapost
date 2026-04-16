function ok(res, data) {
  return res.status(200).json({ success: true, data });
}

function fail(res, status, code, message, details) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
}

module.exports = { ok, fail };

