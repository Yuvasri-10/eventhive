const express = require('express'), mongoose = require('mongoose'), jwt = require('jsonwebtoken');
const crypto = require('crypto'), QRCode = require('qrcode'), prom = require('prom-client'), path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.JWT_SECRET || 'dev-secret';
const MONGO = process.env.MONGO_URL || 'mongodb://localhost:27017/eventhive';
const hash = p => crypto.createHash('sha256').update(p + SECRET).digest('hex'); // use bcrypt in real life

// ---------- Models (3 collections) ----------
const User = mongoose.model('User', new mongoose.Schema({
  name: String, email: { type: String, unique: true }, password: String,
  role: { type: String, default: 'student' } }));
const Event = mongoose.model('Event', new mongoose.Schema({
  name: String, date: Date, venue: String, seats: Number, booked: { type: Number, default: 0 } }));
const Ticket = mongoose.model('Ticket', new mongoose.Schema({
  ticketId: { type: String, unique: true }, event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now } }));

// ---------- Prometheus metrics ----------
prom.collectDefaultMetrics();
new prom.Gauge({ name: 'eventhive_tickets_booked', help: 'Total tickets booked',
  async collect() { this.set(await Ticket.countDocuments()); } });
new prom.Gauge({ name: 'eventhive_tickets_checked_in', help: 'Tickets checked in',
  async collect() { this.set(await Ticket.countDocuments({ used: true })); } });
new prom.Gauge({ name: 'eventhive_events_total', help: 'Total events',
  async collect() { this.set(await Event.countDocuments()); } });
app.get('/metrics', async (_, res) => { res.set('Content-Type', prom.register.contentType); res.end(await prom.register.metrics()); });
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ---------- Auth middleware ----------
const auth = (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Please login first' }); }
};
const admin = (req, res, next) => req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
const sign = u => ({ token: jwt.sign({ id: u._id, name: u.name, role: u.role }, SECRET, { expiresIn: '1d' }), user: { name: u.name, role: u.role } });

// ---------- API 1: Login / Register ----------
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  try { res.json(sign(await User.create({ name, email, password: hash(password) }))); }
  catch { res.status(400).json({ error: 'Email already registered' }); }
});
app.post('/api/login', async (req, res) => {
  const u = await User.findOne({ email: req.body.email, password: hash(req.body.password || '') });
  u ? res.json(sign(u)) : res.status(401).json({ error: 'Wrong email or password' });
});

// ---------- API 2: Events ----------
app.get('/api/events', auth, async (_, res) => res.json(await Event.find().sort({ date: 1 })));
app.post('/api/events', auth, admin, async (req, res) => {
  const { name, date, venue, seats } = req.body;
  if (!name || !date || !seats) return res.status(400).json({ error: 'Name, date and seats required' });
  res.json(await Event.create({ name, date, venue, seats: Number(seats) }));
});

// ---------- API 3: Book ticket (QR + Ticket ID) ----------
app.post('/api/events/:id/book', auth, async (req, res) => {
  if (await Ticket.findOne({ event: req.params.id, user: req.user.id }))
    return res.status(400).json({ error: 'You already booked this event' });
  const ev = await Event.findOneAndUpdate({ _id: req.params.id, $expr: { $lt: ['$booked', '$seats'] } },
    { $inc: { booked: 1 } }, { new: true });           // atomic: no overbooking
  if (!ev) return res.status(400).json({ error: 'Sold out' });
  const t = await Ticket.create({ ticketId: 'EH-' + crypto.randomBytes(4).toString('hex').toUpperCase(), event: ev._id, user: req.user.id });
  res.json({ ticketId: t.ticketId });
});
app.get('/api/my-tickets', auth, async (req, res) => {
  const list = await Ticket.find({ user: req.user.id }).populate('event').sort({ createdAt: -1 });
  res.json(await Promise.all(list.map(async t => ({ ticketId: t.ticketId, used: t.used, event: t.event,
    qr: await QRCode.toDataURL(t.ticketId, { width: 220, margin: 1 }) }))));
});

// ---------- API 4: Check-in (admin) ----------
app.post('/api/checkin', auth, admin, async (req, res) => {
  const t = await Ticket.findOne({ ticketId: (req.body.ticketId || '').trim().toUpperCase() }).populate('event').populate('user');
  if (!t) return res.json({ status: 'invalid', message: 'Invalid ticket' });
  if (t.used) return res.json({ status: 'used', message: 'Already checked in', event: t.event.name, holder: t.user.name });
  t.used = true; await t.save();
  res.json({ status: 'valid', message: 'Valid ticket – entry allowed', event: t.event.name, holder: t.user.name });
});

// ---------- Dashboard stats ----------
app.get('/api/stats', auth, admin, async (_, res) => {
  const events = await Event.find();
  res.json({ totalEvents: events.length, totalTickets: await Ticket.countDocuments(),
    checkedIn: await Ticket.countDocuments({ used: true }),
    events: events.map(e => ({ name: e.name, booked: e.booked, seats: e.seats })) });
});

// ---------- Start ----------
mongoose.connect(MONGO).then(async () => {
  if (!(await User.findOne({ role: 'admin' })))
    await User.create({ name: 'Admin', email: 'admin@eventhive.com', password: hash('admin123'), role: 'admin' });
  app.listen(process.env.PORT || 3000, () => console.log('EventHive running on :' + (process.env.PORT || 3000)));
}).catch(e => { console.error(e); process.exit(1); });
