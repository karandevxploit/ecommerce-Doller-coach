const bcrypt = require("bcryptjs");
const { createMysqlDocumentModel } = require("../utils/mysqlDocumentModel");

const User = createMysqlDocumentModel("User", {
  defaults: {
    role: "user",
    tokenVersion: 0,
    isDeleted: false,
    loginAttempts: 0,
  },
  methods: {
    async comparePassword(candidatePassword) {
      if (!this.password) return false;
      return bcrypt.compare(candidatePassword, this.password);
    },
    isLocked() {
      return this.lockUntil && new Date(this.lockUntil).getTime() > Date.now();
    },
  },
  statics: {
    async handleFailedLogin(user) {
      if (!user) return null;
      const loginAttempts = Math.min(Number(user.loginAttempts || 0) + 1, 5);
      const update = { loginAttempts };
      if (loginAttempts >= 5) update.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      return this.updateOne({ _id: user._id }, { $set: update });
    },
    resetLoginAttempts(userId) {
      return this.updateOne({ _id: userId }, { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    },
    bumpTokenVersion(userId) {
      return this.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    },
    softDelete(userId) {
      return this.updateOne({ _id: userId }, { $set: { isDeleted: true }, $inc: { tokenVersion: 1 } });
    },
  },
});

module.exports = User;
