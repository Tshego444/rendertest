const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define sub-schemas for profile and company
const profileSchema = new Schema({
  skills: [String],
  experience: { type: String },
  location: { type: String },
  cv: { type: String }
}, { _id: false });

const companySchema = new Schema({
  name: { type: String },
  location: { type: String },
  industry: { type: String }
}, { _id: false });

// Main user schema
const userSchema = new Schema({
  userID: { type: String, unique: true }, // For compatibility with your JSON data
  name: { type: String },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String }, // Store hashed passwords
  userType: { type: String, enum: ['seeker', 'employer', 'admin'], required: true },
  profile: profileSchema,
  company: companySchema,
  applicationsViewed: { type: [String], default: [] },
  isBanned: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
module.exports = User;

