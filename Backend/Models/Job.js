// backend/Models/Job.js
const mongoose = require('mongoose');

// Subschema for applicants
const ApplicantSchema = new mongoose.Schema({
  userID: { type: String, required: true }, // can be legacy userID ("u123") or ObjectId string
  userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // reference to User
  time: { type: Date, default: Date.now },
  status: { type: String, default: 'Submitted' },
}, { _id: false });

// Subschema for job type (extra job details)
const JobTypeSchema = new mongoose.Schema({
  workplace: { type: String, default: '' }, // e.g. Remote / Onsite / Hybrid
  time: { type: String, default: '' },      // e.g. Full-time / Part-time
  role: { type: String, default: '' },      // e.g. Junior / Senior / Intern
}, { _id: false });

// Main Job schema
const JobSchema = new mongoose.Schema({
  jobID: { type: String, required: true, unique: true }, // e.g. "j1001"
  employerID: { type: String, required: true },          // legacy employer ID
  employerRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // ref to employer

  title: { type: String, required: true },
  company: { type: String, default: '' },
  description: { type: String, default: '' },
  location: { type: String, default: '' },

  salary: { type: [Number], default: [] }, // e.g. [3000, 5000]

  jobType: { type: JobTypeSchema, default: {} },
  tasks: { type: [String], default: [] },

  applicants: { type: [ApplicantSchema], default: [] },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update `updatedAt` automatically before saving
JobSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Job', JobSchema);
