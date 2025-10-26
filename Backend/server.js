// backend/server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log("Loaded JWT_SECRET:", process.env.JWT_SECRET);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// Fallback (dev only) — remove or move to .env for production
const FALLBACK_MONGO_URI = 'mongodb+srv://Daniel:group11@jobseekr.cfbcb5h.mongodb.net/JobSwipeServer';
const MONGO_URI = process.env.MONGO_URI || FALLBACK_MONGO_URI;

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const fs = require('fs').promises;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const app = express();
const Job = require('./Models/Job');
const User = require('./Models/User');
const Conversation = require('./Models/Conversation');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// serve public and uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// Dev-friendly: enable CORS (restrict in production as needed)
app.use(cors());

// Simple request logger to help debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.originalUrl);
  next();
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Auth & security constants
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { verifyToken, ensureRole } = require('./middleware/auth');

// -------------------- Messaging --------------------

// helper: find a user by either Mongo _id or legacy userID
async function findUserByEither(idOrUserID) {
  if (!idOrUserID) return null;
  // try Mongo _id first
  if (mongoose.Types.ObjectId.isValid(String(idOrUserID))) {
    const u = await User.findById(String(idOrUserID)).lean();
    if (u) return u;
  }
  // fallback to userID field
  return await User.findOne({ userID: String(idOrUserID) }).lean();
}

/**
 * POST /conversations
 * Create a new conversation (ONLY employers may create). Body:
 * {
 *   to: "<targetUserIdOrUserID>",   // required - either Mongo _id or legacy userID of target (seeker)
 *   subject: "Optional subject",
 *   initialMessage: "optional initial message text"
 * }
 */
app.post('/conversations', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    const caller = req.user || {};
    const callerMongo = (caller.id || caller._id) ? String(caller.id || caller._id) : null;
    const callerUserID = caller.userID ? String(caller.userID) : null;

    const { to, subject, initialMessage } = req.body;
    if (!to) return res.status(400).send('target user "to" is required');

    // find target user and ensure they exist and are a seeker (or not an employer)
    const target = await findUserByEither(to);
    if (!target) return res.status(404).send('Target user not found');
    if (target.userType === 'employer' || target.role === 'employer') {
      return res.status(403).send('Cannot start conversation with an employer');
    }

    // Prepare participant identifiers
    const participantsUserIDs = [];
    if (callerUserID) participantsUserIDs.push(callerUserID);
    if (target.userID) participantsUserIDs.push(String(target.userID));

    // Try to find existing conversation by combinations of refs/userIDs
    let existing = null;

    // both sides stored as ObjectId refs
    if (callerMongo && target._id && mongoose.Types.ObjectId.isValid(callerMongo) && mongoose.Types.ObjectId.isValid(String(target._id))) {
      existing = await Conversation.findOne({
        $and: [
          { participantsRef: { $in: [ new mongoose.Types.ObjectId(callerMongo) ] } },
          { participantsRef: { $in: [ new mongoose.Types.ObjectId(String(target._id)) ] } }
        ]
      }).lean();
    }

    // both sides stored as legacy userID strings
    if (!existing && callerUserID && target.userID) {
      existing = await Conversation.findOne({
        participantsUserID: { $all: [callerUserID, String(target.userID)] }
      }).lean();
    }

    // mix: caller by ref, target by userID
    if (!existing && callerMongo && target.userID && mongoose.Types.ObjectId.isValid(callerMongo)) {
      existing = await Conversation.findOne({
        $and: [
          { participantsRef: { $in: [ new mongoose.Types.ObjectId(callerMongo) ] } },
          { participantsUserID: { $in: [ String(target.userID) ] } }
        ]
      }).lean();
    }

    // mix: caller by userID, target by ref
    if (!existing && callerUserID && target._id && mongoose.Types.ObjectId.isValid(String(target._id))) {
      existing = await Conversation.findOne({
        $and: [
          { participantsUserID: { $in: [ String(callerUserID) ] } },
          { participantsRef: { $in: [ new mongoose.Types.ObjectId(String(target._id)) ] } }
        ]
      }).lean();
    }

    if (existing) {
      // Return existing conversation (client can open it)
      return res.status(200).json(existing);
    }

    // Build conversation doc
    const conv = new Conversation({
      participantsUserID: [],
      participantsRef: []
    });

    if (callerUserID) conv.participantsUserID.push(callerUserID);
    if (target.userID) conv.participantsUserID.push(String(target.userID));

    if (callerMongo && mongoose.Types.ObjectId.isValid(callerMongo)) {
      conv.participantsRef.push(new mongoose.Types.ObjectId(callerMongo));
    }
    if (target._id && mongoose.Types.ObjectId.isValid(String(target._id))) {
      conv.participantsRef.push(new mongoose.Types.ObjectId(String(target._id)));
    }

    if (subject) conv.subject = subject;

    if (initialMessage && String(initialMessage).trim()) {
      const msg = {
        fromUserID: callerUserID || undefined,
        fromRef: (callerMongo && mongoose.Types.ObjectId.isValid(callerMongo)) ? new mongoose.Types.ObjectId(callerMongo) : undefined,
        toUserID: target.userID || undefined,
        toRef: (target._id && mongoose.Types.ObjectId.isValid(String(target._id))) ? new mongoose.Types.ObjectId(String(target._id)) : undefined,
        text: String(initialMessage).trim(),
        time: new Date(),
        read: false
      };
      conv.messages = [msg];
      conv.lastMessageAt = msg.time;
    }

    await conv.save();
    return res.status(201).json(conv);
  } catch (err) {
    console.error('Error POST /conversations', err);
    return res.status(500).send('Failed to create conversation');
  }
});

/**
 * GET /conversations
 * Get list of conversations where caller is a participant.
 * Returns lightweight conversation items (id, subject, lastMessageAt, participant info)
 */
app.get('/conversations', verifyToken, async (req, res) => {
  try {
    const caller = req.user || {};
    const callerMongo = (caller.id || caller._id) ? String(caller.id || caller._id) : null;
    const callerUserID = caller.userID ? String(caller.userID) : null;

    const or = [];
    if (callerUserID) or.push({ participantsUserID: callerUserID });
    if (callerMongo && mongoose.Types.ObjectId.isValid(callerMongo)) {
      or.push({ participantsRef: new mongoose.Types.ObjectId(callerMongo) });
    }

    if (or.length === 0) return res.json([]);

    const convs = await Conversation.find({ $or: or })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    // inside GET /conversations (replace the map block)
const result = await Promise.all(convs.map(async c => {
  const last = c.messages && c.messages.length ? c.messages[c.messages.length - 1] : null

  // figure out other participant relative to caller
  let otherId = null
  if (callerUserID && (c.participantsUserID || []).length) {
    otherId = (c.participantsUserID || []).find(u => String(u) !== String(callerUserID)) || null
  }
  if (!otherId && callerMongo && (c.participantsRef || []).length) {
    otherId = (c.participantsRef || []).map(String).find(r => r !== String(callerMongo)) || null
  }
  // fallback to any participant
  if (!otherId) {
    otherId = (c.participantsUserID && c.participantsUserID[0]) || (c.participantsRef && String(c.participantsRef[0])) || null
  }

  let displayName = c.subject || 'Conversation'
  if (otherId) {
    try {
      const u = await findUserByEither(otherId)
      if (u) displayName = (u.company && u.company.name) ? u.company.name : (u.name || u.email || displayName)
    } catch (e) {
      // ignore and keep existing displayName
    }
  }

  return {
    id: c._id,
    subject: c.subject,
    lastMessageAt: c.lastMessageAt || (last ? last.time : c.updatedAt),
    lastMessage: last ? { text: last.text, fromUserID: last.fromUserID, time: last.time } : null,
    participantsUserID: c.participantsUserID || [],
    participantsRef: (c.participantsRef || []).map(x => String(x)),
    messagesCount: (c.messages || []).length,
    displayName,
    displaySub: last ? last.text : (c.subject || '')
  }
  } ))


    return res.json(result);
  } catch (err) {
    console.error('Error GET /conversations', err);
    return res.status(500).send('Failed to fetch conversations');
  }
});

/**
 * GET /conversations/:id
 * Get conversation details and messages. Caller must be a participant.
 */
app.get('/conversations/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).send('Invalid conversation id');

    const conv = await Conversation.findById(id).lean();
    if (!conv) return res.status(404).send('Conversation not found');

    const caller = req.user || {};
    const callerMongo = (caller.id || caller._id) ? String(caller.id || caller._id) : null;
    const callerUserID = caller.userID ? String(caller.userID) : null;

    const isParticipant = (callerUserID && (conv.participantsUserID || []).includes(callerUserID))
      || (callerMongo && (conv.participantsRef || []).map(String).includes(callerMongo));

    if (!isParticipant) return res.status(403).send('Access denied');

    return res.json(conv);
  } catch (err) {
    console.error('Error GET /conversations/:id', err);
    return res.status(500).send('Failed to fetch conversation');
  }
});

/**
 * POST /conversations/:id/messages
 * Add a message to a conversation (must be a participant).
 * Body: { text: "message text" }
 */
app.post('/conversations/:id/messages', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !String(text).trim()) return res.status(400).send('Message text required');

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).send('Invalid conversation id');

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).send('Conversation not found');

    const caller = req.user || {};
    const callerMongo = (caller.id || caller._id) ? String(caller.id || caller._id) : null;
    const callerUserID = caller.userID ? String(caller.userID) : null;

    const isParticipant = (callerUserID && (conv.participantsUserID || []).includes(callerUserID))
      || (callerMongo && (conv.participantsRef || []).map(String).includes(callerMongo));

    if (!isParticipant) return res.status(403).send('Access denied');

    // Determine recipient (simple approach: recipient is the other participant)
    let recipientUserID = null;
    let recipientRef = null;
    // first try to find other participant by userID
    if (callerUserID && conv.participantsUserID?.length) {
      const other = conv.participantsUserID.find(u => String(u) !== String(callerUserID));
      if (other) recipientUserID = other;
    }
    // fallback to participantsRef
    if (!recipientUserID && callerMongo && conv.participantsRef?.length) {
      const otherRef = conv.participantsRef.map(String).find(r => r !== String(callerMongo));
      if (otherRef && mongoose.Types.ObjectId.isValid(otherRef)) {
        recipientRef = new mongoose.Types.ObjectId(otherRef);
      }
    }
    // if recipient not determined, use first participant that is not the caller
    if (!recipientUserID && !recipientRef) {
      const pUID = (conv.participantsUserID || []).find(u => String(u) !== String(callerUserID));
      if (pUID) recipientUserID = pUID;
      const pRef = (conv.participantsRef || []).map(String).find(r => r !== String(callerMongo));
      if (pRef && mongoose.Types.ObjectId.isValid(pRef)) recipientRef = new mongoose.Types.ObjectId(pRef);
    }

    const msg = {
      fromUserID: callerUserID || undefined,
      fromRef: (callerMongo && mongoose.Types.ObjectId.isValid(callerMongo)) ? new mongoose.Types.ObjectId(callerMongo) : undefined,
      toUserID: recipientUserID || undefined,
      toRef: recipientRef || undefined,
      text: String(text).trim(),
      time: new Date(),
      read: false
    };

    conv.messages.push(msg);
    conv.lastMessageAt = msg.time;
    await conv.save();

    return res.status(201).json({ message: 'Message sent', msg });
  } catch (err) {
    console.error('Error POST /conversations/:id/messages', err);
    return res.status(500).send('Failed to send message');
  }
});

/**
 * POST /conversations/:id/mark-read
 * Mark messages addressed to caller as read.
 * Body optional: { upto: "<ISO date>" } to mark messages before that time
 */
app.post('/conversations/:id/mark-read', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { upto } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).send('Invalid conversation id');

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).send('Conversation not found');

    const caller = req.user || {};
    const callerMongo = (caller.id || caller._id) ? String(caller.id || caller._id) : null;
    const callerUserID = caller.userID ? String(caller.userID) : null;

    const isParticipant = (callerUserID && (conv.participantsUserID || []).includes(callerUserID))
      || (callerMongo && (conv.participantsRef || []).map(String).includes(callerMongo));
    if (!isParticipant) return res.status(403).send('Access denied');

    const uptoDate = upto ? new Date(upto) : null;

    let changed = 0;
    conv.messages.forEach(m => {
      const addressedToCaller = (callerUserID && m.toUserID && String(m.toUserID) === String(callerUserID))
        || (callerMongo && m.toRef && String(m.toRef) === String(callerMongo));
      if (addressedToCaller && !m.read) {
        if (!uptoDate || new Date(m.time) <= uptoDate) {
          m.read = true;
          changed++;
        }
      }
    });

    if (changed > 0) {
      await conv.save();
    }

    return res.json({ changed });
  } catch (err) {
    console.error('Error POST /conversations/:id/mark-read', err);
    return res.status(500).send('Failed to mark read');
  }
});


// -------------------- ROUTES --------------------

// Helper to generate simple jobID (unique-ish). For production, use a better generator.
function genJobID() {
  return 'j' + Math.floor(Math.random() * 1_000_000);
}

// Create job (employer only)
app.post('/jobs', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    const { title, company, description, location, salary, jobType, tasks } = req.body;
    if (!title) return res.status(400).send("title is required");

    const caller = req.user || {};
    const employerID = caller.userID || caller.id || caller._id;
    if (!employerID) return res.status(400).send("Could not determine employer ID");

    let jobID = genJobID();
    for (let i = 0; i < 5; i++) {
      const exists = await Job.findOne({ jobID });
      if (!exists) break;
      jobID = genJobID();
    }

    const jobDoc = new Job({
      jobID,
      employerID: String(employerID),
      employerRef: caller.id || caller._id,
      title,
      company: company || (caller.company?.name || ''),
      description: description || '',
      location: location || '',
      salary: Array.isArray(salary) ? salary.map(Number) : [],
      jobType: jobType || {},
      tasks: Array.isArray(tasks) ? tasks : []
    });

    await jobDoc.save();
    res.status(201).json({ message: "Job created", job: jobDoc });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).send("Job creation failed");
  }
});

// Get all jobs (public)
app.get('/jobs', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 }).lean();
    res.json(jobs);
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).send("Error fetching jobs");
  }
});

// Get job by jobID (public)
app.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    let job = null;

    if (jobId) {
      job = await Job.findOne({ jobID: jobId }).lean();
    }

    if (!job && jobId && /^\d+$/.test(jobId)) {
      job = await Job.findOne({ jobID: Number(jobId) }).lean();
    }

    if (!job && jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      job = await Job.findById(jobId).lean();
    }

    if (!job && jobId && !jobId.startsWith('j')) {
      const alt = `j${jobId}`;
      job = await Job.findOne({ jobID: alt }).lean();
    }

    if (!job) return res.status(404).send("Job not found");
    res.json(job);
  } catch (err) {
    console.error('Error fetching job:', err);
    res.status(500).send("Error fetching job");
  }
});

// Get jobs owned by current employer (employer only)
app.get('/employer/jobs', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    const caller = req.user || {};
    const callerUserID = caller.userID ? String(caller.userID) : null;
    const callerMongo = (caller.id || caller._id) ? String(caller.id || caller._id) : null;

    const or = [];
    if (callerUserID) or.push({ employerID: callerUserID });
    if (callerMongo) {
      or.push({ employerRef: callerMongo });
      if (mongoose.Types.ObjectId.isValid(callerMongo)) {
        or.push({ employerRef: new mongoose.Types.ObjectId(callerMongo) });
      }
    }

    if (or.length === 0) return res.json([]);
    const jobs = await Job.find({ $or: or }).sort({ createdAt: -1 }).lean();
    return res.json(jobs);
  } catch (err) {
    console.error('Error GET /employer/jobs', err);
    return res.status(500).send('Failed to fetch employer jobs');
  }
});

// Update job (only employer who owns it or admin)
app.put('/jobs/:jobId', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const caller = req.user || {};
    const job = await Job.findOne({ jobID: jobId });
    if (!job) return res.status(404).send("Job not found");

    const callerId = String(caller.userID || caller.id || caller._id || '');
    if (String(job.employerID) !== callerId && caller.userType !== 'admin' && caller.role !== 'admin') {
      return res.status(403).send("Access denied: can only update your own job");
    }

    const up = req.body || {};
    if (up.title !== undefined) job.title = up.title;
    if (up.company !== undefined) job.company = up.company;
    if (up.description !== undefined) job.description = up.description;
    if (up.location !== undefined) job.location = up.location;
    if (up.salary !== undefined && Array.isArray(up.salary)) job.salary = up.salary.map(Number);
    if (up.jobType !== undefined) job.jobType = up.jobType;
    if (up.tasks !== undefined && Array.isArray(up.tasks)) job.tasks = up.tasks;

    await job.save();
    res.json({ message: "Job updated", job });
  } catch (err) {
    console.error('Update job error:', err);
    res.status(500).send("Failed to update job");
  }
});

// Delete job (owner or admin)
app.delete('/jobs/:jobId', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const caller = req.user || {};
    const job = await Job.findOne({ jobID: jobId });
    if (!job) return res.status(404).send("Job not found");

    const callerId = String(caller.userID || caller.id || caller._id || '');
    if (String(job.employerID) !== callerId && caller.userType !== 'admin' && caller.role !== 'admin') {
      return res.status(403).send("Access denied: can only delete your own job");
    }

    await job.deleteOne();
    res.json({ message: "Job deleted" });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).send("Failed to delete job");
  }
});

// Apply to job (jobseeker)
app.post('/jobs/:jobId/apply', verifyToken, ensureRole('seeker'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const caller = req.user || {};
    const seekerID = caller.userID || caller.id || caller._id;
    if (!seekerID) return res.status(400).send("Seeker ID missing");

    const job = await Job.findOne({ jobID: jobId });
    if (!job) return res.status(404).send("Job not found");

    if (job.applicants.some(a => String(a.userID) === String(seekerID))) {
      return res.status(400).send("Already applied");
    }

    job.applicants.push({
      userID: String(seekerID),
      userRef: caller.id || caller._id,
      time: new Date(),
      status: 'Submitted'
    });

    await job.save();
    res.json({ message: "Application successful", job });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).send("Error applying");
  }
});

// Get applicants for a job (employer only) - enriched with user name/email/skills/resumeUrl
app.get('/jobs/:jobId/applicants', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    let { jobId } = req.params;
    jobId = String(jobId || '').trim();
    console.log(`GET /jobs/${jobId}/applicants called by`, req.user && (req.user.userID || req.user.id || req.user._id));

    const caller = req.user || {};
    const callerId = String(caller.userID || caller.id || caller._id || '');

    let job = null;
    if (jobId) {
      job = await Job.findOne({ jobID: jobId }).lean();
    }
    if (!job && jobId && /^\d+$/.test(jobId)) {
      job = await Job.findOne({ jobID: Number(jobId) }).lean();
    }
    if (!job && jobId && mongoose.Types.ObjectId.isValid(jobId)) {
      job = await Job.findById(jobId).lean();
    }
    if (!job && jobId && !jobId.startsWith('j')) {
      const alt = `j${jobId}`;
      job = await Job.findOne({ jobID: alt }).lean();
    }

    if (!job) {
      console.warn(`Job not found for param "${jobId}"`);
      return res.status(404).send('Job not found');
    }

    if (String(job.employerID) !== callerId && caller.userType !== 'admin' && caller.role !== 'admin') {
      return res.status(403).send('Access denied: can only view applicants for your own job');
    }

    const applicants = Array.isArray(job.applicants) ? job.applicants : [];

    const userIdStrings = new Set();
    const userObjectIdHex = new Set();

    for (const a of applicants) {
      if (!a) continue;
      if (a.userID) userIdStrings.add(String(a.userID));
      if (a.userRef) {
        const maybe = String(a.userRef);
        if (mongoose.Types.ObjectId.isValid(maybe)) userObjectIdHex.add(maybe);
        else userIdStrings.add(maybe);
      }
    }

    const orClauses = [];
    if (userObjectIdHex.size > 0) {
      const objIds = Array.from(userObjectIdHex).map(s => {
        try { return new mongoose.Types.ObjectId(s); } catch (e) { return null; }
      }).filter(Boolean);
      if (objIds.length) orClauses.push({ _id: { $in: objIds } });
    }
    if (userIdStrings.size > 0) {
      orClauses.push({ userID: { $in: Array.from(userIdStrings) } });
    }

    let users = [];
    if (orClauses.length > 0) {
      users = await User.find({ $or: orClauses }).select('_id userID name email profile').lean();
    }

    const byMongoId = new Map();
    const byUserID = new Map();
    users.forEach(u => {
      if (u._id) byMongoId.set(String(u._id), u);
      if (u.userID) byUserID.set(String(u.userID), u);
    });

    const enriched = applicants.map(a => {
      const userRefStr = a.userRef ? String(a.userRef) : null;
      const userIDStr = a.userID ? String(a.userID) : null;

      const userFromMongo = userRefStr && byMongoId.get(userRefStr);
      const userFromLegacy = userIDStr && byUserID.get(userIDStr);
      const userObj = userFromMongo || userFromLegacy || null;

      let skills = [];
      if (a.skills && a.skills.length) skills = Array.isArray(a.skills) ? a.skills : String(a.skills).split(',').map(s => s.trim()).filter(Boolean);
      else if (userObj && userObj.profile && Array.isArray(userObj.profile.skills)) skills = userObj.profile.skills;

      let resumeUrl = a.resumeUrl || a.cv || null;
      if (!resumeUrl && userObj && userObj.profile && userObj.profile.cv) {
        const filename = String(userObj.profile.cv);
        const encoded = encodeURIComponent(filename);
        resumeUrl = `${req.protocol}://${req.get('host')}/uploads/${encoded}`;
      }

      return {
        userID: userIDStr || null,
        userRef: userRefStr || null,
        time: a.time || a.appliedAt || a.createdAt || null,
        status: a.status || 'Submitted',
        name: userObj?.name || a.name || `User ${userIDStr || userRefStr || 'unknown'}`,
        email: userObj?.email || a.email || '',
        skills,
        resumeUrl,
        raw: a
      };
    });

    return res.json(enriched);
  } catch (err) {
    console.error('Error GET /jobs/:jobId/applicants', err);
    return res.status(500).send('Failed to fetch applicants');
  }
});

// PUT to change applicant status (employer owns job)
app.put('/jobs/:jobId/applicants/:applicantId/status', verifyToken, ensureRole('employer'), async (req, res) => {
  try {
    const { jobId, applicantId } = req.params;
    const { status } = req.body;
    const caller = req.user || {};
    const callerId = String(caller.userID || caller.id || caller._id || '');

    if (!status || typeof status !== 'string') return res.status(400).send('status is required');

    const ALLOWED = ['Submitted','Review','Interview','Hired','Rejected'];
    if (!ALLOWED.includes(status)) return res.status(400).send('Invalid status');

    const job = await Job.findOne({ jobID: jobId });
    if (!job) return res.status(404).send('Job not found');

    if (String(job.employerID) !== callerId && caller.userType !== 'admin' && caller.role !== 'admin') {
      return res.status(403).send('Access denied: can only update applicants for your own job');
    }

    const idx = job.applicants.findIndex(a =>
      String(a.userID || '') === String(applicantId) ||
      String(a.userRef || '') === String(applicantId)
    );

    if (idx === -1) return res.status(404).send('Applicant not found for this job');

    job.applicants[idx].status = status;
    job.applicants[idx].statusUpdatedAt = new Date();

    await job.save();

    const updatedApplicant = job.applicants[idx];
    return res.json({ message: 'Applicant status updated', applicant: updatedApplicant });
  } catch (err) {
    console.error('Error PUT /jobs/:jobId/applicants/:applicantId/status', err);
    return res.status(500).send('Failed to update applicant status');
  }
});

// GET current user's applications across all jobs
// Returns array of application objects: { jobID, title, company, jobType, status, appliedAt, rawApplicant, jobRef }
app.get('/me/applications', verifyToken, async (req, res) => {
  try {
    const caller = req.user || {};
    const callerMongoId = caller.id || caller._id || null;
    const callerUserID = caller.userID || null;

    if (!callerMongoId && !callerUserID) {
      return res.status(400).send('Cannot determine current user id');
    }

    const orClauses = [];
    if (callerUserID) {
      orClauses.push({ 'applicants.userID': String(callerUserID) });
    }
    if (callerMongoId) {
      const maybeId = String(callerMongoId);
      if (mongoose.Types.ObjectId.isValid(maybeId)) {
        orClauses.push({ 'applicants.userRef': new mongoose.Types.ObjectId(maybeId) });
      }
      orClauses.push({ 'applicants.userRef': maybeId });
    }

    if (orClauses.length === 0) return res.json([]);

    const jobs = await Job.find({ $or: orClauses }).lean();
    const applications = [];

    for (const job of jobs) {
      const applicants = Array.isArray(job.applicants) ? job.applicants : [];
      for (const a of applicants) {
        const matchesUserID = callerUserID && a.userID && String(a.userID) === String(callerUserID);
        const matchesUserRefStr = callerMongoId && a.userRef && String(a.userRef) === String(callerMongoId);
        const matches = matchesUserID || matchesUserRefStr;

        if (!matches) continue;

        applications.push({
          jobID: job.jobID || String(job._id),
          jobRef: job._id,
          title: job.title,
          company: job.company,
          jobType: job.jobType || {},
          status: a.status || 'Submitted',
          appliedAt: a.time || a.appliedAt || a.createdAt || null,
          rawApplicant: a
        });
      }
    }

    applications.sort((x, y) => {
      const tx = x.appliedAt ? new Date(x.appliedAt).getTime() : 0;
      const ty = y.appliedAt ? new Date(y.appliedAt).getTime() : 0;
      return ty - tx;
    });

    // RETURN PLAIN ARRAY (frontend expects Array)
    return res.json(applications);
  } catch (err) {
    console.error('Error GET /me/applications', err);
    return res.status(500).send('Failed to fetch applications');
  }
});

// -------------------- AUTH routes --------------------

// Register
app.post('/auth/register', upload.single('pdf'), async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, age,
            skills, experience, location, companyName, companyLocation, industry } = req.body;

    if (!email || !password || !role) {
      return res.status(400).send("email, password and role are required");
    }

    let userType;
    if (role === 'jobseeker' || role === 'seeker') userType = 'seeker';
    else if (role === 'employer') userType = 'employer';
    else if (role === 'admin') userType = 'admin';
    else return res.status(400).send("role must be 'jobseeker'|'employer'|'admin'");

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).send("Email already in use");

    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const userID = 'u' + Math.floor(Math.random() * 1_000_000);

    const userObj = {
      userID,
      name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      email,
      passwordHash: hash,
      userType,
      applicationsViewed: [],
      isBanned: false
    };

    if (req.file) {
      try { await fs.mkdir(UPLOADS_DIR, { recursive: true }); } catch (err) { console.warn("Could not create uploads dir:", err); }
    }

    if (userType === 'seeker') {
      let skillsArr = [];
      if (skills) {
        try {
          skillsArr = typeof skills === 'string' && skills.trim().startsWith('[') ? JSON.parse(skills) : skills.split?.(',').map(s => s.trim()).filter(Boolean);
        } catch {
          skillsArr = typeof skills === 'string' ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
        }
      }

      const profile = {
        skills: skillsArr,
        experience: experience || (req.body.experience || ''),
        location: location || '',
        cv: undefined
      };

      if (req.file) {
        const safeFileName = `${userID}-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
        const dest = path.join(UPLOADS_DIR, safeFileName);
        await fs.writeFile(dest, req.file.buffer);
        profile.cv = safeFileName;
      }

      if (age) profile.age = Number(age);
      userObj.profile = profile;
    }

    if (userType === 'employer') {
      const company = {
        name: companyName || req.body.company?.name || '',
        location: companyLocation || req.body.company?.location || '',
        industry: industry || req.body.company?.industry || ''
      };
      userObj.company = company;
    }

    const user = new User(userObj);
    await user.save();

    const responseUser = {
      id: user._id,
      userID: user.userID,
      name: user.name,
      email: user.email,
      userType: user.userType,
      profile: user.profile,
      company: user.company,
      applicationsViewed: user.applicationsViewed
    };

    res.status(201).json({ message: "User registered", user: responseUser });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).send("Registration failed");
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send("Email and password required");

    const user = await User.findOne({ email });
    if (!user) return res.status(401).send("Invalid credentials");
    if (user.isBanned) return res.status(403).send("Your account has been banned. Contact admin.");
    if (!user.passwordHash) return res.status(401).send("Invalid credentials");

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).send("Invalid credentials");

    const payload = { id: user._id.toString(), userType: user.userType };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    let userData = {
      id: user._id,
      userID: user.userID,
      name: user.name,
      email: user.email,
      userType: user.userType,
    };

    if (user.userType === 'seeker') {
      userData.profile = user.profile;
      userData.applicationsViewed = user.applicationsViewed || [];
    } else if (user.userType === 'employer') {
      userData.company = user.company;
    }

    res.json({
      message: "Login successful",
      token,
      user: userData
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send("Login failed");
  }
});

// Update User
app.put('/users/:id', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    const targetId = req.params.id;
    const caller = req.user || {};
    const callerIsAdmin = (caller.userType === 'admin') || (caller.role === 'admin');

    let user = null;
    if (mongoose.Types.ObjectId.isValid(targetId)) {
      user = await User.findById(targetId);
    }
    if (!user) {
      // fallback: try find by legacy userID (but previous logic used caller.userID - we should try lookup by provided id too)
      user = await User.findOne({ userID: targetId });
    }
    if (!user) return res.status(404).send("User not found");

    const callerId = String(caller.id || caller._id || caller.userID || '');
    const targetMongoId = String(user._id);
    const targetUserID = String(user.userID || '');

    const callerIsOwner = (callerId && (callerId === targetMongoId || callerId === targetUserID));
    if (!callerIsAdmin && !callerIsOwner) {
      return res.status(403).send("Access denied: you can only update your own account");
    }

    // Basic scalar updates
    if (req.body.email && req.body.email !== user.email) {
      const exists = await User.findOne({ email: req.body.email });
      if (exists) return res.status(409).send("Email already in use");
      user.email = req.body.email;
    }

    if (req.body.firstName || req.body.lastName) {
      const first = (req.body.firstName || '').trim();
      const last = (req.body.lastName || '').trim();
      user.name = [first, last].filter(Boolean).join(' ') || user.name;
    } else if (req.body.name) {
      user.name = req.body.name;
    }

    if (req.body.password) {
      user.passwordHash = await bcrypt.hash(req.body.password, BCRYPT_SALT_ROUNDS);
    }

    // ----------- NEW: userType handling (only allow promotion to admin) -----------
    // Only accept a userType change when caller is an admin and the requested userType === 'admin'
    if (req.body.userType !== undefined) {
      if (!callerIsAdmin) {
        return res.status(403).send("Only admins may change userType");
      }
      const requestedType = String(req.body.userType || '').trim();
      if (requestedType === 'admin') {
        // Promote to admin (idempotent)
        user.userType = 'admin';
      } else {
        // Reject attempts to set userType to anything other than "admin"
        return res.status(400).send("userType can only be changed to 'admin'");
      }
    }
    // ---------------------------------------------------------------------------

    // Update seeker profile fields if this account is a seeker (or if admin editing seeker fields)
    // We allow updating profile fields regardless of whether userType was changed here.
    if (user.userType === 'seeker') {
      user.profile = user.profile || {};

      if (req.body.skills) {
        let skillsArr = [];
        if (Array.isArray(req.body.skills)) skillsArr = req.body.skills;
        else if (typeof req.body.skills === 'string') {
          const v = req.body.skills.trim();
          try {
            skillsArr = v.startsWith('[') ? JSON.parse(v) : v.split(',').map(s => s.trim()).filter(Boolean);
          } catch {
            skillsArr = v.split(',').map(s => s.trim()).filter(Boolean);
          }
        }
        user.profile.skills = skillsArr;
      }

      if (req.body.experience !== undefined) user.profile.experience = req.body.experience;
      if (req.body.location !== undefined) user.profile.location = req.body.location;
      if (req.body.age !== undefined) {
        const n = Number(req.body.age);
        if (!Number.isNaN(n)) user.profile.age = n;
      }

      if (req.file) {
        try { await fs.mkdir(UPLOADS_DIR, { recursive: true }); } catch (e) { /* non-fatal */ }
        const userIDSafe = user.userID || `u${Date.now()}`;
        const safeFileName = `${userIDSafe}-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
        const dest = path.join(UPLOADS_DIR, safeFileName);
        await fs.writeFile(dest, req.file.buffer);
        user.profile.cv = safeFileName;
      }
    }

    // Update employer fields if account is employer
    if (user.userType === 'employer') {
      user.company = user.company || {};
      if (req.body.companyName !== undefined) user.company.name = req.body.companyName;
      if (req.body.companyLocation !== undefined) user.company.location = req.body.companyLocation;
      if (req.body.industry !== undefined) user.company.industry = req.body.industry;
    }

    // applicationsViewed etc.
    if (req.body.applicationsViewed) {
      try {
        user.applicationsViewed = Array.isArray(req.body.applicationsViewed) ? req.body.applicationsViewed : JSON.parse(req.body.applicationsViewed);
      } catch { /* ignore parse errors */ }
    }

    await user.save();

    const resp = {
      id: user._id,
      userID: user.userID,
      name: user.name,
      email: user.email,
      userType: user.userType,
      profile: user.profile,
      company: user.company,
      applicationsViewed: user.applicationsViewed
    };
    res.json({ message: "User updated", user: resp });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).send("Failed to update user");
  }
});


/**
 * GET /users/:id
 * Returns a lightweight public profile for a user, looked up by Mongo _id or legacy userID.
 * Requires authentication (caller must be logged in) — you already use auth for other user lookups.
 */
app.get('/users/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).send('id required');

    const u = await findUserByEither(id);
    if (!u) return res.status(404).send('User not found');

    // Return only safe, public fields
    const safe = {
      id: u._id,
      userID: u.userID || null,
      name: u.name || null,
      email: u.email || null,
      userType: u.userType || null,
      company: u.company || null,     // company.name is what UI prefers for employers
      profile: u.profile ? {
        // only expose non-sensitive profile fields
        skills: u.profile.skills || [],
        cv: u.profile.cv || undefined,
        location: u.profile.location || undefined,
        experience: u.profile.experience || undefined,
        age: u.profile.age || undefined
      } : undefined
    };

    return res.json(safe);
  } catch (err) {
    console.error('Error GET /users/:id', err);
    return res.status(500).send('Failed to fetch user');
  }
});

app.get('/users', verifyToken, ensureRole('admin'), async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const role = (req.query.role || '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    let limit = Math.max(1, parseInt(req.query.limit || '50', 10));
    if (limit > 200) limit = 200;

    const filter = {};

    // role filter if provided
    if (role) {
      // accept either userType or role fields in case of mixed docs
      filter.$or = [
        { userType: role },
        { role: role }
      ];
    }

    // free-text search across name, email, userID
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // escape and case-insensitive
      filter.$or = filter.$or ? filter.$or.concat([
        { name: re },
        { email: re },
        { userID: re }
      ]) : [
        { name: re },
        { email: re },
        { userID: re }
      ];
    }

    // count total
    const total = await User.countDocuments(filter);

    // fetch page
    const docs = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('_id userID name email userType role company profile createdAt') // safe projection
      .lean();

    // map to safe shape that frontend expects
    const users = docs.map(u => ({
      id: u._id,
      userID: u.userID || null,
      name: u.name || null,
      email: u.email || null,
      userType: u.userType || u.role || null,
      company: u.company || null,
      profile: u.profile ? {
        skills: u.profile.skills || [],
        cv: u.profile.cv || undefined,
        location: u.profile.location || undefined,
        experience: u.profile.experience || undefined,
        age: u.profile.age || undefined
      } : undefined,
      createdAt: u.createdAt || undefined
    }));

    return res.json({
      total,
      page,
      limit,
      count: users.length,
      users
    });
  } catch (err) {
    console.error('Error GET /users', err);
    return res.status(500).send('Failed to fetch users');
  }
});

/**
 * DELETE /users/:id
 * Delete a user (by Mongo _id or legacy userID).
 * Allowed: admin users, or the user themself.
 * Cleanup:
 *  - remove user's jobs (if employer)
 *  - remove user's applications from other jobs (if seeker)
 *  - remove conversations that include the user
 *  - delete uploaded CV file (if present)
 */
// DELETE /users/:id
// Admin-only or owner can delete — ensure verifyToken + ensureRole('admin') in middleware as needed
app.delete('/users/:id', verifyToken, ensureRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).send('id required');

    // Try Mongo _id first
    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(String(id))) {
      deleted = await User.findByIdAndDelete(String(id)).lean();
    }

    // If nothing deleted yet, try legacy userID
    if (!deleted) {
      deleted = await User.findOneAndDelete({ userID: String(id) }).lean();
    }

    if (!deleted) return res.status(404).send('User not found');

    // Optionally: cascade delete related data (jobs, conversations, etc.) — be careful!
    // e.g. await Job.updateMany({ employerID: deleted.userID }, { $unset: { employerID: "" } });

    return res.json({ message: 'User deleted', user: {
      id: deleted._id,
      userID: deleted.userID,
      email: deleted.email,
      name: deleted.name
    }});
  } catch (err) {
    console.error('Error DELETE /users/:id', err);
    return res.status(500).send('Failed to delete user');
  }
});



// ==================== AI CHATBOT SECTION - PUT THIS RIGHT HERE ====================
// (BEFORE the startServer function, around line 1220)

let botModule = null;
let botInitialized = false;
let botInitError = null;

// Initialize bot function
async function initializeBot() {
  try {
    console.log('🤖 Loading bot.js module...');
    console.log('📁 Bot module path:', path.join(__dirname, 'ai/bot.js'));
    
    botModule = require('./ai/bot.js');
    console.log('✅ Bot module loaded successfully');
    
    // CRITICAL FIX: Wait for bot to actually initialize
    console.log('⏳ Waiting for bot initialization to complete...');
    await botModule.ensureInitialized();
    
    botInitialized = true;
    console.log('✅ Bot fully initialized and ready');
    
    // Log status
    if (botModule.getStatus) {
      const status = botModule.getStatus();
      console.log('📊 Bot initialization status:', JSON.stringify(status, null, 2));
    }
    
    return true;
  } catch (error) {
    botInitError = error;
    console.error('⚠️ Bot module failed to load:', error.message);
    console.error('Full error:', error.stack);
    console.log('Server will continue without AI features');
    return false;
  }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    console.log('🤖 AI chat request received');
    const { message, sessionId } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!botModule) {
      console.log('⚠️ Bot module not available');
      return res.status(503).json({ 
        error: 'AI service temporarily unavailable',
        response: 'The AI assistant is currently unavailable. Please try again later or contact support.',
        message: 'Bot module not initialized'
      });
    }

    if (!botInitialized) {
      console.log('⚠️ Bot not fully initialized yet');
      return res.status(503).json({ 
        error: 'AI service starting up',
        response: 'The AI assistant is still starting up. Please try again in a moment.',
        message: 'Bot initialization in progress'
      });
    }

    console.log('📝 User message:', message);
    if (sessionId) {
      console.log('🔑 Session ID:', sessionId.substring(0, 8) + '...');
    }
    
    const result = await botModule.handleChat(message, sessionId);
    
    console.log('✅ Response generated');
    console.log(`   Source: ${result.source}`);
    console.log(`   Confidence: ${result.confidence}`);
    
    return res.json(result);
    
  } catch (error) {
    console.error('❌ AI chat error:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to process chat request',
      response: 'I encountered an error. Please try rephrasing your question.',
      message: error.message 
    });
  }
});

app.get('/api/bot/status', (req, res) => {
  try {
    if (!botModule) {
      return res.json({ 
        available: false, 
        initialized: false,
        message: 'Bot module not loaded' 
      });
    }
    
    const status = botModule.getStatus ? botModule.getStatus() : { available: true };
    return res.json({ 
      available: botInitialized && !botInitError,
      initialized: botInitialized,
      hasError: !!botInitError,
      errorMessage: botInitError?.message || null,
      ...status 
    });
  } catch (error) {
    res.status(500).json({ 
      available: false, 
      error: error.message 
    });
  }
});

app.get('/api/bot/health', (req, res) => {
  res.json({
    botModule: !!botModule,
    botInitialized,
    botInitError: botInitError?.message || null,
    timestamp: new Date().toISOString()
  });
});

// ==================== END AI CHATBOT SECTION ====================

// Default route
// app.get('/', (req, res) => res.send('Server is running! Try /jobs'));

// -------------------- DB connect + single-start server --------------------
async function startServer() {
  console.log('Starting server: attempting MongoDB connection...');
  console.log('MONGO_URI present?', !!MONGO_URI ? 'YES (hidden)' : 'NO');

  console.log('\n🤖 Initializing AI Bot...');
  const botReady = await initializeBot();
  
  if (botReady) {
    console.log('✅ Bot ready for requests');
  } else {
    console.warn('⚠️ Bot initialization failed, continuing without AI features');
    console.warn('   Error:', botInitError?.message || 'Unknown');
  }

  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    try { await seedAdmin(); } catch (e) { console.error('Seed admin error (non-fatal):', e); }
  } catch (err) {
    console.error('MongoDB connection error (caught):', err && err.message ? err.message : err);
    if (process.env.NODE_ENV === 'production') {
      console.error('Exiting because DB connection failed in production.');
      process.exit(1);
    } else {
      console.warn('Continuing without DB (development only). DB-backed routes will fail.');
    }
  }



  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = process.env.PORT || 3000;
  // AFTER all API routes, BEFORE app.listen()
  if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    app.use(express.static(path.join(__dirname, '../Frontend/dist')));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../Frontend/dist/index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
  });

  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('HTTP server closed.');
      mongoose.disconnect().then(() => {
        console.log('Mongoose disconnected.');
        process.exit(0);
      }).catch(() => process.exit(0));
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.once('SIGUSR2', () => { shutdown(); });
}

if (require.main === module) startServer();

// Seed admin (kept as in your original)
async function seedAdmin() {
  try {
    const existingAdmin = await User.findOne({ userType: "admin" });
    if (existingAdmin) {
      console.log("Admin account already exists:", existingAdmin.email);
      return;
    }
    const passwordHash = await bcrypt.hash("admin123", 10);
    const admin = new User({ email: "admin@jobswipe.com", passwordHash, userType: "admin" });
    await admin.save();
    console.log("Default admin created:", admin.email);
  } catch (err) {
    console.error("Error seeding admin:", err);
  }
}

module.exports = { app, startServer, seedAdmin };
