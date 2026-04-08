/** Standard API envelope: { success, data, message } */
function ok(res, data = null, message = "", status = 200, meta = undefined) {
  return res.status(status).json({ success: true, data, message, meta });
}

function fail(res, message = "Request failed", status = 400) {
  return res.status(status).json({ success: false, data: null, message });
}

module.exports = { ok, fail };
