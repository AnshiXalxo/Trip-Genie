import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'trip-genie-fallback-secret';
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

console.log('🧞 Supabase URL:', process.env.SUPABASE_URL);
console.log('🔑 Key loaded:', process.env.SUPABASE_KEY ? '✅' : '❌');

// ─────────────────────────────────────────────
// Auth Middleware
// ─────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { userId, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Helper: generate JWT
function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ═══════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert user
    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, email: email.toLowerCase(), password_hash })
      .select()
      .single();

    if (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    const token = signToken(user);
    res.status(201).json({ message: 'Account created', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Register exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════
// TRIPS ROUTES
// ═══════════════════════════════════════════════

// GET /api/trips — get all trips for current user
app.get('/api/trips', auth, async (req, res) => {
  try {
    // Get trips created by user
    const { data: ownTrips, error: e1 } = await supabase
      .from('trips')
      .select('*')
      .eq('created_by', req.user.userId)
      .order('created_at', { ascending: false });

    // Get trips user has joined
    const { data: memberRows } = await supabase
      .from('trip_members')
      .select('trip_id')
      .eq('user_id', req.user.userId);

    let joinedTrips = [];
    if (memberRows && memberRows.length > 0) {
      const tripIds = memberRows.map(r => r.trip_id);
      const { data } = await supabase
        .from('trips')
        .select('*')
        .in('id', tripIds)
        .order('created_at', { ascending: false });
      joinedTrips = data || [];
    }

    // Merge & dedupe
    const allTrips = [...(ownTrips || [])];
    const ownIds = new Set(allTrips.map(t => t.id));
    joinedTrips.forEach(t => {
      if (!ownIds.has(t.id)) allTrips.push(t);
    });

    // Map DB columns to frontend format
    const trips = allTrips.map(mapTrip);

    res.json(trips);
  } catch (err) {
    console.error('Get trips error:', err);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// POST /api/trips — create a new trip
app.post('/api/trips', auth, async (req, res) => {
  try {
    const { title, from, to, budget, people, days } = req.body;

    if (!title || !from || !to) {
      return res.status(400).json({ error: 'Title, from, and to are required' });
    }

    const { data: trip, error } = await supabase
      .from('trips')
      .insert({
        title,
        from_location: from,
        to_location: to,
        budget: budget || 0,
        people: people || 1,
        days: days || 1,
        created_by: req.user.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Create trip error:', error);
      return res.status(500).json({ error: 'Failed to create trip' });
    }

    // Auto-add creator as member
    await supabase.from('trip_members').insert({
      trip_id: trip.id,
      user_id: req.user.userId,
    });

    res.status(201).json(mapTrip(trip));
  } catch (err) {
    console.error('Create trip exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/join — join a trip by code (trip ID)
app.post('/api/trips/join', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Trip code is required' });

    // Find trip
    const { data: trip, error } = await supabase
      .from('trips')
      .select('*')
      .eq('id', code)
      .single();

    if (error || !trip) {
      return res.status(404).json({ error: 'Trip not found. Check the code and try again.' });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', trip.id)
      .eq('user_id', req.user.userId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'You are already a member of this trip' });
    }

    // Join
    await supabase.from('trip_members').insert({
      trip_id: trip.id,
      user_id: req.user.userId,
    });

    res.json({ message: 'Joined trip!', trip: mapTrip(trip) });
  } catch (err) {
    console.error('Join trip error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════
// EXPENSES ROUTES
// ═══════════════════════════════════════════════

// GET /api/trips/:tripId/expenses
app.get('/api/trips/:tripId/expenses', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', req.params.tripId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get expenses error:', error);
      return res.status(500).json({ error: 'Failed to fetch expenses' });
    }

    const expenses = (data || []).map(e => ({
      _id: e.id,
      id: e.id,
      tripId: e.trip_id,
      title: e.title,
      amount: Number(e.amount),
      paidBy: e.paid_by,
      splitBetween: e.split_between,
      createdAt: e.created_at,
    }));

    res.json(expenses);
  } catch (err) {
    console.error('Get expenses exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/:tripId/expenses
app.post('/api/trips/:tripId/expenses', auth, async (req, res) => {
  try {
    const { title, amount, paidBy, splitBetween } = req.body;

    if (!title || !amount || !paidBy) {
      return res.status(400).json({ error: 'Title, amount, and paidBy are required' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        trip_id: req.params.tripId,
        title,
        amount,
        paid_by: paidBy,
        split_between: splitBetween || 1,
        created_by: req.user.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Create expense error:', error);
      return res.status(500).json({ error: 'Failed to add expense' });
    }

    res.status(201).json({
      _id: data.id,
      id: data.id,
      tripId: data.trip_id,
      title: data.title,
      amount: Number(data.amount),
      paidBy: data.paid_by,
      splitBetween: data.split_between,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error('Create expense exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════
// MESSAGES (CHAT) ROUTES
// ═══════════════════════════════════════════════

// GET /api/trips/:tripId/messages
app.get('/api/trips/:tripId/messages', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('trip_id', req.params.tripId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Get messages error:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    const messages = (data || []).map(m => ({
      _id: m.id,
      id: m.id,
      tripId: m.trip_id,
      sender: m.sender_name,
      senderName: m.sender_name,
      text: m.text,
      isOwn: m.sender_id === req.user.userId,
      createdAt: m.created_at,
    }));

    res.json(messages);
  } catch (err) {
    console.error('Get messages exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/:tripId/messages
app.post('/api/trips/:tripId/messages', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        trip_id: req.params.tripId,
        sender_id: req.user.userId,
        sender_name: req.user.name || req.user.email,
        text: text.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Create message error:', error);
      return res.status(500).json({ error: 'Failed to send message' });
    }

    res.status(201).json({
      _id: data.id,
      id: data.id,
      tripId: data.trip_id,
      sender: data.sender_name,
      senderName: data.sender_name,
      text: data.text,
      isOwn: true,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error('Create message exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════
// MEDIA ROUTES
// ═══════════════════════════════════════════════

// GET /api/trips/:tripId/media
app.get('/api/trips/:tripId/media', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('trip_id', req.params.tripId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get media error:', error);
      return res.status(500).json({ error: 'Failed to fetch media' });
    }

    const media = (data || []).map(m => ({
      _id: m.id,
      id: m.id,
      tripId: m.trip_id,
      url: m.url,
      createdAt: m.created_at,
    }));

    res.json(media);
  } catch (err) {
    console.error('Get media exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/:tripId/media
app.post('/api/trips/:tripId/media', auth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const { data, error } = await supabase
      .from('media')
      .insert({
        trip_id: req.params.tripId,
        url,
        uploaded_by: req.user.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Create media error:', error);
      return res.status(500).json({ error: 'Failed to save media' });
    }

    res.status(201).json({
      _id: data.id,
      id: data.id,
      tripId: data.trip_id,
      url: data.url,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error('Create media exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════
// TRIP MEMBERS (for overview)
// ═══════════════════════════════════════════════
app.get('/api/trips/:tripId/members', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('trip_members')
      .select('user_id, joined_at')
      .eq('trip_id', req.params.tripId);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    // Fetch user details
    const userIds = (data || []).map(m => m.user_id);
    let members = [];

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      members = (users || []).map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));
    }

    res.json(members);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// Helper: map DB trip row to frontend format
// ─────────────────────────────────────────────
function mapTrip(t) {
  return {
    _id: t.id,
    id: t.id,
    title: t.title,
    from: t.from_location,
    to: t.to_location,
    budget: Number(t.budget),
    people: t.people,
    days: t.days,
    createdBy: t.created_by,
    createdAt: t.created_at,
  };
}

function mapItineraryItem(item) {
  return {
    _id: item.id,
    id: item.id,
    tripId: item.trip_id,
    dayNumber: item.day_number,
    timeSlot: item.time_slot,
    title: item.title,
    description: item.description,
    place: item.place,
    type: item.item_type,
    orderIndex: item.order_index,
    createdAt: item.created_at,
  };
}

// ═══════════════════════════════════════════════
// ITINERARY ROUTES
// ═══════════════════════════════════════════════

// GET /api/trips/:tripId/itinerary
app.get('/api/trips/:tripId/itinerary', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('itinerary_items')
      .select('*')
      .eq('trip_id', req.params.tripId)
      .order('day_number', { ascending: true })
      .order('order_index', { ascending: true });

    if (error) {
      console.error('Get itinerary error:', error);
      return res.status(500).json({ error: 'Failed to fetch itinerary' });
    }

    res.json((data || []).map(mapItineraryItem));
  } catch (err) {
    console.error('Get itinerary exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/:tripId/itinerary — add a single item
app.post('/api/trips/:tripId/itinerary', auth, async (req, res) => {
  try {
    const { dayNumber, timeSlot, title, description, place, type } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // get max order_index for this day
    const { data: existing } = await supabase
      .from('itinerary_items')
      .select('order_index')
      .eq('trip_id', req.params.tripId)
      .eq('day_number', dayNumber || 1)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from('itinerary_items')
      .insert({
        trip_id: req.params.tripId,
        day_number: dayNumber || 1,
        time_slot: timeSlot || 'morning',
        title,
        description: description || '',
        place: place || '',
        item_type: type || 'activity',
        order_index: nextOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Add itinerary item error:', error);
      return res.status(500).json({ error: 'Failed to add item' });
    }

    res.status(201).json(mapItineraryItem(data));
  } catch (err) {
    console.error('Add itinerary exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/trips/:tripId/itinerary/:itemId — edit an item
app.put('/api/trips/:tripId/itinerary/:itemId', auth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.place !== undefined) updates.place = req.body.place;
    if (req.body.timeSlot !== undefined) updates.time_slot = req.body.timeSlot;
    if (req.body.dayNumber !== undefined) updates.day_number = req.body.dayNumber;
    if (req.body.type !== undefined) updates.item_type = req.body.type;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('itinerary_items')
      .update(updates)
      .eq('id', req.params.itemId)
      .eq('trip_id', req.params.tripId)
      .select()
      .single();

    if (error) {
      console.error('Edit itinerary error:', error);
      return res.status(500).json({ error: 'Failed to update item' });
    }

    res.json(mapItineraryItem(data));
  } catch (err) {
    console.error('Edit itinerary exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trips/:tripId/itinerary/:itemId
app.delete('/api/trips/:tripId/itinerary/:itemId', auth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('itinerary_items')
      .delete()
      .eq('id', req.params.itemId)
      .eq('trip_id', req.params.tripId);

    if (error) {
      console.error('Delete itinerary error:', error);
      return res.status(500).json({ error: 'Failed to delete item' });
    }

    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Delete itinerary exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips/:tripId/itinerary/generate — AI generate itinerary
app.post('/api/trips/:tripId/itinerary/generate', auth, async (req, res) => {
  try {
    // Try to fetch trip from DB, fallback to request body
    let trip = null;
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', req.params.tripId)
        .single();
      if (!error && data) trip = data;
    } catch (e) {
      console.log('Could not fetch trip from DB, using request body');
    }

    // If DB failed, use request body
    if (!trip) {
      trip = {
        from_location: req.body.from || 'Home',
        to_location: req.body.to || 'Destination',
        days: req.body.days || 3,
        budget: req.body.budget || 10000,
        people: req.body.people || 2,
      };
    }

    let items = [];
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (GEMINI_KEY) {
      // ── Use Gemini AI ──
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        const budgetPerDay = Math.round(trip.budget / trip.days);
        const budgetPerPerson = Math.round(trip.budget / trip.people);
        const budgetTier = budgetPerPerson < 5000 ? 'budget' : budgetPerPerson < 15000 ? 'mid-range' : 'luxury';

        const prompt = `You are an expert Indian travel planner. Create a HIGHLY SPECIFIC and DETAILED day-by-day itinerary.

TRIP DETAILS:
- Origin: ${trip.from_location}
- Destination: ${trip.to_location}
- Duration: ${trip.days} days
- Total Budget: ₹${trip.budget} (₹${budgetPerDay}/day, ₹${budgetPerPerson}/person total)
- Travelers: ${trip.people} people
- Budget tier: ${budgetTier}

CRITICAL RULES:
1. Use REAL, SPECIFIC place names (e.g., "Amber Fort, Jaipur" not "Local Heritage Tour")
2. Include ACTUAL restaurant/cafe names for food recommendations
3. Add estimated cost in INR (₹) for EACH activity
4. Recommend SPECIFIC travel modes between locations with costs (e.g., "Auto ₹150" or "Metro ₹30" or "Cab ₹500")
5. Stay within the budget tier: ${budgetTier === 'budget' ? 'suggest street food, buses, hostels, free attractions' : budgetTier === 'mid-range' ? 'suggest mid-range restaurants, cabs/autos, 3-star hotels, paid attractions' : 'suggest fine dining, private cabs, premium hotels, VIP experiences'}
6. Include hidden gems and local favorites, not just tourist traps
7. Be practical about distances and travel times between activities

Generate a JSON array where each item has:
- dayNumber (integer 1-${trip.days})
- timeSlot ("morning", "afternoon", or "evening")
- title (activity with emoji, be SPECIFIC e.g. "🏰 Amber Fort & Jal Mahal")
- description (2-3 sentences: what to do, pro tip, what makes it special)
- place (exact place name with area/locality)
- type ("travel", "sightseeing", "food", "activity", "rest", "shopping")
- estimatedCost (string like "₹200/person" or "₹500 total" or "Free")
- travelTip (how to get there from previous activity, e.g. "Take auto from station ~₹100, 15 min" or "Walk 5 min from hotel")

Include 3-4 items per day. Day 1 should include arrival travel with specific mode and cost. Last day should include departure.

RESPOND WITH ONLY THE JSON ARRAY. NO markdown, no backticks, no explanation.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log('Gemini response received, length:', text.length);

        // Parse JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          items = JSON.parse(jsonMatch[0]);
          console.log('Parsed', items.length, 'itinerary items from AI');
        } else {
          console.log('No JSON array found in AI response, using template');
          items = generateTemplateItinerary(trip);
        }
      } catch (aiErr) {
        console.error('Gemini AI error:', aiErr.message);
        // Fall back to template
        items = generateTemplateItinerary(trip);
      }
    } else {
      // ── Fallback: smart template ──
      items = generateTemplateItinerary(trip);
    }

    // Try to save to DB (gracefully handle if table doesn't exist)
    let savedItems = items.map((item, i) => ({
      _id: `temp-${i}`,
      id: `temp-${i}`,
      tripId: req.params.tripId,
      dayNumber: item.dayNumber || 1,
      timeSlot: item.timeSlot || 'morning',
      title: item.title || 'Activity',
      description: item.description || '',
      place: item.place || '',
      type: item.type || 'activity',
      estimatedCost: item.estimatedCost || '',
      travelTip: item.travelTip || '',
      orderIndex: i,
    }));

    try {
      // Clear existing itinerary
      await supabase
        .from('itinerary_items')
        .delete()
        .eq('trip_id', req.params.tripId);

      // Insert all items
      const inserts = items.map((item, i) => ({
        trip_id: req.params.tripId,
        day_number: item.dayNumber || 1,
        time_slot: item.timeSlot || 'morning',
        title: item.title || 'Activity',
        description: item.description || '',
        place: item.place || '',
        item_type: item.type || 'activity',
        order_index: i,
      }));

      const { data: saved, error: insertErr } = await supabase
        .from('itinerary_items')
        .insert(inserts)
        .select();

      if (!insertErr && saved) {
        savedItems = saved.map(mapItineraryItem);
      } else {
        console.log('DB insert failed (table may not exist), returning memory items');
      }
    } catch (dbErr) {
      console.log('DB save failed, returning generated items from memory');
    }

    res.status(201).json(savedItems);
  } catch (err) {
    console.error('Generate itinerary exception:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// Fallback itinerary generator (no AI key)
// ─────────────────────────────────────────────
function generateTemplateItinerary(trip) {
  const dest = trip.to_location || 'destination';
  const origin = trip.from_location || 'home';
  const days = trip.days || 3;
  const budget = trip.budget || 10000;
  const people = trip.people || 2;
  const perDay = Math.round(budget / days);
  const perPerson = Math.round(budget / people);
  const tier = perPerson < 5000 ? 'budget' : perPerson < 15000 ? 'mid-range' : 'luxury';
  const items = [];

  // Budget-aware travel options
  const travelMode = tier === 'budget'
    ? { mode: '🚌 Bus/Train (Sleeper)', cost: `₹${Math.round(budget * 0.15)}/person` }
    : tier === 'mid-range'
    ? { mode: '🚂 Train (AC 3-Tier) or ✈️ Budget Flight', cost: `₹${Math.round(budget * 0.2)}/person` }
    : { mode: '✈️ Flight (Non-stop) or 🚗 Private Car', cost: `₹${Math.round(budget * 0.25)}/person` };

  const stayType = tier === 'budget' ? 'hostel/budget hotel' : tier === 'mid-range' ? '3-star hotel' : 'premium resort/hotel';
  const foodBudget = tier === 'budget' ? '₹200-400/meal' : tier === 'mid-range' ? '₹500-1000/meal' : '₹1500+/meal';

  for (let day = 1; day <= days; day++) {
    if (day === 1) {
      items.push({
        dayNumber: day, timeSlot: 'morning',
        title: `${travelMode.mode.split(' ')[0]} Travel: ${origin} → ${dest}`,
        description: `Board ${travelMode.mode} from ${origin} to ${dest}. ${tier === 'budget' ? 'Book in advance on IRCTC/RedBus for best prices.' : tier === 'mid-range' ? 'Book via MakeMyTrip/IRCTC for deals.' : 'Pre-book premium seats for comfort.'}`,
        place: origin, type: 'travel',
        estimatedCost: travelMode.cost,
        travelTip: `${travelMode.mode} — book 2-3 weeks early for best fares`
      });
      items.push({
        dayNumber: day, timeSlot: 'afternoon',
        title: `🏨 Check in & Nearby Exploration`,
        description: `Check into your ${stayType} in ${dest}. Freshen up and explore the nearby streets, markets, and local vibe on foot.`,
        place: `${dest} city center`, type: 'activity',
        estimatedCost: tier === 'budget' ? '₹500-800/night' : tier === 'mid-range' ? '₹1500-3000/night' : '₹5000+/night',
        travelTip: `Take ${tier === 'budget' ? 'auto/shared cab ₹100-200' : tier === 'mid-range' ? 'Ola/Uber ₹200-400' : 'pre-booked cab ₹500-800'} from station/airport`
      });
      items.push({
        dayNumber: day, timeSlot: 'evening',
        title: `🍽️ Local Welcome Dinner`,
        description: `Try the signature cuisine of ${dest}. ${tier === 'budget' ? 'Hit up the famous street food stalls — ask locals for the best ones!' : tier === 'mid-range' ? 'Visit a popular local restaurant for authentic flavors.' : 'Fine dining experience with regional specialties.'}`,
        place: `Popular food area, ${dest}`, type: 'food',
        estimatedCost: foodBudget,
        travelTip: `Walk or auto ₹50-100 from hotel`
      });
    } else if (day === days) {
      items.push({
        dayNumber: day, timeSlot: 'morning',
        title: `☕ Breakfast & Last Memories`,
        description: `Enjoy a leisurely breakfast at a local cafe. Pack up and check out. Visit any nearby spots you missed.`,
        place: `Near hotel, ${dest}`, type: 'food',
        estimatedCost: `₹${tier === 'budget' ? '100-200' : tier === 'mid-range' ? '300-500' : '800-1200'}`,
        travelTip: `Walk from hotel`
      });
      items.push({
        dayNumber: day, timeSlot: 'afternoon',
        title: `🛍️ Souvenir Shopping`,
        description: `Pick up local handicrafts, spices, or specialty items from ${dest}. ${tier === 'budget' ? 'Bargain hard at local markets!' : 'Check both local markets and curated stores.'}`,
        place: `Main market, ${dest}`, type: 'shopping',
        estimatedCost: `₹${tier === 'budget' ? '200-500' : tier === 'mid-range' ? '500-1500' : '2000-5000'}`,
        travelTip: `Auto ₹50-150 from hotel`
      });
      items.push({
        dayNumber: day, timeSlot: 'evening',
        title: `${travelMode.mode.split(' ')[0]} Return: ${dest} → ${origin}`,
        description: `Head back to ${origin} with amazing memories! ${tier === 'budget' ? 'Carry packed snacks to save on travel food.' : 'Relax and enjoy the journey back.'}`,
        place: `${dest} station/airport`, type: 'travel',
        estimatedCost: travelMode.cost,
        travelTip: `Leave 1-2 hours early to account for traffic — ${tier === 'budget' ? 'auto/bus ₹50-150' : 'cab ₹200-500'} to station`
      });
    } else {
      // Middle days — exploration
      const dayIndex = day - 2;
      const mornings = [
        { title: `🌅 Iconic Landmark Visit`, desc: `Visit the most famous landmark of ${dest}. Go early to avoid crowds and get the best photos. Most popular spots open by 6-7 AM.`, cost: tier === 'budget' ? '₹50-100 entry' : '₹100-500 entry' },
        { title: `🏛️ Heritage & History Walk`, desc: `Explore historical monuments and architecture of ${dest}. Hire a local guide for ₹200-500 — they know stories you won't find online!`, cost: '₹200-500/person' },
        { title: `📸 Sunrise at Scenic Point`, desc: `Wake up early for sunrise at the most beautiful viewpoint near ${dest}. This is the golden hour for photography!`, cost: 'Free - ₹100' },
        { title: `🧘 Local Morning Experience`, desc: `Join a local morning activity — temple visit, yoga session, or nature walk. Experience ${dest} like the locals do.`, cost: 'Free - ₹300' },
      ];
      const afternoons = [
        { title: `🏔️ Nature / Day Trip`, desc: `Take a half-day excursion to natural attractions near ${dest}. Pack water and snacks. ${tier === 'budget' ? 'Use local buses ₹30-100.' : 'Book a day tour ₹500-2000.'}`, cost: tier === 'budget' ? '₹100-400' : '₹500-2000' },
        { title: `🎭 Museum / Cultural Spot`, desc: `Visit a museum, art gallery, or cultural center. Most are open till 5 PM. ${dest} has unique cultural gems most tourists miss!`, cost: '₹50-300/person' },
        { title: `🚤 Adventure Activity`, desc: `Try local adventure sports or activities — boating, trekking, cycling, or water sports depending on what ${dest} offers.`, cost: tier === 'budget' ? '₹200-600' : '₹500-2000' },
        { title: `🛍️ Local Market Exploration`, desc: `Browse the famous markets of ${dest} for local goods, handicrafts, and street food. Best prices in afternoon — bargain!`, cost: 'Variable' },
      ];
      const evenings = [
        { title: `🌆 Sunset & Evening Stroll`, desc: `Watch sunset from a scenic spot, then stroll through the evening markets and food streets. ${dest} comes alive at night!`, cost: 'Free' },
        { title: `🎵 Live Culture Experience`, desc: `Catch a local cultural performance, live music, or traditional show. Ask your hotel — they usually know the best ones.`, cost: '₹200-1000/person' },
        { title: `🌙 Night Food Trail`, desc: `Explore the famous night food scene of ${dest}. Street food and late-night eateries serve the most authentic flavors.`, cost: foodBudget },
        { title: `🍷 Rooftop & Chill`, desc: `End the day at a rooftop cafe or lakeside spot with views. Perfect for winding down and planning tomorrow!`, cost: tier === 'budget' ? '₹150-400' : '₹500-1500' },
      ];

      const m = mornings[dayIndex % mornings.length];
      const a = afternoons[dayIndex % afternoons.length];
      const ev = evenings[dayIndex % evenings.length];

      items.push({
        dayNumber: day, timeSlot: 'morning', title: m.title, description: m.desc,
        place: `${dest}`, type: 'sightseeing', estimatedCost: m.cost,
        travelTip: `${tier === 'budget' ? 'Walk / auto ₹50-100' : 'Cab ₹150-300'} from hotel`
      });
      items.push({
        dayNumber: day, timeSlot: 'afternoon', title: `🍜 Lunch at Local Spot`,
        description: `${tier === 'budget' ? 'Try famous street food and thali places. Ask locals for the best affordable eats!' : tier === 'mid-range' ? 'Visit a popular rated restaurant for regional cuisine.' : 'Reserve a table at a top-rated restaurant for a premium dining experience.'}`,
        place: `${dest}`, type: 'food', estimatedCost: foodBudget,
        travelTip: `Walk or auto ₹30-80 from morning spot`
      });
      items.push({
        dayNumber: day, timeSlot: 'afternoon', title: a.title, description: a.desc,
        place: `Near ${dest}`, type: 'activity', estimatedCost: a.cost,
        travelTip: `${tier === 'budget' ? 'Local bus ₹20-60 / shared auto ₹50' : 'Ola/Uber ₹150-400'}`
      });
      items.push({
        dayNumber: day, timeSlot: 'evening', title: ev.title, description: ev.desc,
        place: `${dest}`, type: ev.title.includes('Food') ? 'food' : 'activity', estimatedCost: ev.cost,
        travelTip: `${tier === 'budget' ? 'Walk or auto ₹50' : 'Short cab ₹100-200'} back to hotel area`
      });
    }
  }

  return items;
}

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🧞 Trip Genie API running on http://localhost:${PORT}`);
  console.log(`   Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ Enabled' : '⚠️ Disabled (using template fallback)'}`);
  console.log(`   Routes:`);
  console.log(`   POST /api/auth/register`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/trips`);
  console.log(`   POST /api/trips`);
  console.log(`   POST /api/trips/join`);
  console.log(`   GET  /api/trips/:id/expenses`);
  console.log(`   POST /api/trips/:id/expenses`);
  console.log(`   GET  /api/trips/:id/messages`);
  console.log(`   POST /api/trips/:id/messages`);
  console.log(`   GET  /api/trips/:id/media`);
  console.log(`   POST /api/trips/:id/media`);
  console.log(`   GET  /api/trips/:id/members`);
  console.log(`   GET  /api/trips/:id/itinerary`);
  console.log(`   POST /api/trips/:id/itinerary`);
  console.log(`   PUT  /api/trips/:id/itinerary/:itemId`);
  console.log(`   DEL  /api/trips/:id/itinerary/:itemId`);
  console.log(`   POST /api/trips/:id/itinerary/generate\n`);
});

