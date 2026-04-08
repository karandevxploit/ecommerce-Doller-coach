const mongoose = require("mongoose");

const configSchema = new mongoose.Schema({
  logo: { type: String, default: "" },
  company_name: { type: String, default: "Doller Coach" },
  phone: { type: String, default: "9690668290" },
  email: { type: String, default: "dollercoach@gmail.com" },
  gst: { type: String, default: "09VKC236QJZE" },
  address: { type: String, default: "" },
}, { timestamps: true });

// Ensure it's a singleton (only one config doc)
configSchema.statics.getSingleton = async function() {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

module.exports = mongoose.model("Config", configSchema);
