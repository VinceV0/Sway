// Hardware-accelerated WebCrypto password hashing (bypasses Worker CPU timeout)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 1000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedPassword) {
  if (!storedPassword) return false;

  if (storedPassword.startsWith('pbkdf2:')) {
    const [, saltHex, originalHashHex] = storedPassword.split(':');
    const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 1000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === originalHashHex;
  }

  // Fallback for existing bcrypt hashes
  try {
    const bcrypt = await import('bcryptjs');
    return await bcrypt.compare(password, storedPassword);
  } catch {
    return false;
  }
}

let cachedDb = null;

async function getDatabase(env) {
  if (cachedDb) {
    return cachedDb;
  }

  const uri = env.MONGO_URI || env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGO_URI secret is missing.');
  }

  console.log('Connecting to MongoDB Atlas...');
  const { MongoClient } = await import('mongodb');
  
  const client = new MongoClient(uri, {
    maxPoolSize: 1,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 4000,
    connectTimeoutMS: 4000,
    socketTimeoutMS: 5000,
  });

  // Timeout guard to prevent worker hang
  const connectPromise = client.connect();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('MongoDB connection timed out after 4s. Check if 0.0.0.0/0 is whitelisted in MongoDB Atlas Network Access.')), 4000)
  );

  await Promise.race([connectPromise, timeoutPromise]);
  console.log('Successfully connected to MongoDB Atlas!');

  const dbName = env.MONGODB_DATABASE || 'Sway';
  cachedDb = client.db(dbName);
  return cachedDb;
}

const handler = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const db = await getDatabase(env);
      const usersCollection = db.collection('users');
      const tracksCollection = db.collection('tracks');
      const playlistsCollection = db.collection('playlists');
      const favoritesCollection = db.collection('favorites');
      const followedArtistsCollection = db.collection('followedArtists');

      // --- SIGN UP ---
      if ((url.pathname === '/api/signup' || url.pathname === '/api/signup/listener' || url.pathname === '/api/signup/artist') && request.method === 'POST') {
        const data = await request.json().catch(() => ({}));
        const name = data.name || '';
        const email = data.email || '';
        const password = data.password || '';
        const role = data.role || (url.pathname.includes('artist') ? 'artist' : 'listener');
        const genre = data.genre || 'Alternative';

        const cleanEmail = email.toLowerCase().trim();
        const existingUser = await usersCollection.findOne({ email: cleanEmail });
        if (existingUser) {
          return new Response(JSON.stringify({ message: 'Email already in use' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = {
          name: name.trim(),
          artist_name: name.trim(),
          email: cleanEmail,
          password: hashedPassword,
          role,
          genre,
          image: '',
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        return new Response(JSON.stringify({ 
          success: true,
          message: 'User created successfully',
          insertedId: result.insertedId 
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- SIGN IN / LOGIN ---
      if ((url.pathname === '/api/signin' || url.pathname === '/api/login') && request.method === 'POST') {
        const { email, password } = await request.json();

        const cleanEmail = email.toLowerCase().trim();
        const user = await usersCollection.findOne({ email: cleanEmail });
        if (!user) {
          return new Response(JSON.stringify({ message: 'Invalid email or password' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const isMatch = await verifyPassword(password, user.password);
        if (!isMatch) {
          return new Response(JSON.stringify({ message: 'Invalid email or password' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Signed in successfully',
          email: user.email,
          name: user.name,
          role: user.role,
          user: { name: user.name, email: user.email, role: user.role, image: user.image || '' }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- USER PROFILE ---
      if ((url.pathname.startsWith('/api/users/') || url.pathname.startsWith('/api/user/')) && request.method === 'GET') {
        const emailParam = decodeURIComponent(url.pathname.replace(/^\/api\/users\/|\/api\/user\//, ''));
        const user = await usersCollection.findOne({ email: emailParam.toLowerCase().trim() });
        if (!user) {
          return new Response(JSON.stringify({ message: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify({
          name: user.name,
          email: user.email,
          role: user.role,
          genre: user.genre,
          image: user.image || ''
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- TRACKS ---
      if (url.pathname === '/api/tracks' && request.method === 'GET') {
        const rawTracks = await tracksCollection.find({}).toArray();
        const tracks = rawTracks.map(t => ({ ...t, _id: t._id.toString() }));
        return new Response(JSON.stringify(tracks), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- ARTISTS ---
      if (url.pathname === '/api/artists' && request.method === 'GET') {
        const rawUsers = await usersCollection.find({
          role: { $regex: '^artist$', $options: 'i' }
        }).toArray();

        let rawArtistsCol = [];
        try {
          rawArtistsCol = await db.collection('artists').find({}).toArray();
        } catch (e) {
          rawArtistsCol = [];
        }

        const combined = [...rawArtistsCol, ...rawUsers];
        const seen = new Set();
        const artists = [];

        for (const u of combined) {
          const role = (u.role || '').toLowerCase().trim();
          if (role && role === 'listener') continue;

          const name = u.name || u.artist_name || u.artist;
          if (!name) continue;
          const cleanKey = name.toLowerCase().trim();
          if (seen.has(cleanKey)) continue;
          seen.add(cleanKey);

          const img = u.profile_pic || u.image_url || u.image || u.cover_art_url || u.avatar || '';
          artists.push({
            id: u._id.toString(),
            _id: u._id.toString(),
            name,
            artist_name: name,
            role: 'artist',
            email: u.email || '',
            image: img,
            image_url: img,
            profile_pic: img,
            bio: u.bio || u.description || '',
            genre: u.genre || 'Alternative'
          });
        }

        return new Response(JSON.stringify(artists), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- PLAYLISTS ---
      if (url.pathname.startsWith('/api/playlists') && request.method === 'GET') {
        const userEmail = url.pathname.replace('/api/playlists/', '').replace('/api/playlists', '');
        const query = userEmail ? { user_email: decodeURIComponent(userEmail) } : {};
        const rawPlaylists = await playlistsCollection.find(query).toArray();
        const playlists = rawPlaylists.map(p => ({ ...p, id: p._id.toString(), _id: p._id.toString() }));
        return new Response(JSON.stringify(playlists), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (url.pathname === '/api/playlists' && request.method === 'POST') {
        const { name, trackIds, user_email } = await request.json();
        const newPlaylist = { name, trackIds: trackIds || [], user_email };
        const result = await playlistsCollection.insertOne(newPlaylist);
        return new Response(JSON.stringify({ id: result.insertedId.toString(), ...newPlaylist }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- FAVORITES ---
      if (url.pathname.startsWith('/api/favorites/') && request.method === 'GET') {
        const userEmail = decodeURIComponent(url.pathname.replace('/api/favorites/', ''));
        const fav = await favoritesCollection.findOne({ user_email: userEmail });
        return new Response(JSON.stringify(fav ? fav.trackIds || [] : []), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (url.pathname === '/api/favorites/toggle' && request.method === 'POST') {
        const { user_email, trackId } = await request.json();
        const fav = await favoritesCollection.findOne({ user_email });
        let trackIds = fav ? fav.trackIds || [] : [];
        if (trackIds.includes(trackId)) {
          trackIds = trackIds.filter(id => id !== trackId);
        } else {
          trackIds.push(trackId);
        }
        await favoritesCollection.updateOne(
          { user_email },
          { $set: { trackIds } },
          { upsert: true }
        );
        return new Response(JSON.stringify({ status: 'success', trackIds }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- FOLLOWS ---
      if (url.pathname.startsWith('/api/follows/') && request.method === 'GET') {
        const userEmail = decodeURIComponent(url.pathname.replace('/api/follows/', ''));
        const doc = await followedArtistsCollection.findOne({ user_email: userEmail });
        return new Response(JSON.stringify(doc ? doc.artists || [] : []), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (url.pathname === '/api/follows/toggle' && request.method === 'POST') {
        const { user_email, artist_name } = await request.json();
        const doc = await followedArtistsCollection.findOne({ user_email });
        let artists = doc ? doc.artists || [] : [];
        if (artists.includes(artist_name)) {
          artists = artists.filter(a => a !== artist_name);
        } else {
          artists.push(artist_name);
        }
        await followedArtistsCollection.updateOne(
          { user_email },
          { $set: { artists } },
          { upsert: true }
        );
        return new Response(JSON.stringify({ status: 'success', followed_artists: artists }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- SEARCH ---
      if (url.pathname === '/api/search' && request.method === 'GET') {
        const q = (url.searchParams.get('q') || '').toLowerCase().trim();
        if (!q) {
          return new Response(JSON.stringify({ tracks: [], artists: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const tracks = await tracksCollection.find({
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { artist_name: { $regex: q, $options: 'i' } },
            { genre: { $regex: q, $options: 'i' } }
          ]
        }).toArray();
        const artists = await usersCollection.find({
          role: 'artist',
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { artist_name: { $regex: q, $options: 'i' } },
            { genre: { $regex: q, $options: 'i' } }
          ]
        }).toArray();

        return new Response(JSON.stringify({
          tracks: tracks.map(t => ({ ...t, _id: t._id.toString() })),
          artists: artists.map(a => ({
            id: a._id.toString(),
            _id: a._id.toString(),
            name: a.name || a.artist_name,
            genre: a.genre || 'Alternative',
            image: a.image || 'https://via.placeholder.com/300'
          }))
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- ARTIST POSTS ---
      if (url.pathname.startsWith('/api/artists/') && url.pathname.includes('/posts')) {
        const artistPostsCollection = db.collection('artist_posts');
        const { ObjectId } = await import('mongodb');

        const deleteMatch = url.pathname.match(/^\/api\/artists\/([^\/]+)\/posts\/([^\/]+)$/);
        if (deleteMatch && request.method === 'DELETE') {
          const postId = deleteMatch[2];
          let query = {};
          if (ObjectId.isValid(postId)) {
            query._id = new ObjectId(postId);
          } else {
            query.id = postId;
          }

          await artistPostsCollection.deleteOne(query);
          return new Response(JSON.stringify({ success: true, message: 'Post deleted successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const rawArtistParam = decodeURIComponent(url.pathname.replace('/api/artists/', '').replace('/posts', '').replace(/\/$/, ''));

        let queryUser = {};
        if (ObjectId.isValid(rawArtistParam)) {
          queryUser = { _id: new ObjectId(rawArtistParam) };
        } else {
          queryUser = {
            $or: [
              { name: { $regex: `^${rawArtistParam}$`, $options: 'i' } },
              { artist_name: { $regex: `^${rawArtistParam}$`, $options: 'i' } }
            ]
          };
        }
        const artistUser = await usersCollection.findOne(queryUser);
        const canonicalName = artistUser ? (artistUser.name || artistUser.artist_name) : rawArtistParam;
        const canonicalId = artistUser ? artistUser._id.toString() : rawArtistParam;

        if (request.method === 'GET') {
          const posts = await artistPostsCollection.find({
            $or: [
              { artist_name: { $regex: `^${canonicalName}$`, $options: 'i' } },
              { artist_id: canonicalId },
              { artist_name: { $regex: `^${rawArtistParam}$`, $options: 'i' } },
              { artist_id: rawArtistParam }
            ]
          }).sort({ _id: -1 }).toArray();

          const formatted = posts.map(p => ({
            id: p._id.toString(),
            _id: p._id.toString(),
            artist_name: p.artist_name || canonicalName,
            text: p.text || '',
            category: p.category || p.tag || 'Studio Update',
            tag: p.category || p.tag || 'Studio Update',
            tags: p.tags || '',
            time: p.time || 'Recently',
            created_at: p.created_at || ''
          }));

          return new Response(JSON.stringify(formatted), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const text = (body.text || '').trim();
          if (!text) {
            return new Response(JSON.stringify({ message: 'Post text is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const newDoc = {
            artist_name: canonicalName,
            artist_id: canonicalId,
            text,
            category: body.category || body.tag || 'Studio Update',
            tag: body.category || body.tag || 'Studio Update',
            tags: body.tags || '',
            time: 'Just now',
            created_at: new Date().toISOString()
          };

          const result = await artistPostsCollection.insertOne(newDoc);
          return new Response(JSON.stringify({
            id: result.insertedId.toString(),
            _id: result.insertedId.toString(),
            ...newDoc
          }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // --- DELETE ARTIST POST ---
      if (url.pathname.startsWith('/api/artists/') && url.pathname.includes('/posts/') && request.method === 'DELETE') {
        const artistPostsCollection = db.collection('artist_posts');
        const parts = url.pathname.split('/');
        const postId = parts[parts.length - 1];

        const { ObjectId } = await import('mongodb');
        let query;
        try {
          query = { _id: new ObjectId(postId) };
        } catch (e) {
          query = { id: postId };
        }

        await artistPostsCollection.deleteOne(query);
        return new Response(JSON.stringify({ status: 'success', message: 'Post deleted' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- ARTIST DIRECT CHAT ---
      if (url.pathname.startsWith('/api/artists/') && (url.pathname.endsWith('/messages') || url.pathname.includes('/messages/'))) {
        const artistChatsCollection = db.collection('artist_chats');
        const { ObjectId } = await import('mongodb');
        const rawArtistParam = decodeURIComponent(url.pathname.replace('/api/artists/', '').replace(/\/messages\/?$/, '').replace(/\/$/, ''));

        let queryUser = {};
        if (ObjectId.isValid(rawArtistParam)) {
          queryUser = { _id: new ObjectId(rawArtistParam) };
        } else {
          queryUser = {
            $or: [
              { name: { $regex: `^${rawArtistParam}$`, $options: 'i' } },
              { artist_name: { $regex: `^${rawArtistParam}$`, $options: 'i' } }
            ]
          };
        }
        const artistUser = await usersCollection.findOne(queryUser);
        const canonicalName = artistUser ? (artistUser.name || artistUser.artist_name) : rawArtistParam;
        const canonicalId = artistUser ? artistUser._id.toString() : rawArtistParam;

        if (request.method === 'GET') {
          const userEmail = url.searchParams.get('user_email');
          const cleanParam = canonicalName.replace(/[^a-zA-Z0-9]/g, '');

          let query = {
            $or: [
              { artist_name: { $regex: `^${canonicalName}$`, $options: 'i' } },
              { artist_name: { $regex: `.*${cleanParam}.*`, $options: 'i' } },
              { artist_id: canonicalId },
              { artist_name: { $regex: `^${rawArtistParam}$`, $options: 'i' } },
              { artist_id: rawArtistParam }
            ]
          };

          if (userEmail && userEmail.trim()) {
            const cleanEmail = userEmail.toLowerCase().trim();
            query = {
              $and: [
                query,
                { user_email: cleanEmail }
              ]
            };
          }

          const messages = await artistChatsCollection.find(query).sort({ _id: 1 }).toArray();
          const userCache = new Map();
          const artistCache = new Map();

          const formatted = await Promise.all(messages.map(async (m) => {
            const sender = m.sender || 'user';
            const mUserEmail = (m.user_email || '').toLowerCase().trim();
            let senderName = (m.sender_name || '').trim();
            let senderImage = m.sender_image || m.profile_pic || '';

            if (sender === 'user' && mUserEmail) {
              if (!userCache.has(mUserEmail)) {
                const uDoc = await usersCollection.findOne({ email: mUserEmail });
                userCache.set(mUserEmail, uDoc);
              }
              const uDoc = userCache.get(mUserEmail);
              if (uDoc) {
                const realName = uDoc.name || uDoc.artist_name;
                if (realName) senderName = realName;
                if (!senderImage) senderImage = uDoc.image || uDoc.profile_pic || '';
              }
            } else if (sender === 'artist') {
              const artName = m.artist_name || canonicalName;
              if (!artistCache.has(artName)) {
                const artDoc = await usersCollection.findOne({
                  $or: [
                    { artist_name: { $regex: `^${artName}$`, $options: 'i' } },
                    { name: { $regex: `^${artName}$`, $options: 'i' } }
                  ]
                });
                artistCache.set(artName, artDoc);
              }
              const artDoc = artistCache.get(artName);
              if (artDoc) {
                const realArtName = artDoc.artist_name || artDoc.name;
                if (realArtName) senderName = realArtName;
                if (!senderImage) senderImage = artDoc.image || artDoc.profile_pic || '';
              } else if (!senderName) {
                senderName = artName;
              }
            }

            if (!senderName || senderName === 'You' || senderName.includes('@')) {
              if (mUserEmail && userCache.has(mUserEmail) && userCache.get(mUserEmail)) {
                const u = userCache.get(mUserEmail);
                senderName = u.name || u.artist_name || mUserEmail.split('@')[0];
              } else if (senderName && senderName.includes('@')) {
                senderName = senderName.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              } else {
                senderName = sender === 'artist' ? (m.artist_name || canonicalName) : 'User';
              }
            }

            return {
              id: m._id.toString(),
              _id: m._id.toString(),
              artist_name: m.artist_name || canonicalName,
              user_email: mUserEmail,
              sender: sender,
              sender_name: senderName,
              sender_image: senderImage,
              profile_pic: senderImage,
              text: m.text || '',
              time: m.time || 'Just now',
              timestamp: m.timestamp || m.created_at || ''
            };
          }));

          return new Response(JSON.stringify(formatted), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          console.log('Incoming chat POST payload:', body);

          const text = (body.text || '').trim();
          if (!text) {
            return new Response(JSON.stringify({ message: 'Message text is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const userEmail = (body.user_email || body.email || '').toLowerCase().trim();
          if (!userEmail) {
            return new Response(JSON.stringify({ message: 'User account email is required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          let senderName = (body.sender_name || '').trim();
          let senderImage = body.sender_image || body.profile_pic || '';

          if (body.sender === 'artist') {
            const artDoc = await usersCollection.findOne({
              $or: [
                { artist_name: { $regex: `^${canonicalName}$`, $options: 'i' } },
                { name: { $regex: `^${canonicalName}$`, $options: 'i' } }
              ]
            });
            if (artDoc) {
              senderName = artDoc.artist_name || artDoc.name || canonicalName;
              senderImage = artDoc.image || artDoc.profile_pic || senderImage;
            } else {
              senderName = canonicalName;
            }
          } else {
            const uDoc = await usersCollection.findOne({ email: userEmail });
            if (uDoc) {
              senderName = uDoc.name || uDoc.artist_name || senderName;
              senderImage = uDoc.image || uDoc.profile_pic || senderImage;
            }
          }

          if (!senderName || senderName === 'You' || senderName.includes('@')) {
            senderName = userEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }

          const newDoc = {
            artist_name: canonicalName,
            artist_id: canonicalId,
            user_email: userEmail,
            sender: body.sender || 'user',
            sender_name: senderName,
            sender_image: senderImage,
            profile_pic: senderImage,
            text,
            time: body.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
            read: false,
            timestamp: new Date().toISOString()
          };

          const result = await artistChatsCollection.insertOne(newDoc);
          console.log('Successfully inserted message into MongoDB:', result.insertedId);

          return new Response(JSON.stringify({
            id: result.insertedId.toString(),
            _id: result.insertedId.toString(),
            ...newDoc
          }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
      }

      // --- USER ALL CONVERSATIONS LIST ---
      if (url.pathname.startsWith('/api/chats/user/') && request.method === 'GET') {
        const emailParam = decodeURIComponent(url.pathname.replace('/api/chats/user/', '').replace(/\/$/, '')).toLowerCase().trim();
        if (!emailParam) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const userDoc = await usersCollection.findOne({ email: emailParam });
        const artistNames = [];
        if (userDoc) {
          if (userDoc.name) artistNames.push(userDoc.name.trim());
          if (userDoc.artist_name) artistNames.push(userDoc.artist_name.trim());
        }

        const orClauses = [{ user_email: emailParam }];
        for (const aName of artistNames) {
          orClauses.push({ artist_name: { $regex: `^${aName}$`, $options: 'i' } });
        }

        const artistChatsCollection = db.collection('artist_chats');
        const allMsgs = await artistChatsCollection.find({ $or: orClauses }).sort({ _id: 1 }).toArray();

        const conversationsMap = new Map();
        const userCache = new Map();
        const artistCache = new Map();

        for (const m of allMsgs) {
          const mArtist = (m.artist_name || '').trim();
          const mListenerEmail = (m.user_email || '').toLowerCase().trim();
          if (!mArtist || !mListenerEmail) continue;

          const threadKey = `${mArtist.toLowerCase()}__${mListenerEmail}`;
          const isLoggedInAsArtist = artistNames.some(a => a.toLowerCase() === mArtist.toLowerCase());

          let otherName = '';
          let otherImage = '';
          let otherRole = 'listener';

          if (isLoggedInAsArtist) {
            // Logged-in user is the artist; the other party is the listener
            otherRole = 'listener';
            if (!userCache.has(mListenerEmail)) {
              const u = await usersCollection.findOne({ email: mListenerEmail });
              userCache.set(mListenerEmail, u);
            }
            const uInfo = userCache.get(mListenerEmail);
            if (uInfo) {
              otherName = uInfo.name || uInfo.artist_name || '';
              otherImage = uInfo.image || uInfo.profile_pic || '';
            }
            if (!otherName) {
              const sName = (m.sender === 'user') ? m.sender_name : '';
              otherName = (sName && sName !== 'You' && !sName.includes('@')) 
                ? sName 
                : mListenerEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            }
            if (!otherImage && m.sender === 'user') {
              otherImage = m.sender_image || m.profile_pic || '';
            }
          } else {
            // Logged-in user is the listener; the other party is the artist
            otherRole = 'artist';
            otherName = mArtist;
            if (!artistCache.has(mArtist)) {
              const artDoc = await usersCollection.findOne({
                $or: [
                  { artist_name: { $regex: `^${mArtist}$`, $options: 'i' } },
                  { name: { $regex: `^${mArtist}$`, $options: 'i' } }
                ]
              });
              artistCache.set(mArtist, artDoc);
            }
            const artDoc = artistCache.get(mArtist);
            if (artDoc) {
              otherName = artDoc.artist_name || artDoc.name || mArtist;
              otherImage = artDoc.image || artDoc.profile_pic || '';
            }
            if (!otherImage && m.sender === 'artist') {
              otherImage = m.sender_image || m.profile_pic || '';
            }
          }

          const isoTime = m.timestamp || m.created_at || '';
          conversationsMap.set(threadKey, {
            id: threadKey,
            artist_name: mArtist,
            listener_email: mListenerEmail,
            is_artist_view: isLoggedInAsArtist,
            other_name: otherName || (otherRole === 'artist' ? mArtist : 'Fan'),
            other_image: otherImage || '',
            other_role: otherRole,
            last_message: m.text || '',
            last_time: m.time || 'Recently',
            timestamp: isoTime,
            unread: !m.read && (
              (isLoggedInAsArtist && m.sender === 'user') ||
              (!isLoggedInAsArtist && m.sender === 'artist')
            )
          });
        }

        const threadsList = Array.from(conversationsMap.values());
        threadsList.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

        return new Response(JSON.stringify(threadsList), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- USER NOTIFICATIONS ---
      if (url.pathname === '/api/notifications' && request.method === 'GET') {
        const userEmail = url.searchParams.get('user_email');
        if (!userEmail) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const cleanEmail = userEmail.toLowerCase().trim();
        const userDoc = await usersCollection.findOne({ email: cleanEmail });
        const artistNames = [];
        if (userDoc) {
          if (userDoc.name) artistNames.push(userDoc.name);
          if (userDoc.artist_name) artistNames.push(userDoc.artist_name);
        }

        const orClauses = [
          { user_email: cleanEmail, sender: 'artist' }
        ];
        for (const a of artistNames) {
          orClauses.push({ artist_name: { $regex: `^${a}$`, $options: 'i' }, sender: 'user' });
        }

        const artistChatsCollection = db.collection('artist_chats');
        const notifs = await artistChatsCollection.find({ $or: orClauses }).sort({ _id: -1 }).limit(10).toArray();

        const formatted = await Promise.all(notifs.map(async (n) => {
          let senderImage = n.sender_image || n.profile_pic || '';
          let senderName = n.sender_name || 'Artist';
          if (n.sender === 'artist' && n.artist_name) {
            const artDoc = await usersCollection.findOne({
              $or: [
                { artist_name: { $regex: `^${n.artist_name}$`, $options: 'i' } },
                { name: { $regex: `^${n.artist_name}$`, $options: 'i' } }
              ]
            });
            if (artDoc) {
              senderImage = artDoc.profile_pic || artDoc.image || senderImage;
              senderName = artDoc.artist_name || artDoc.name || senderName;
            }
          } else if (n.sender === 'user' && n.user_email) {
            const uDoc = await usersCollection.findOne({ email: n.user_email.toLowerCase().trim() });
            if (uDoc) {
              senderImage = uDoc.profile_pic || uDoc.image || senderImage;
              senderName = uDoc.name || uDoc.artist_name || senderName;
            }
          }
          return {
            id: n._id.toString(),
            _id: n._id.toString(),
            artist_name: n.artist_name,
            sender_name: senderName,
            sender_image: senderImage,
            profile_pic: senderImage,
            user_email: n.user_email,
            sender: n.sender,
            text: n.text || '',
            time: n.time || 'Recently',
            read: n.read || false,
            unread: !n.read
          };
        }));

        return new Response(JSON.stringify(formatted), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (url.pathname === '/api/notifications/clear' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const userEmail = (body.user_email || '').toLowerCase().trim();
        if (userEmail) {
          const artistChatsCollection = db.collection('artist_chats');
          await artistChatsCollection.updateMany(
            { $or: [{ user_email: userEmail }, { sender: 'artist' }] },
            { $set: { read: true } }
          );
        }

        return new Response(JSON.stringify({ status: 'success', message: 'Notifications cleared' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // --- USERS LIST ---
if (url.pathname === '/api/users' && request.method === 'GET') {
  const allUsers = await usersCollection.find({}).toArray();
  const result = allUsers.map(u => ({
    name: u.name || u.artist_name || '',
    email: u.email || '',
    role: u.role || '',
    image: u.image || u.profile_pic || ''
  }));
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// --- USER CHATS LIST FOR A USER ---
if (url.pathname === '/api/user_chats' && request.method === 'GET') {
  const userEmail = url.searchParams.get('user_email');
  if (!userEmail) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const cleanEmail = userEmail.toLowerCase().trim();
  const chats = await db.collection('user_chats').distinct('chat_id', {
    $or: [{ sender_email: cleanEmail }, { recipient_email: cleanEmail }]
  });
  return new Response(JSON.stringify(chats), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// --- USER DIRECT CHAT MESSAGES ---
if (url.pathname.startsWith('/api/chats/') && (url.pathname.endsWith('/messages') || url.pathname.includes('/messages/'))) {
  const chatsCol = db.collection('user_chats');
  const chatId = decodeURIComponent(url.pathname.replace('/api/chats/', '').replace(/\/messages\/?$/, ''));

  if (request.method === 'GET') {
    const messages = await chatsCol.find({ chat_id: chatId }).sort({ _id: 1 }).toArray();
    const formatted = messages.map(m => ({
      id: m._id.toString(),
      _id: m._id.toString(),
      chat_id: m.chat_id,
      sender_email: m.sender_email,
      sender_name: m.sender_name,
      recipient_email: m.recipient_email,
      text: m.text,
      time: m.time,
      timestamp: m.timestamp
    }));
    return new Response(JSON.stringify(formatted), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const text = (body.text || '').trim();
    if (!text) {
      return new Response(JSON.stringify({ message: 'Message text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    const senderEmail = (body.sender_email || '').toLowerCase().trim();
    const recipientEmail = (body.recipient_email || '').toLowerCase().trim();
    if (!senderEmail || !recipientEmail) {
      return new Response(JSON.stringify({ message: 'Both sender_email and recipient_email are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    const chatIdComputed = body.chat_id || [senderEmail, recipientEmail].sort().join('|');
    const newDoc = {
      chat_id: chatIdComputed,
      sender_email: senderEmail,
      sender_name: body.sender_name || senderEmail,
      recipient_email: recipientEmail,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString()
    };
    const result = await chatsCol.insertOne(newDoc);
    return new Response(JSON.stringify({
      id: result.insertedId.toString(),
      _id: result.insertedId.toString(),
      ...newDoc
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// --- USER NOTIFICATIONS EXTENSION (include user chats) ---
if (url.pathname === '/api/notifications' && request.method === 'GET') {
  const userEmail = url.searchParams.get('user_email');
  if (!userEmail) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const cleanEmail = userEmail.toLowerCase().trim();
  const userDoc = await usersCollection.findOne({ email: cleanEmail });
  const artistNames = [];
  if (userDoc) {
    if (userDoc.name) artistNames.push(userDoc.name);
    if (userDoc.artist_name) artistNames.push(userDoc.artist_name);
  }

  const orClauses = [
    { user_email: cleanEmail, sender: 'artist' }
  ];
  for (const a of artistNames) {
    orClauses.push({ artist_name: { $regex: `^${a}$`, $options: 'i' }, sender: 'user' });
  }
  // Include user-to-user chats where recipient is this user and sender is another user
  orClauses.push({ recipient_email: cleanEmail, sender: { $ne: 'artist' } });

  const artistChatsCollection = db.collection('artist_chats');
  const userChatsCollection = db.collection('user_chats');
  const artistNotifs = await artistChatsCollection.find({ $or: orClauses }).sort({ _id: -1 }).limit(10).toArray();
  const userNotifs = await userChatsCollection.find({ recipient_email: cleanEmail }).sort({ _id: -1 }).limit(10).toArray();
  const allNotifs = [...artistNotifs, ...userNotifs];
  const formatted = await Promise.all(allNotifs.map(async (n) => {
    let senderImage = n.sender_image || n.profile_pic || '';
    let senderName = n.sender_name || (n.sender === 'artist' ? 'Artist' : n.sender_email);
    if (n.sender === 'artist' && n.artist_name) {
      const artDoc = await usersCollection.findOne({
        $or: [
          { artist_name: { $regex: `^${n.artist_name}$`, $options: 'i' } },
          { name: { $regex: `^${n.artist_name}$`, $options: 'i' } }
        ]
      });
      if (artDoc) {
        senderImage = artDoc.profile_pic || artDoc.image || senderImage;
        senderName = artDoc.artist_name || artDoc.name || senderName;
      }
    } else if ((n.user_email || n.sender_email)) {
      const targetEmail = (n.sender === 'user' ? (n.user_email || n.sender_email) : n.sender_email);
      if (targetEmail) {
        const uDoc = await usersCollection.findOne({ email: targetEmail.toLowerCase().trim() });
        if (uDoc) {
          senderImage = uDoc.profile_pic || uDoc.image || senderImage;
          senderName = uDoc.name || uDoc.artist_name || senderName;
        }
      }
    }
    return {
      id: n._id.toString(),
      _id: n._id.toString(),
      artist_name: n.artist_name || null,
      sender_name: senderName,
      sender_image: senderImage,
      profile_pic: senderImage,
      user_email: n.user_email || null,
      recipient_email: n.recipient_email || null,
      sender: n.sender,
      text: n.text || '',
      time: n.time || 'Recently',
      read: n.read || false,
      unread: !n.read
    };
  }));
  return new Response(JSON.stringify(formatted), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}


    } catch (error) {
      console.error('Server error:', error);
      return new Response(JSON.stringify({ 
        message: 'Server error during execution',
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

export default handler;

// Local Node.js HTTP server wrapper supporting PORT or API_BASE_URL extraction
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  import('http').then(async (http) => {
    try {
      const dotenv = await import('dotenv');
      dotenv.config();
    } catch (e) {}

    const server = http.createServer(async (req, res) => {
      try {
        const url = `http://${req.headers.host || 'localhost:8000'}${req.url}`;
        let body = null;
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          body = Buffer.concat(chunks);
        }
        const headers = new Headers();
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          headers.append(req.rawHeaders[i], req.rawHeaders[i + 1]);
        }
        const request = new Request(url, { 
          method: req.method, 
          headers, 
          body: body && body.length ? body : undefined 
        });
        
        const env = { 
          MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI, 
          MONGODB_DATABASE: process.env.MONGODB_DATABASE || 'Sway' 
        };

        const response = await handler.fetch(request, env, {});
        res.statusCode = response.status;
        response.headers.forEach((val, key) => res.setHeader(key, val));
        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      } catch (err) {
        console.error('Local server error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    let PORT = process.env.PORT;
    if (!PORT && process.env.API_BASE_URL) {
      try {
        const parsedUrl = new URL(process.env.API_BASE_URL);
        if (parsedUrl.port) {
          PORT = parsedUrl.port;
        }
      } catch (e) {}
    }
    PORT = PORT || 8000;

    server.listen(PORT, () => {
      console.log(`Local Node server running on http://127.0.0.1:${PORT} (API_BASE_URL configured)`);
    });
  });
}